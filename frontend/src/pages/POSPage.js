import React, { useState, useEffect, useRef } from "react";
import { fetchParts, createSale } from "../services/api";
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import AlertComponent from "../components/AlertComponent"; // <--- Import Alert
import ConfirmModal from "../components/ConfirmModal"; // <--- Import Confirm
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
  XCircle, // Added for Clear Cart button
} from "lucide-react";

const POSPage = () => {
  const [parts, setParts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Form States
  const [customerName, setCustomerName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(null);

  // --- NEW: Alert & Confirm States ---
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [showConfirm, setShowConfirm] = useState(false); // Controls Confirm Modal

  // --- PRINTING LOGIC ---
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
      part.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Add to Cart Logic (Replaced alerts with setAlertInfo)
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
          item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (part.stock_qty < 1) {
        setAlertInfo({ type: "error", message: "Item is Out of Stock!" });
        return;
      }
      setCart([...cart, { ...part, quantity: 1, warranty: 0 }]);
    }
  };

  // 4. Remove from Cart
  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // 5. Update Quantity (Replaced alerts)
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
      })
    );
  };

  // --- NEW: Clear Cart Logic with Confirmation ---
  const handleClearCartRequest = () => {
    if (cart.length === 0) return; // Nothing to clear
    setShowConfirm(true); // Open Modal
  };

  const executeClearCart = () => {
    setCart([]);
    setCustomerName("");
    setVehicleNumber("");
    setShowConfirm(false); // Close Modal
    setAlertInfo({ type: "success", message: "Cart cleared successfully." });
  };

  // 6. Calculate Totals
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.sell_price * item.quantity,
    0
  );

  // 7. Checkout (Replaced alerts)
  const handleCheckout = async () => {
    // Validation using Toast Alerts
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
      setSaleSuccess(result);

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

  // Helper to render vehicle name
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return `${v.make} ${v.model}`;
    }
    return v;
  };

  // --- SUCCESS SCREEN ---
  if (saleSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <CheckCircle className="text-green-600 w-20 h-20 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800">Sale Completed!</h1>
        <p className="text-gray-600 mb-2">
          Invoice #{saleSuccess.id.substring(0, 8)}
        </p>

        {saleSuccess.vehicle_number && (
          <p className="text-gray-500 mb-6 flex items-center gap-2">
            <Car size={16} /> Vehicle: {saleSuccess.vehicle_number}
          </p>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => setSaleSuccess(null)}
            className="bg-red-600 text-white px-6 py-2 rounded shadow hover:bg-red-700"
          >
            New Sale
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-800 text-white px-6 py-2 rounded shadow flex items-center gap-2 hover:bg-gray-900"
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] bg-gray-100 overflow-hidden relative">
      {/* --- COMPONENTS: Alert & Confirm --- */}
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
        message="Are you sure you want to clear the entire cart? All selected items will be removed."
        onConfirm={executeClearCart}
        onCancel={() => setShowConfirm(false)}
      />

      {/* LEFT SIDE: Product List */}
      <div className="w-full md:w-2/3 p-4 overflow-y-auto">
        <div className="sticky top-0 bg-gray-100 pb-4 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search parts by Name, Number or Car Model..."
              className="w-full pl-10 p-3 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* --- PRODUCT GRID --- */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map((part) => (
            <div
              key={part.id}
              onClick={() => addToCart(part)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col relative group cursor-pointer hover:border-red-500"
            >
              {/* Image Section */}
              <div className="h-40 bg-gray-100 relative">
                {part.image ? (
                  <img
                    src={part.image}
                    alt={part.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                    <Package size={40} opacity={0.2} />
                  </div>
                )}
                {/* Stock Badge */}
                <div className="absolute bottom-2 left-2">
                  {part.stock_qty <= part.min_stock_level ? (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <AlertTriangle size={10} /> Low Stock
                    </span>
                  ) : (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                      In Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-1">
                  <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">
                    {part.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {part.part_number}
                  </p>
                </div>

                <div className="flex gap-2 mb-2">
                  <span className="bg-red-50 text-red-800 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-100">
                    {part.brand || "No Brand"}
                  </span>
                </div>

                {/* Compatible Vehicles */}
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {part.compatible_vehicles &&
                    part.compatible_vehicles.length > 0 ? (
                      part.compatible_vehicles.slice(0, 2).map((v, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded border border-gray-200 truncate max-w-[100px]"
                        >
                          {renderVehicleName(v)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] text-gray-400 italic">
                        Universal
                      </span>
                    )}
                    {part.compatible_vehicles &&
                      part.compatible_vehicles.length > 2 && (
                        <span className="text-[9px] text-gray-400 pl-1 pt-0.5">
                          +{part.compatible_vehicles.length - 2}
                        </span>
                      )}
                  </div>
                </div>

                <div className="space-y-0.5 mb-2 flex-1">
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <MapPin size={10} /> {part.rack_location}
                  </p>
                </div>

                {/* Price Footer */}
                <div className="flex justify-between items-end border-t border-gray-100 pt-2 mt-auto">
                  <div>
                    <p className="text-lg font-bold text-red-700 leading-none">
                      LKR{part.sell_price}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 mb-0">Qty</p>
                    <span
                      className={`font-bold text-sm ${
                        part.stock_qty <= part.min_stock_level
                          ? "text-red-600"
                          : "text-gray-800"
                      }`}
                    >
                      {part.stock_qty}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Billing Cart */}
      <div className="w-full md:w-1/3 bg-white border-l border-gray-300 flex flex-col h-full shadow-xl">
        <div className="p-4 bg-red-800 text-white shadow-md z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Current Bill
          </h2>
          {/* Clear Cart Button (Triggers Confirm Modal) */}
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
            <div className="text-center text-gray-400 mt-10">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-20" />
              <p>Cart is empty. Select items to add.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0"
              >
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-800">
                    {item.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    LKR{item.sell_price} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1.5 hover:text-red-600 hover:bg-gray-200 rounded-l-lg transition"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-2 text-sm font-bold min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1.5 hover:text-green-600 hover:bg-gray-200 rounded-r-lg transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 transition p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shadow-inner">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Customer Name *
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none text-sm"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Vehicle No. (Opt)
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
            <span className="text-lg font-bold text-gray-700">Total:</span>
            <span className="text-2xl font-bold text-red-700">
              LKR{totalAmount.toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow transition ${
              loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {loading ? "Processing..." : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
