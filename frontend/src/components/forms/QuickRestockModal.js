import React, { useState, useEffect, useRef } from "react";
import { Package, XCircle, Search, Save, CheckCircle } from "lucide-react";
import { fetchParts, restockPart } from "../../services/api";

const QuickRestockModal = ({ onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);

  // Form State
  const [addedQuantity, setAddedQuantity] = useState("");
  const [newBuyPrice, setNewBuyPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchDebounceRef = useRef(null);

  // Live search for parts
  useEffect(() => {
    if (!searchTerm.trim() || selectedPart) {
      setParts([]);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchParts({ search: searchTerm });
        setParts(data.slice(0, 10)); // Limit to 10 results
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm, selectedPart]);

  const handleSelectPart = (part) => {
    setSelectedPart(part);
    setSearchTerm(part.name);
    setParts([]);
    setNewBuyPrice(part.buy_price); // Pre-fill with current price
    setError("");
  };

  const handleClearSelection = () => {
    setSelectedPart(null);
    setSearchTerm("");
    setAddedQuantity("");
    setNewBuyPrice("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedPart) {
      setError("Please select a part to restock.");
      return;
    }

    const qty = parseInt(addedQuantity, 10);
    const price = parseFloat(newBuyPrice);

    if (isNaN(qty) || qty <= 0) {
      setError("Added quantity must be greater than 0.");
      return;
    }

    if (isNaN(price) || price < 0) {
      setError("New buy price must be a valid number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await restockPart(selectedPart.id, {
        added_quantity: qty,
        new_buy_price: price,
      });
      onSuccess("Part restocked successfully. Average price updated!");
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to restock part.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-700 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Package size={20} /> Quick Restock
          </h3>
          <button
            onClick={onClose}
            className="hover:bg-blue-600 p-1 rounded-full transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto w-full max-h-[80vh]">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mb-4 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Part Selection */}
            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Select Part
              </label>
              {!selectedPart ? (
                <div className="relative">
                  <Search
                    className="absolute left-3 top-3 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search part name or number..."
                    className="w-full pl-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {loading && (
                    <div className="absolute right-3 top-3 text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {parts.length > 0 && (
                    <div className="w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-inner max-h-60 overflow-y-auto">
                      {parts.map((part) => (
                        <div
                          key={part.id}
                          onClick={() => handleSelectPart(part)}
                          className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center transition-colors"
                        >
                          <div>
                            <div className="font-bold text-gray-800 text-sm">
                              {part.name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {part.part_number}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-gray-500 text-right">
                            <span className="block text-[10px] uppercase font-normal text-gray-400">
                              Current Stock
                            </span>
                            {part.stock_qty}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <div className="font-bold text-blue-900 text-sm flex items-center gap-1">
                      <CheckCircle size={14} className="text-blue-600" />
                      {selectedPart.name}
                    </div>
                    <div className="text-xs text-blue-700 font-mono mt-0.5">
                      {selectedPart.part_number} | Current Stock:{" "}
                      {selectedPart.stock_qty}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-blue-500 hover:text-blue-700 bg-white p-1 rounded shadow-sm border border-blue-200"
                    title="Change Part"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Restock Form */}
            {selectedPart && (
              <div className="animate-fade-in grid gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Added Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={addedQuantity}
                    onChange={(e) => setAddedQuantity(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be added to the current stock ({selectedPart.stock_qty}).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    New Unit Buy Price (LKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1500"
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newBuyPrice}
                    onChange={(e) => setNewBuyPrice(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Old Price: LKR {selectedPart.buy_price}. The system will calculate the new weighted average automatically.
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save size={16} />
                    )}
                    Process Restock
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuickRestockModal;
