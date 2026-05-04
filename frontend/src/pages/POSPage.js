import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import { fetchParts, createSale } from "../services/api";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
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
const ProductItem = memo(({ part, onAddToCart }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      onClick={() => onAddToCart(part)}
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
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem("pos_cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("products");
  const [visibleCount, setVisibleCount] = useState(20);

  // Form States
  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem("pos_customer") || "";
  });
  const [vehicleNumber, setVehicleNumber] = useState(() => {
    return localStorage.getItem("pos_vehicle") || "";
  });

  // Persist State to LocalStorage
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);
  
  useEffect(() => {
    localStorage.setItem("pos_customer", customerName);
  }, [customerName]);
  
  useEffect(() => {
    localStorage.setItem("pos_vehicle", vehicleNumber);
  }, [vehicleNumber]);

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

  // 3. Add to Cart
  const addToCart = (part) => {
    const existingItem = cart.find((item) => item.id === part.id);

    if (existingItem) {
      if (existingItem.quantity + 1 > part.stock_qty) {
        setAlertInfo({
          type: "error",
          message: `Not enough stock! Only ${part.stock_qty} available.`,
        });
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      if (part.stock_qty < 1) {
        setAlertInfo({ type: "error", message: "Item is Out of Stock!" });
        return;
      }
      // Add to the top of the cart instead of the bottom
      setCart([{ ...part, quantity: 1, discountAmount: 0 }, ...cart]);
    }
  };

  // 4. Remove from Cart
  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // 5. Update Quantity
  const updateQuantity = (id, delta) => {
    setCart(
      cart.map((item) => {
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
      }),
    );
  };

  // 5.5 Update Discount Amount
  const updateDiscountAmount = (id, amount) => {
    let validAmount = parseFloat(amount);
    if (isNaN(validAmount)) validAmount = 0;
    if (validAmount < 0) validAmount = 0;

    // Optional: You might want to cap the discount at the sell price
    // But for now, let's just update it.
    
    setCart(
      cart.map((item) => {
        if (item.id === id) {
          // Ensure discount doesn't exceed price
          const maxDiscount = parseFloat(item.sell_price);
          if (validAmount > maxDiscount) validAmount = maxDiscount;
          
          return { ...item, discountAmount: validAmount };
        }
        return item;
      })
    );
  };

  const handleClearCartRequest = () => {
    if (cart.length === 0) return;
    setShowConfirm(true);
  };

  const executeClearCart = () => {
    setCart([]);
    setCustomerName("");
    setVehicleNumber("");
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

    // --- PREPARE PAYLOAD ---
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

          // SEND CASH VALUE directly
          discount: discountAmount,

          warranty: item.warranty || 0,
        };
      }),
    };

    // DEBUG: Look in your browser console to see what is being sent!
    console.log("🚀 Sending Sale Payload:", salePayload);

    try {
      const result = await createSale(salePayload);

      // Enrich sale object with part details for receipt display
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

      setCart([]);
      setCustomerName("");
      setVehicleNumber("");

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

  // --- SUCCESS SCREEN ---
  if (saleSuccess) {
    return (
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
    );
  }

  // --- MAIN LAYOUT ---


  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-100 overflow-hidden relative">
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

              return (
                <div
                  key={item.id}
                  className="flex flex-col bg-white p-3 rounded-xl shadow-sm border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
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
                      className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
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

                    {/* Discount UI Enhanced (Amount) */}
                    <div className={`flex items-center border rounded-lg h-9 px-2 gap-1 transition-all ${item.discountAmount > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                        <span className={`text-[10px] font-bold ${item.discountAmount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>LKR</span>
                        <input
                          type="number"
                          min="0"
                          // max={item.sell_price} // Optional
                          placeholder="0"
                          value={item.discountAmount === 0 ? '' : item.discountAmount}
                          onChange={(e) => updateDiscountAmount(item.id, e.target.value)}
                          className="w-16 text-center bg-transparent outline-none text-base md:text-sm font-semibold text-gray-700 placeholder-gray-300"
                        />
                    </div>

                    {/* Price Display */}
                    <div className="text-right flex-1">
                      {item.discountAmount > 0 && (
                        <p className="text-[10px] text-gray-400 line-through">
                          {original.toLocaleString()}
                        </p>
                      )}
                      <p className={`font-bold ${item.discountAmount > 0 ? "text-amber-600" : "text-gray-800"}`}>
                        {final.toLocaleString()}
                      </p>
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
                onChange={(e) => setCustomerName(e.target.value)}
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
                onChange={(e) => setVehicleNumber(e.target.value)}
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
