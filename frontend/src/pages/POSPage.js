import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { fetchParts, createSale } from "../services/api";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import PartDetailsModal from "../components/PartDetailsModal";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Printer,
  Car,
  Package,
  AlertTriangle,
  ArrowLeft,
  ChevronUp,
  XCircle,
  Tag,
} from "lucide-react";

// --- MEMOIZED PRODUCT ITEM COMPONENT ---
const ProductItem = memo(({ part, onAddToCart, onShowDetails }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  const startPress = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      onShowDetails(part);
      isLongPress.current = true;
    }, 500); // 500ms for long press
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleClick = (e) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    onAddToCart(part);
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); }} // Prevent mobile context menu on long press
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col relative group cursor-pointer active:scale-95 touch-manipulation"
    >
      <div className="h-28 md:h-32 bg-gray-100 relative">
        {part.image ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse z-0">
                <div className="h-full w-full flex items-center justify-center">
                  <Package size={24} className="text-gray-300 opacity-20" />
                </div>
              </div>
            )}
            <img
              src={part.image}
              alt={part.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
            <Package size={32} />
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          {part.stock_qty < 2 ? (
            <span className="bg-red-500 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <AlertTriangle size={10} /> Low ({part.stock_qty})
            </span>
          ) : (
            <span className="bg-white/90 backdrop-blur text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
              {part.stock_qty} available
            </span>
          )}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-xs md:text-sm leading-snug line-clamp-2">
            {part.name}
          </h3>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
            {part.part_number}
          </p>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">{part.brand}</p>
          <p className="text-sm font-bold text-red-600">
            {parseFloat(part.sell_price).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
});

