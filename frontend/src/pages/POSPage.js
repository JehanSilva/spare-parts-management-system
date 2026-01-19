import React, { useState, useEffect, useRef } from "react";
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
  MapPin,
  XCircle,
  Hash,
  ArrowLeft,
  ChevronUp,
} from "lucide-react";

const POSPage = () => {
  const [parts, setParts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Mobile State: 'products' or 'cart'
  const [mobileView, setMobileView] = useState("products");

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(null);

  // Alert & Confirm States
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
      try {
        const data = await fetchParts();
        setParts(data);
      } catch (error) {
        setAlertInfo({ type: "error", message: "Failed to load parts data." });
      }
    };
    loadParts();
  }, []);

  // 2. Filter Parts
  const filteredParts = parts.filter(
    (part) =>
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.brand.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
      setCart([...cart, { ...part, quantity: 1, warranty: 0 }]);
    }
    // Optional: Auto-switch to cart on mobile? No, keeps flow faster to stay on products.
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

  // Clear Cart Logic
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

  // 6. Calculate Totals
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.sell_price * item.quantity,
    0,
  );

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 7. Checkout Logic
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
      items: cart.map((item) => ({
        part_id: item.id,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.sell_price),
        warranty: item.warranty || 0,
      })),
    };

    try {
      const result = await createSale(salePayload);

      // Enrich sale object with part details for receipt
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

  // Helper
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return `${v.make} ${v.model}`;
    }
    return v;
  };

  // --- SUCCESS SCREEN ---
  if (saleSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
        <CheckCircle className="text-green-600 w-16 h-16 md:w-20 md:h-20 mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 text-center">
          Sale Completed!
        </h1>
        <p className="text-gray-600 mb-2 font-mono">
          #{saleSuccess.id.substring(0, 8)}
        </p>

        {saleSuccess.vehicle_number && (
          <p className="text-gray-500 mb-6 flex items-center gap-2">
            <Car size={16} /> {saleSuccess.vehicle_number}
          </p>
        )}

        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <button
            onClick={() => setSaleSuccess(null)}
            className="bg-red-600 text-white px-6 py-3 rounded-lg shadow hover:bg-red-700 font-bold w-full md:w-auto"
          >
            New Sale
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-800 text-white px-6 py-3 rounded-lg shadow flex items-center justify-center gap-2 hover:bg-gray-900 font-bold w-full md:w-auto"
          >
            <Printer size={18} /> Print Invoice
          </button>
        </div>
        <div className="hidden">
          <Receipt ref={receiptRef} sale={saleSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-gray-100 overflow-hidden relative">
      {/* --- ALERTS & MODALS --- */}
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

      {/* =========================================================
          LEFT SIDE: PRODUCT LIST
          (Hidden on mobile if 'mobileView' is 'cart')
      ========================================================== */}
      <div
        className={`w-full md:w-2/3 flex flex-col h-full ${mobileView === "cart" ? "hidden md:flex" : "flex"}`}
      >
        {/* Search Bar (Sticky) */}
        <div className="p-4 bg-gray-100 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search part name, number, brand..."
              className="w-full pl-10 p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 pt-0 pb-24 md:pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {filteredParts.map((part) => (
              <div
                key={part.id}
                onClick={() => addToCart(part)}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col relative group cursor-pointer active:scale-95"
              >
                {/* Image */}
                <div className="h-32 md:h-40 bg-gray-100 relative">
                  {part.image ? (
                    <img
                      src={part.image}
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                      <Package size={32} opacity={0.2} />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className="absolute bottom-1 left-1">
                    {part.stock_qty <= part.min_stock_level ? (
                      <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <AlertTriangle size={8} /> Low
                      </span>
                    ) : (
                      <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                        {part.stock_qty} left
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-2.5 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-800 text-xs md:text-sm leading-tight line-clamp-2 mb-1">
                    {part.name}
                  </h3>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 font-mono">
                      {part.part_number}
                    </p>
                    <p className="text-sm md:text-lg font-bold text-red-700 leading-none">
                      LKR{part.sell_price}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================
          RIGHT SIDE: CART / CHECKOUT
          (Hidden on mobile if 'mobileView' is 'products')
      ========================================================== */}
      <div
        className={`w-full md:w-1/3 bg-white border-l border-gray-300 flex flex-col h-full shadow-2xl z-20 
          ${mobileView === "products" ? "hidden md:flex" : "flex"}
      `}
      >
        {/* Mobile: Back Button */}
        <div className="md:hidden p-3 bg-red-800 text-white flex items-center gap-3">
          <button onClick={() => setMobileView("products")} className="p-1">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-bold">Checkout ({cart.length})</h2>
        </div>

        {/* Desktop: Cart Header */}
        <div className="hidden md:flex p-4 bg-red-800 text-white shadow-md z-10 justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Current Bill
          </h2>
          {cart.length > 0 && (
            <button
              onClick={handleClearCartRequest}
              className="text-xs bg-red-900 hover:bg-red-700 text-white px-2 py-1 rounded flex items-center gap-1 transition"
            >
              <XCircle size={14} /> Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
              <ShoppingCart size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Cart is empty</p>
              <p className="text-sm">Tap items on the left to add them.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0"
              >
                <div className="flex-1 pr-2">
                  <h4 className="font-bold text-sm text-gray-800 line-clamp-1">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-mono mb-0.5">
                    {item.part_number}
                  </p>
                  <p className="text-xs text-gray-600 font-medium">
                    LKR{item.sell_price} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-2 hover:text-red-600 hover:bg-gray-200 rounded-l-lg transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-1 text-sm font-bold min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-2 hover:text-green-600 hover:bg-gray-200 rounded-r-lg transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                Customer Name *
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none text-sm"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                Vehicle No.
              </label>
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none text-sm"
                placeholder="ABC-1234"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 bg-white p-3 rounded border border-gray-200">
            <span className="text-lg font-bold text-gray-700">Total</span>
            <span className="text-2xl font-bold text-red-700">
              LKR {totalAmount.toFixed(0)}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className={`w-full py-3.5 rounded-lg text-white font-bold text-lg shadow transition flex justify-center items-center gap-2 ${
              loading
                ? "bg-gray-400"
                : "bg-red-600 hover:bg-red-700 active:scale-95"
            }`}
          >
            {loading ? "Processing..." : "Complete Sale"}
          </button>
        </div>
      </div>

      {/* =========================================================
          MOBILE FLOATING FOOTER (Shows only when on 'products' view)
      ========================================================== */}
      {mobileView === "products" && (
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-30">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-bold uppercase">
                {totalItems} Items selected
              </span>
              <span className="text-xl font-bold text-red-700">
                LKR {totalAmount.toFixed(0)}
              </span>
            </div>
            <button
              onClick={() => setMobileView("cart")}
              className="bg-red-800 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-red-900 transition active:scale-95"
            >
              View Cart <ChevronUp size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
