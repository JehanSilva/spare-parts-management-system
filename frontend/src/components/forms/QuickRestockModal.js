import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  XCircle,
  Search,
  Save,
  CheckCircle,
  Plus,
  Trash2,
  History,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { fetchParts, restockPart, fetchRestockHistory, fetchSuppliers } from "../../services/api";

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatLKR = (val) =>
  `LKR ${parseFloat(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const emptyEntry = () => ({
  id: Date.now() + Math.random(),
  supplier_id: "",
  quantity: "",
  buy_price: "",
  notes: "",
});

// ─── Weighted Average Preview ────────────────────────────────────────────────
const computePreview = (currentQty, currentBuyPrice, entries) => {
  const oldVal = (currentQty || 0) * parseFloat(currentBuyPrice || 0);
  let addedQty = 0;
  let addedVal = 0;

  for (const e of entries) {
    const qty = parseInt(e.quantity, 10);
    const price = parseFloat(e.buy_price);
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price >= 0) {
      addedQty += qty;
      addedVal += qty * price;
    }
  }

  const totalQty = (currentQty || 0) + addedQty;
  const newAvg = totalQty > 0 ? (oldVal + addedVal) / totalQty : 0;
  return { addedQty, totalQty, newAvg };
};

// ─── History Tab ─────────────────────────────────────────────────────────────
const HistoryTab = ({ partId }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partId) return;
    setLoading(true);
    fetchRestockHistory(partId)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 text-gray-400">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2" />
        Loading history...
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
        <History size={32} className="opacity-40" />
        <p className="text-sm">No restock history for this part yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Supplier</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Buy Price</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                {new Date(r.restocked_at).toLocaleDateString("en-LK", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-3 py-2 font-medium text-gray-800">
                {r.supplier_name}
              </td>
              <td className="px-3 py-2 text-right font-bold text-blue-700">
                +{r.quantity}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {formatLKR(r.buy_price)}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const QuickRestockModal = ({ onClose, onSuccess, initialPart = null }) => {
  const [activeTab, setActiveTab] = useState("restock");
  const [searchTerm, setSearchTerm] = useState(initialPart ? initialPart.name : "");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(initialPart);
  const [suppliers, setSuppliers] = useState([]);

  const [entries, setEntries] = useState(
    initialPart ? [{ ...emptyEntry(), buy_price: initialPart.buy_price || "" }] : [emptyEntry()]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const searchDebounceRef = useRef(null);

  // Load suppliers on mount
  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  // Live search
  useEffect(() => {
    if (!searchTerm.trim() || selectedPart) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await fetchParts({ search: searchTerm });
        setSearchResults(data.slice(0, 8));
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm, selectedPart]);

  const handleSelectPart = (part) => {
    setSelectedPart(part);
    setSearchTerm(part.name);
    setSearchResults([]);
    setEntries([{ ...emptyEntry(), buy_price: part.buy_price || "" }]);
    setError("");
    setFieldErrors({});
  };

  const handleClearSelection = () => {
    setSelectedPart(null);
    setSearchTerm("");
    setEntries([emptyEntry()]);
    setError("");
    setFieldErrors({});
    setActiveTab("restock");
  };

  const updateEntry = (id, field, value) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}_${field}`];
      return next;
    });
  };

  const addEntry = () => setEntries((prev) => [...prev, emptyEntry()]);

  const removeEntry = (id) => {
    if (entries.length === 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const validate = () => {
    const errors = {};
    let valid = true;
    entries.forEach((e) => {
      const qty = parseInt(e.quantity, 10);
      const price = parseFloat(e.buy_price);
      if (isNaN(qty) || qty <= 0) {
        errors[`${e.id}_quantity`] = "Qty must be > 0";
        valid = false;
      }
      if (isNaN(price) || price < 0) {
        errors[`${e.id}_buy_price`] = "Price must be ≥ 0";
        valid = false;
      }
    });
    setFieldErrors(errors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedPart) {
      setError("Please select a part to restock.");
      return;
    }
    if (!validate()) {
      setError("Please fix the highlighted fields before submitting.");
      return;
    }

    const payload = entries.map((en) => ({
      supplier_id: en.supplier_id ? parseInt(en.supplier_id, 10) : null,
      quantity: parseInt(en.quantity, 10),
      buy_price: parseFloat(en.buy_price),
      notes: en.notes || "",
    }));

    setIsSubmitting(true);
    try {
      const result = await restockPart(selectedPart.id, payload);
      const supplierCount = new Set(payload.map((p) => p.supplier_id).filter(Boolean)).size;
      const msg =
        supplierCount > 1
          ? `Restocked ${result.total_added_qty} units from ${supplierCount} suppliers. New avg price: ${formatLKR(result.new_avg_buy_price)}`
          : `Restocked ${result.total_added_qty} units. New avg price: ${formatLKR(result.new_avg_buy_price)}`;
      onSuccess(msg);
      onClose();
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        (Array.isArray(err.response?.data) ? JSON.stringify(err.response.data) : null) ||
        "Failed to process restock.";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const preview = selectedPart
    ? computePreview(selectedPart.stock_qty, selectedPart.buy_price, entries)
    : null;

  const priceChanged =
    preview && selectedPart
      ? Math.abs(preview.newAvg - parseFloat(selectedPart.buy_price || 0)) > 0.005
      : false;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-blue-700 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Package size={20} />
            <h3 className="font-bold text-lg">Quick Restock</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-blue-600 p-1 rounded-full transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Global error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm font-medium">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Part Search ── */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Select Part
            </label>

            {!selectedPart ? (
              <div>
                {/* Input row */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name or part number…"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                    </div>
                  )}
                </div>

                {/* Results rendered in normal flow — modal grows to fit */}
                {searchResults.length > 0 && (
                  <div className="mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    {searchResults.map((part) => (
                      <div
                        key={part.id}
                        onClick={() => handleSelectPart(part)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{part.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{part.part_number}</div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="text-xs font-bold text-gray-700">{part.stock_qty} in stock</div>
                          <div className="text-xs text-gray-400">{formatLKR(part.buy_price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <div className="font-bold text-blue-900 text-sm">{selectedPart.name}</div>
                    <div className="text-xs text-blue-600 font-mono mt-0.5">
                      {selectedPart.part_number}&nbsp;·&nbsp;Stock: {selectedPart.stock_qty}&nbsp;·&nbsp;Buy Price: {formatLKR(selectedPart.buy_price)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-blue-500 hover:text-blue-700 bg-white p-1 rounded-lg shadow-sm border border-blue-200 shrink-0"
                  title="Change Part"
                >
                  <XCircle size={15} />
                </button>
              </div>
            )}
          </div>

          {/* ── Tabs (only when a part is selected) ── */}
          {selectedPart && (
            <>
              <div className="flex border-b border-gray-200">
                <button
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors -mb-px ${
                    activeTab === "restock"
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab("restock")}
                >
                  <span className="flex items-center gap-1.5"><Package size={14} /> Restock</span>
                </button>
                <button
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors -mb-px ${
                    activeTab === "history"
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab("history")}
                >
                  <span className="flex items-center gap-1.5"><History size={14} /> History</span>
                </button>
              </div>

              {/* ── Restock Tab ── */}
              {activeTab === "restock" && (
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Supplier entries */}
                  <div className="space-y-3">
                    {entries.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="bg-gray-50 border border-gray-200 rounded-xl p-4 relative"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Supplier {idx + 1}
                          </span>
                          {entries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id)}
                              className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                              title="Remove this entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Supplier dropdown */}
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Supplier <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <select
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                              value={entry.supplier_id}
                              onChange={(e) => updateEntry(entry.id, "supplier_id", e.target.value)}
                            >
                              <option value="">— Unknown / No Supplier —</option>
                              {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 10"
                              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm ${
                                fieldErrors[`${entry.id}_quantity`]
                                  ? "border-red-400 bg-red-50"
                                  : "border-gray-300"
                              }`}
                              value={entry.quantity}
                              onChange={(e) => updateEntry(entry.id, "quantity", e.target.value)}
                            />
                            {fieldErrors[`${entry.id}_quantity`] && (
                              <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`${entry.id}_quantity`]}</p>
                            )}
                          </div>

                          {/* Buy price */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Unit Buy Price (LKR) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g. 1500.00"
                              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm ${
                                fieldErrors[`${entry.id}_buy_price`]
                                  ? "border-red-400 bg-red-50"
                                  : "border-gray-300"
                              }`}
                              value={entry.buy_price}
                              onChange={(e) => updateEntry(entry.id, "buy_price", e.target.value)}
                            />
                            {fieldErrors[`${entry.id}_buy_price`] && (
                              <p className="text-xs text-red-500 mt-0.5">{fieldErrors[`${entry.id}_buy_price`]}</p>
                            )}
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Notes <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Invoice #123"
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                              value={entry.notes}
                              onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add supplier row */}
                  <button
                    type="button"
                    onClick={addEntry}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-bold px-3 py-2 rounded-lg hover:bg-blue-50 border border-dashed border-blue-300 w-full justify-center transition-colors"
                  >
                    <Plus size={15} /> Add Another Supplier
                  </button>

                  {/* ── Live Preview Summary ── */}
                  {preview && preview.addedQty > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">
                        Restock Summary Preview
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="text-xs text-gray-500 font-semibold">Adding</div>
                          <div className="text-xl font-black text-blue-700">+{preview.addedQty}</div>
                          <div className="text-xs text-gray-400">units</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="text-xs text-gray-500 font-semibold">New Total Stock</div>
                          <div className="text-xl font-black text-gray-800">{preview.totalQty}</div>
                          <div className="text-xs text-gray-400">units</div>
                        </div>
                        <div className={`bg-white rounded-lg p-3 border ${priceChanged ? "border-amber-200" : "border-blue-100"}`}>
                          <div className="text-xs text-gray-500 font-semibold">New Avg Buy Price</div>
                          <div className={`text-sm font-black leading-tight ${priceChanged ? "text-amber-700" : "text-gray-800"}`}>
                            {formatLKR(preview.newAvg)}
                          </div>
                          {priceChanged && (
                            <div className="flex items-center justify-center gap-0.5 mt-0.5">
                              <span className="text-[10px] text-gray-400 line-through">
                                {formatLKR(selectedPart.buy_price)}
                              </span>
                              <ArrowRight size={9} className="text-amber-500 shrink-0" />
                              <span className="text-[10px] text-amber-600 font-bold">Updated</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Actions ── */}
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      {isSubmitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Save size={15} />
                      )}
                      Process Restock
                    </button>
                  </div>
                </form>
              )}

              {/* ── History Tab ── */}
              {activeTab === "history" && (
                <HistoryTab partId={selectedPart?.id} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickRestockModal;
