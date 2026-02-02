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
  ArrowLeft,
  ChevronUp,
  XCircle,
  Tag,
} from "lucide-react";

const POSPage = () => {
  const [parts, setParts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("products");

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const [loading, setLoading] = useState(false);
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
      // IMPORTANT: Initialize discountPercent to 0
      setCart([...cart, { ...part, quantity: 1, discountPercent: 0 }]);
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

  // 5.5 Update Discount Percentage
  const updateDiscount = (id, percent) => {
    let validPercent = parseFloat(percent);
    if (isNaN(validPercent)) validPercent = 0;
    if (validPercent < 0) validPercent = 0;
    if (validPercent > 100) validPercent = 100;

    setCart(
      cart.map((item) =>
        item.id === id ? { ...item, discountPercent: validPercent } : item,
      ),
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

  // 6. Calculate Totals (Visual Only)
  const totalAmount = cart.reduce((sum, item) => {
    const originalPrice = parseFloat(item.sell_price);
    const discountAmount = originalPrice * (item.discountPercent / 100);
    const finalPrice = originalPrice - discountAmount;
    return sum + finalPrice * item.quantity;
  }, 0);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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
        const percent = parseFloat(item.discountPercent) || 0;

        // Convert % to Cash Amount
        const discountCashValue = originalPrice * (percent / 100);

        return {
          part_id: item.id,
          quantity: parseInt(item.quantity),
          unit_price: originalPrice,

          // SEND CASH VALUE (Backend needs this field enabled in serializers.py)
          discount: discountCashValue,

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
              className="w-full pl-10 p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white transition-colors focus:ring-2 focus:ring-red-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 pb-24 md:pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredParts.map((part) => (
              <div
                key={part.id}
                onClick={() => addToCart(part)}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col relative group cursor-pointer active:scale-95 touch-manipulation"
              >
                <div className="h-28 md:h-32 bg-gray-100 relative">
                  {part.image ? (
                    <img
                      src={part.image}
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                      <Package size={32} />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-1.5">
                    {part.stock_qty <= part.min_stock_level ? (
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
            ))}
          </div>
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
              const discountVal = original * (item.discountPercent / 100);
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

                    {/* Discount UI Enhanced */}
                    <div className={`flex items-center border rounded-lg h-9 px-2 gap-1 transition-all ${item.discountPercent > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                        <Tag size={12} className={item.discountPercent > 0 ? 'text-amber-500' : 'text-gray-400'} />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={item.discountPercent === 0 ? '' : item.discountPercent}
                          onChange={(e) => updateDiscount(item.id, e.target.value)}
                          className="w-10 text-center bg-transparent outline-none text-sm font-semibold text-gray-700 placeholder-gray-300"
                        />
                        <span className="text-[10px] text-gray-400 font-bold">%</span>
                    </div>

                    {/* Price Display */}
                    <div className="text-right flex-1">
                      {item.discountPercent > 0 && (
                        <p className="text-[10px] text-gray-400 line-through">
                          {original.toLocaleString()}
                        </p>
                      )}
                      <p className={`font-bold ${item.discountPercent > 0 ? "text-amber-600" : "text-gray-800"}`}>
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
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm transition-all"
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
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm transition-all"
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