const POSPage = () => {
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [carts, setCarts] = useState(() => {
    const saved = localStorage.getItem("pos_carts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse pos_carts", e);
      }
    }

    // Migration logic for old single cart structure
    const oldCart = localStorage.getItem("pos_cart");
    const oldCustomer = localStorage.getItem("pos_customer");
    const oldVehicle = localStorage.getItem("pos_vehicle");
    if (oldCart || oldCustomer || oldVehicle) {
      try {
        const parsedCart = oldCart ? JSON.parse(oldCart) : [];
        if (parsedCart.length > 0 || oldCustomer || oldVehicle) {
          return [
            {
              id: "cart_" + Date.now(),
              customerName: oldCustomer || "",
              vehicleNumber: oldVehicle || "",
              items: parsedCart,
            },
          ];
        }
      } catch (e) {
        console.error("Failed to migrate old POS cart", e);
      }
    }

    return [
      {
        id: "cart_" + Date.now(),
        customerName: "",
        vehicleNumber: "",
        items: [],
      },
    ];
  });

  const [activeCartId, setActiveCartId] = useState(() => {
    const savedActiveId = localStorage.getItem("pos_active_cart_id");
    if (savedActiveId && carts.some((c) => c.id === savedActiveId)) {
      return savedActiveId;
    }
    return carts[0]?.id || "";
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("products");
  const [visibleCount, setVisibleCount] = useState(20);

  const [cartToDelete, setCartToDelete] = useState(null);

  // Derived active cart states
  const activeCart = useMemo(() => {
    return (
      carts.find((c) => c.id === activeCartId) ||
      carts[0] || { id: "default", customerName: "", vehicleNumber: "", items: [] }
    );
  }, [carts, activeCartId]);

  const cart = activeCart.items;
  const customerName = activeCart.customerName;
  const vehicleNumber = activeCart.vehicleNumber;

  // Persist States to LocalStorage
  useEffect(() => {
    localStorage.setItem("pos_carts", JSON.stringify(carts));
  }, [carts]);

  useEffect(() => {
    localStorage.setItem("pos_active_cart_id", activeCartId);
  }, [activeCartId]);

  const [loading, setLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);
  const [saleSuccess, setSaleSuccess] = useState(null);

  // Alerts
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [showConfirm, setShowConfirm] = useState(false);

  // Print Ref
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Invoice-${saleSuccess?.id || "New"}`,
  });

  // 1. Load Parts
  useEffect(() => {
    const loadParts = async () => {
      setPartsLoading(true);
      try {
        const data = await fetchParts();
        setParts(data);
      } catch (error) {
        setAlertInfo({ type: "error", message: "Failed to load parts data." });
      } finally {
        setPartsLoading(false);
      }
    };
    loadParts();
  }, []);

  // Reset visible count when search term changes
  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm]);

  // 2. Filter Parts (Memoized) — keyword-based: ALL words must match
  const filteredParts = useMemo(() => {
    const keywords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return parts;
    return parts.filter((part) => {
      const name = part.name.toLowerCase();
      const partNum = part.part_number.toLowerCase();
      const brand = (part.brand || "").toLowerCase();
      return keywords.every(
        (kw) => name.includes(kw) || partNum.includes(kw) || brand.includes(kw)
      );
    });
  }, [parts, searchTerm]);

  // 2.5 Multi-Cart Actions
  const handleAddNewCart = () => {
    const newId = "cart_" + Date.now();
    const newCart = {
      id: newId,
      customerName: "",
      vehicleNumber: "",
      items: [],
    };
    setCarts((prev) => [...prev, newCart]);
    setActiveCartId(newId);
    setAlertInfo({ type: "success", message: "New repair cart created." });
  };

  const handleDeleteCart = (cartId) => {
    const targetCart = carts.find((c) => c.id === cartId);
    if (!targetCart) return;

    if (targetCart.items.length > 0) {
      setCartToDelete(cartId);
    } else {
      executeDeleteCart(cartId);
    }
  };

  const executeDeleteCart = (cartId) => {
    setCarts((prev) => {
      const remaining = prev.filter((c) => c.id !== cartId);
      if (activeCartId === cartId) {
        setActiveCartId(remaining[0].id);
      }
      return remaining;
    });
    setCartToDelete(null);
    setAlertInfo({ type: "success", message: "Repair cart discarded." });
  };

  const handleCustomerNameChange = (name) => {
    setCarts((prev) =>
      prev.map((c) => (c.id === activeCartId ? { ...c, customerName: name } : c))
    );
  };

  const handleVehicleNumberChange = (veh) => {
    setCarts((prev) =>
      prev.map((c) => (c.id === activeCartId ? { ...c, vehicleNumber: veh } : c))
    );
  };

  // 3. Add to Cart
  const addToCart = useCallback((part) => {
    setCarts((prevCarts) => {
      return prevCarts.map((c) => {
        if (c.id !== activeCartId) return c;

        const prevCart = c.items;
        const existingItem = prevCart.find((item) => item.id === part.id);

        let newItems;
        if (existingItem) {
          if (existingItem.quantity + 1 > part.stock_qty) {
            setAlertInfo({
              type: "error",
              message: `Not enough stock! Only ${part.stock_qty} available.`,
            });
            return c;
          }
          newItems = prevCart.map((item) =>
            item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          if (part.stock_qty < 1) {
            setAlertInfo({ type: "error", message: "Item is Out of Stock!" });
            return c;
          }
          newItems = [
            { ...part, quantity: 1, discountAmount: 0, discountPercentInput: "" },
            ...prevCart,
          ];
        }
        return { ...c, items: newItems };
      });
    });
  }, [activeCartId]);

  // 4. Remove from Cart
  const removeFromCart = (id) => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === activeCartId
          ? { ...c, items: c.items.filter((item) => item.id !== id) }
          : c
      )
    );
  };

  // 5. Update Quantity
  const updateQuantity = (id, delta) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty > item.stock_qty) {
              setAlertInfo({
                type: "error",
                message: `Max stock is ${item.stock_qty}`,
              });
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  // 5.5 Update Discount Amount
  const updateDiscountAmount = (id, amountStr) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            if (amountStr === "") {
              return {
                ...item,
                discountAmount: 0,
                discountPercentInput: "",
              };
            }

            let amount = parseFloat(amountStr);
            if (isNaN(amount)) amount = 0;
            if (amount < 0) amount = 0;

            const sellPrice = parseFloat(item.sell_price || 0);
            if (amount > sellPrice) amount = sellPrice;

            const percent = sellPrice > 0 ? (amount / sellPrice) * 100 : 0;

            return {
              ...item,
              discountAmount: amount,
              discountPercentInput: parseFloat(percent.toFixed(2)).toString(),
            };
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  // 5.6 Update Discount Percent
  const updateDiscountPercent = (id, percentStr) => {
    setCarts((prev) =>
      prev.map((c) => {
        if (c.id !== activeCartId) return c;

        const newItems = c.items.map((item) => {
          if (item.id === id) {
            if (percentStr === "") {
              return {
                ...item,
                discountAmount: 0,
                discountPercentInput: "",
              };
            }

            let percent = parseFloat(percentStr);
            if (isNaN(percent)) percent = 0;
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            const sellPrice = parseFloat(item.sell_price || 0);
            let amount = (percent / 100) * sellPrice;
            amount = Math.round(amount * 100) / 100;

            return {
              ...item,
              discountAmount: amount,
              discountPercentInput: percentStr,
            };
          }
          return item;
        });
        return { ...c, items: newItems };
      })
    );
  };

  const handleClearCartRequest = () => {
    if (cart.length === 0) return;
    setShowConfirm(true);
  };

  const executeClearCart = () => {
    setCarts((prev) =>
      prev.map((c) =>
        c.id === activeCartId
          ? { ...c, customerName: "", vehicleNumber: "", items: [] }
          : c
      )
    );
    setShowConfirm(false);
    setAlertInfo({ type: "success", message: "Cart cleared successfully." });
  };

  // 6. Calculate Totals (Visual Only) - Memoized
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const originalPrice = parseFloat(item.sell_price);
      const discountVal = parseFloat(item.discountAmount) || 0;
      const finalPrice = originalPrice - discountVal;
      return sum + finalPrice * item.quantity;
    }, 0);
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // 7. Checkout Logic (The Critical Part)
  const handleCheckout = async () => {
    if (!customerName) {
      setAlertInfo({ type: "error", message: "Please enter Customer Name" });
      return;
    }
    if (cart.length === 0) {
      setAlertInfo({
        type: "error",
        message: "Cart is empty. Add items first.",
      });
      return;
    }

    setLoading(true);

    const salePayload = {
      customer_name: customerName,
      vehicle_number: vehicleNumber,
      items: cart.map((item) => {
        const originalPrice = parseFloat(item.sell_price);
        const discountAmount = parseFloat(item.discountAmount) || 0;

        return {
          part_id: item.id,
          quantity: parseInt(item.quantity),
          unit_price: originalPrice,
          discount: discountAmount,
          warranty: item.warranty || 0,
        };
      }),
    };

    console.log("🚀 Sending Sale Payload:", salePayload);

    try {
      const result = await createSale(salePayload);

      const enrichedItems = result.items.map((saleItem) => {
        const partId = saleItem.part || saleItem.part_id;
        const originalPart = parts.find((p) => p.id === partId);
        return {
          ...saleItem,
          part_number: originalPart ? originalPart.part_number : "",
          part_name: originalPart
            ? originalPart.name
            : saleItem.part_name || "Unknown",
        };
      });

      const enrichedSale = { ...result, items: enrichedItems };
      setSaleSuccess(enrichedSale);

      setCarts((prev) => {
        const remaining = prev.filter((c) => c.id !== activeCartId);
        if (remaining.length === 0) {
          const newId = "cart_" + Date.now();
          setActiveCartId(newId);
          return [{ id: newId, customerName: "", vehicleNumber: "", items: [] }];
        } else {
          setActiveCartId(remaining[0].id);
          return remaining;
        }
      });

      const updatedParts = await fetchParts();
      setParts(updatedParts);

      setAlertInfo({
        type: "success",
        message: "Sale completed successfully!",
      });
    } catch (error) {
      console.error("Sale Error:", error);
      const serverMessage =
        error.response?.data?.error || "Connection to server failed.";
      setAlertInfo({ type: "error", message: `Sale Failed: ${serverMessage}` });
    }
    setLoading(false);
  };

  // --- MAIN LAYOUT DATA ---
  const visibleParts = useMemo(() => {
    return filteredParts.slice(0, visibleCount);
  }, [filteredParts, visibleCount]);

  // --- MAIN LAYOUT & SUCCESS SCREEN ---
  return saleSuccess ? (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50/50 p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-gray-200/50 p-8 md:p-10 max-w-lg w-full text-center relative overflow-hidden">
        
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow ring-8 ring-green-50/50">
           <CheckCircle className="text-green-500 w-12 h-12" strokeWidth={3} />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2 tracking-tight">
          Payment Successful!
        </h1>
        <p className="text-gray-400 mb-8 font-medium">
          Transaction ID <span className="text-gray-600 font-mono">#{saleSuccess.id.substring(0, 8)}</span>
        </p>

        {/* Receipt Summary - Softened */}
        <div className="bg-gray-50/80 rounded-2xl p-6 mb-8 text-left space-y-4">
           <div className="flex justify-between items-center pb-4 border-b border-gray-100 border-dashed">
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wide">Total Paid</span>
              <span className="text-2xl font-black text-gray-800">LKR {parseFloat(saleSuccess.total_amount).toLocaleString()}</span>
           </div>
           <div className="space-y-2 pt-2">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-bold text-gray-700">{saleSuccess.customer_name}</span>
               </div>
               {saleSuccess.vehicle_number && (
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-500">Vehicle</span>
                     <span className="font-bold text-gray-700 flex items-center gap-1.5"><Car size={14} className="text-gray-400"/>{saleSuccess.vehicle_number}</span>
                  </div>
               )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Items</span>
                  <span className="font-bold text-gray-700">{saleSuccess.items.length} purchased</span>
               </div>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handlePrint}
            className="flex-1 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-lg shadow-gray-200 hover:shadow-xl hover:translate-y-[-2px] flex items-center justify-center gap-2 font-bold transition-all duration-300"
          >
            <Printer size={20} /> Invoice
          </button>
          <button
            onClick={() => setSaleSuccess(null)}
            className="flex-1 bg-white text-red-600 border-2 border-red-50 px-6 py-4 rounded-xl hover:bg-red-50 hover:border-red-100 font-bold flex items-center justify-center gap-2 transition-all duration-300"
          >
            <Plus size={20} /> New Sale
          </button>
        </div>
      </div>

      <div className="hidden">
        <Receipt ref={receiptRef} sale={saleSuccess} />
      </div>
    </div>
  ) : (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-100 overflow-hidden relative">
      <PartDetailsModal part={selectedPart} onClose={() => setSelectedPart(null)} />
      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Clear Cart?"
        message="Are you sure you want to clear the entire cart?"
        onConfirm={executeClearCart}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmModal
        isOpen={!!cartToDelete}
        title="Discard Repair Cart?"
        message="Are you sure you want to discard this repair cart? All items added will be lost."
        onConfirm={() => executeDeleteCart(cartToDelete)}
        onCancel={() => setCartToDelete(null)}
      />

      {/* TOP BAR: ACTIVE CARTS MANAGEMENT */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-red-50 text-red-600 p-1.5 rounded-lg">
            <Car size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-gray-800 text-sm tracking-tight leading-none">Active Repairs</h1>
            <span className="text-[10px] text-gray-400 font-semibold">{carts.length} ongoing repair{carts.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Scrollable Cart Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 max-w-full sm:max-w-[75%] md:max-w-[80%] pb-1 sm:pb-0">
          {carts.map((c, index) => {
            const isActive = c.id === activeCartId;
            const displayName = c.vehicleNumber 
              ? c.vehicleNumber 
              : (c.customerName ? c.customerName : `Repair ${index + 1}`);
            const subText = c.vehicleNumber && c.customerName ? c.customerName : "";

            return (
              <div
                key={c.id}
                onClick={() => setActiveCartId(c.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 transition-all duration-200 shrink-0 cursor-pointer select-none relative group ${
                  isActive
                    ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300"
                }`}
              >
                <Car size={13} className={isActive ? "text-red-500" : "text-gray-400"} />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold whitespace-nowrap leading-none">
                    {displayName}
                  </span>
                  {subText && (
                    <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap leading-none mt-1">
                      {subText}
                    </span>
                  )}
                </div>
                {c.items.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold leading-none ${
                    isActive ? "bg-red-200 text-red-800" : "bg-gray-200 text-gray-700"
                  }`}>
                    {c.items.length}
                  </span>
                )}
                {/* Delete Cart button - show only if we have more than 1 cart */}
                {carts.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCart(c.id);
                    }}
                    className="text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-gray-200 transition-colors ml-1 shrink-0"
                    title="Delete Cart"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            );
          })}
          
          {/* Add New Cart Button */}
          <button
            onClick={handleAddNewCart}
            className="flex items-center justify-center p-2 rounded-xl border border-dashed border-gray-300 hover:border-gray-500 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all shrink-0 w-8 h-8"
            title="Add New Cart/Repair"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* LEFT SIDE: PRODUCT LIST */}
      <div
        className={`w-full md:w-2/3 flex flex-col h-full bg-gray-50 transition-all duration-300 ${
          mobileView === "cart" ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-3 bg-white shadow-sm z-10">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search part name, number, brand..."
              className="w-full pl-10 p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-red-500 outline-none text-base md:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {partsLoading ? (
               /* Skeleton Loader Grid */
               Array.from({ length: 12 }).map((_, i) => (
                 <div key={i} className="bg-white border border-gray-100 rounded-xl p-0 overflow-hidden shadow-sm animate-pulse">
                   <div className="h-28 bg-gray-200"></div>
                   <div className="p-3 space-y-2">
                     <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                     <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                     <div className="flex justify-between pt-2">
                       <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                       <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                     </div>
                   </div>
                 </div>
               ))
            ) : (
              visibleParts.map((part) => (
                <ProductItem 
                  key={part.id} 
                  part={part} 
                  onAddToCart={addToCart} 
                  onShowDetails={setSelectedPart}
                />
              ))
            )}
          </div>
          
          {/* Load More Button */}
          {visibleCount < filteredParts.length && (
            <div className="mt-6 flex flex-col items-center justify-center pb-8">
              <p className="text-xs text-gray-400 mb-2 font-medium">
                Showing {visibleCount} of {filteredParts.length} parts
              </p>
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="group relative bg-white border-2 border-red-50 text-red-600 font-bold py-2.5 px-8 rounded-full hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <span>Load More Parts</span>
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-extrabold group-hover:bg-red-200 transition-colors">
                  +{filteredParts.length - visibleCount}
                </span>
                <ChevronUp className="rotate-180 w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: CART */}
      <div
        className={`w-full md:w-1/3 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-20 
          ${mobileView === "products" ? "hidden md:flex" : "flex"}
      `}
      >
        {/* Mobile Header for Cart View */}
        <div className="md:hidden p-3 bg-white border-b border-gray-100 flex items-center justify-between">
            <button 
                onClick={() => setMobileView("products")}
                className="flex items-center gap-1 text-gray-600 font-medium active:bg-gray-100 px-2 py-1 rounded"
            >
                <ArrowLeft size={18}/> Back to Products
            </button>
            <h2 className="font-bold text-gray-800">Your Cart</h2>
            <div className="w-8"></div> {/* Spacer */}
        </div>

        <div className="hidden md:flex p-4 bg-gray-900 text-white shadow-md z-10 justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Current Sale
          </h2>
          {cart.length > 0 && (
            <button
              onClick={handleClearCartRequest}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-full flex items-center gap-1 transition"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart size={32} className="opacity-40" />
              </div>
              <p className="text-lg font-semibold text-gray-500">Cart is empty</p>
              <p className="text-sm">Select items to start a sale</p>
            </div>
          ) : (
            cart.map((item) => {
              const original = parseFloat(item.sell_price);
              const discountVal = parseFloat(item.discountAmount) || 0;
              const final = original - discountVal;

              // Calculate remaining unit profitability based on buy_price
              const buyPrice = parseFloat(item.buy_price || 0);
              const currentProfit = final - buyPrice;
              const currentMargin = final > 0 ? ((currentProfit / final) * 100).toFixed(1) : "0.0";
              const currentMarkup = buyPrice > 0 ? ((currentProfit / buyPrice) * 100).toFixed(1) : "0.0";

              let profitColorClass = "bg-green-50 text-green-700 border-green-100";
              let profitText = `Margin: ${currentMargin}% (Markup: ${currentMarkup}%)`;

              if (currentProfit === 0) {
                profitColorClass = "bg-amber-50 text-amber-700 border-amber-100";
                profitText = "Break Even (0%)";
              } else if (currentProfit < 0) {
                profitColorClass = "bg-red-50 text-red-700 border-red-200 animate-pulse font-bold";
                profitText = `Loss: Margin: ${currentMargin}%`;
              }

              const percentValue = item.discountPercentInput !== undefined 
                ? item.discountPercentInput 
                : (item.discountAmount ? parseFloat(((item.discountAmount / original) * 100).toFixed(2)).toString() : '');

              return (
                <div
                  key={item.id}
                  className="flex flex-col bg-white p-3 rounded-xl shadow-sm border border-gray-200"
                >
                  {/* Row 1: Title, details and remove */}
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-sm text-gray-800 line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {item.part_number} • {item.brand}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors shrink-0"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>

                  {/* Row 2: Quantity controls & Final Price */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100 border-dashed">
                    {/* Quantity Control */}
                    <div className="flex items-center bg-gray-100 rounded-lg h-9">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-9 h-full flex items-center justify-center hover:text-red-600 active:bg-gray-200 rounded-l-lg transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-9 h-full flex items-center justify-center hover:text-green-600 active:bg-gray-200 rounded-r-lg transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Price Display */}
                    <div className="text-right">
                      {item.discountAmount > 0 && (
                        <p className="text-[10px] text-gray-400 line-through">
                          {original.toLocaleString()}
                        </p>
                      )}
                      <p className={`font-bold text-sm ${item.discountAmount > 0 ? "text-amber-600" : "text-gray-800"}`}>
                        LKR {final.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Discounts Inputs & Profitability badge */}
                  <div className="mt-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Tag size={12} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discount</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Rupee Input */}
                        <div className={`flex items-center border rounded-lg h-8 px-2 gap-1 transition-all ${item.discountAmount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                          <span className={`text-[10px] font-bold ${item.discountAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>LKR</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.discountAmount === 0 ? '' : item.discountAmount}
                            onChange={(e) => updateDiscountAmount(item.id, e.target.value)}
                            className="w-14 text-center bg-transparent outline-none text-xs font-semibold text-gray-700 placeholder-gray-300"
                          />
                        </div>
                        
                        {/* Percentage Input */}
                        <div className={`flex items-center border rounded-lg h-8 px-2 gap-1 transition-all ${item.discountAmount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={percentValue}
                            onChange={(e) => updateDiscountPercent(item.id, e.target.value)}
                            className="w-10 text-center bg-transparent outline-none text-xs font-semibold text-gray-700 placeholder-gray-300"
                          />
                          <span className={`text-[10px] font-bold ${item.discountAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>%</span>
                        </div>
                      </div>
                    </div>

                    {/* Profitability Badge */}
                    <div className="flex items-center justify-between text-[10px] pt-1">
                      <span className="text-gray-400 font-medium">Remaining Profit:</span>
                      <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] border tracking-tight ${profitColorClass}`}>
                        {profitText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* BOTTOM ACTION AREA */}
        <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Customer Name
              </label>
              <input
                value={customerName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-base md:text-sm transition-all"
                placeholder="Required"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Vehicle No.
              </label>
              <input
                value={vehicleNumber}
                onChange={(e) => handleVehicleNumberChange(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-base md:text-sm transition-all"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex justify-between items-end mb-4">
            <span className="text-sm font-medium text-gray-500">Total Amount</span>
            <div className="text-right">
                <span className="text-3xl font-bold text-gray-900 tracking-tight">
                <span className="text-lg text-gray-400 font-normal mr-1">LKR</span>
                {totalAmount.toLocaleString()}
                </span>
            </div>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-red-200 transition-all flex justify-center items-center gap-2 
                ${loading 
                    ? "bg-gray-300 cursor-not-allowed" 
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98]"
                }`}
          >
            {loading ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Processing...</span>
            ) : (
                <>Complete Sale <CheckCircle size={20}/></>
            )}
          </button>
        </div>
      </div>

      </div>

      {/* MOBILE FLOATING BAR */}
      {mobileView === "products" && (
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40 pb-safe">
          <div className="flex gap-3">
             <div className="flex-1 flex flex-col justify-center px-2">
                <span className="text-xs text-gray-500 font-medium">{totalItems} items</span>
                <span className="text-lg font-bold text-gray-900">LKR {totalAmount.toLocaleString()}</span>
             </div>
            <button
              onClick={() => setMobileView("cart")}
              className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              View Cart <ChevronUp size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
