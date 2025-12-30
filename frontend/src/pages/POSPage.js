import React, { useState, useEffect } from "react";
import { fetchParts, createSale } from "../services/api";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Printer,
} from "lucide-react";

const POSPage = () => {
  const [parts, setParts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(null);

  // 1. Load Parts for Searching
  useEffect(() => {
    const loadParts = async () => {
      const data = await fetchParts();
      setParts(data);
    };
    loadParts();
  }, []);

  // 2. Filter Parts based on Search
  const filteredParts = parts.filter(
    (part) =>
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Add to Cart Logic
  const addToCart = (part) => {
    const existingItem = cart.find((item) => item.id === part.id);

    if (existingItem) {
      if (existingItem.quantity + 1 > part.stock_qty) {
        alert(`Not enough stock! Only ${part.stock_qty} available.`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (part.stock_qty < 1) {
        alert("Out of Stock!");
        return;
      }
      setCart([...cart, { ...part, quantity: 1, warranty: 0 }]);
    }
  };

  // 4. Remove from Cart
  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // 5. Update Quantity in Cart
  const updateQuantity = (id, delta) => {
    setCart(
      cart.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty > item.stock_qty) {
            alert(`Max stock is ${item.stock_qty}`);
            return item;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  // 6. Calculate Totals
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.sell_price * item.quantity,
    0
  );

  // 7. Handle Checkout
  // Replace the existing handleCheckout function with this one:
  const handleCheckout = async () => {
    if (!customerName) return alert("Please enter Customer Name");
    if (cart.length === 0) return alert("Cart is empty");

    setLoading(true);
    const salePayload = {
      customer_name: customerName,
      items: cart.map((item) => ({
        part_id: item.id,
        quantity: parseInt(item.quantity), // <--- Force number format
        unit_price: parseFloat(item.sell_price), // <--- Force decimal format
        warranty: item.warranty || 0,
      })),
    };

    try {
      const result = await createSale(salePayload);
      setSaleSuccess(result);
      setCart([]);
      setCustomerName("");

      // Refresh parts to show new stock levels immediately
      const updatedParts = await fetchParts();
      setParts(updatedParts);
    } catch (error) {
      console.error("Sale Error:", error);
      // Show the exact error message from Django
      const serverMessage =
        error.response?.data?.error || "Connection to server failed.";
      alert(`Sale Failed: ${serverMessage}`);
    }
    setLoading(false);
  };

  if (saleSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <CheckCircle className="text-green-600 w-20 h-20 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800">Sale Completed!</h1>
        <p className="text-gray-600 mb-6">
          Invoice #{saleSuccess.id.substring(0, 8)}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setSaleSuccess(null)}
            className="bg-red-600 text-white px-6 py-2 rounded shadow"
          >
            New Sale
          </button>
          <button className="bg-gray-800 text-white px-6 py-2 rounded shadow flex items-center gap-2">
            <Printer size={18} /> Print Invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] bg-gray-100 overflow-hidden">
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

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map((part) => (
            <div
              key={part.id}
              onClick={() => addToCart(part)}
              className="bg-white p-4 rounded-lg shadow hover:shadow-lg cursor-pointer transition border-l-4 border-transparent hover:border-red-500"
            >
              <h3 className="font-bold text-gray-800 truncate">{part.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{part.part_number}</p>
              <div className="flex justify-between items-center">
                <span className="text-red-700 font-bold">
                  ${part.sell_price}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    part.stock_qty > 0
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Qty: {part.stock_qty}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Billing Cart */}
      <div className="w-full md:w-1/3 bg-white border-l border-gray-300 flex flex-col h-full shadow-xl">
        <div className="p-4 bg-red-800 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Current Bill
          </h2>
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
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-800">
                    {item.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    ${item.sell_price} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:text-red-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-2 text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:text-green-600"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Customer Name
            </label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none"
              placeholder="Enter Customer Name"
            />
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold text-gray-700">Total:</span>
            <span className="text-2xl font-bold text-red-700">
              ${totalAmount.toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
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
