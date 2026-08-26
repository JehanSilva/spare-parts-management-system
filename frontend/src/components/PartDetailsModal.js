import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Package,
  XCircle,
  AlertTriangle,
  MapPin,
  Car,
  ShoppingCart,
  TrendingUp,
  History,
  Truck,
  RotateCcw,
  Edit2,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  PackagePlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchRestockHistory, returnRestockRecord, editRestockRecord } from "../services/api";

const formatLKR = (val) =>
  `LKR ${parseFloat(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  ACTIVE: {
    bg: "bg-white",
    border: "border-gray-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    badge: null,
  },
  PARTIALLY_RETURNED: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: { label: "Partial Return", cls: "bg-amber-100 text-amber-700 border border-amber-300" },
  },
  FULLY_RETURNED: {
    bg: "bg-red-50",
    border: "border-red-300",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    badge: { label: "Returned", cls: "bg-red-100 text-red-700 border border-red-300" },
  },
};

// ─── Restock History Section ──────────────────────────────────────────────────
const RestockHistorySection = ({ partId, onRefresh }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Which record has an open panel: { id, type: 'return' | 'edit' }
  const [activePanel, setActivePanel] = useState(null);

  // Return form state
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState("");

  // Edit form state
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(() => {
    if (!partId) return;
    setLoading(true);
    fetchRestockHistory(partId)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partId]);

  useEffect(() => { load(); }, [load]);

  const openReturn = (record) => {
    const available = record.quantity - record.returned_quantity;
    setActivePanel({ id: record.id, type: "return" });
    setReturnQty(available);
    setReturnReason("");
    setReturnError("");
  };

  const openEdit = (record) => {
    setActivePanel({ id: record.id, type: "edit" });
    setEditQty(record.quantity);
    setEditPrice(record.buy_price);
    setEditError("");
  };

  const closePanel = () => setActivePanel(null);

  const handleReturn = async (record) => {
    if (!returnReason.trim()) { setReturnError("Reason is required."); return; }
    setReturnSubmitting(true);
    setReturnError("");
    try {
      await returnRestockRecord(partId, record.id, { quantity: returnQty, reason: returnReason });
      closePanel();
      load();
      onRefresh?.();
    } catch (e) {
      setReturnError(e.response?.data?.error || "Return failed. Try again.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleEdit = async (record) => {
    setEditSubmitting(true);
    setEditError("");
    try {
      await editRestockRecord(partId, record.id, { quantity: editQty, buy_price: editPrice });
      closePanel();
      load();
      onRefresh?.();
    } catch (e) {
      setEditError(e.response?.data?.error || "Edit failed. Try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 shrink-0" />
        Loading purchase history…
      </div>
    );
  }

  if (!records.length) {
    return <p className="text-sm text-gray-400 italic py-3">No purchase history recorded yet.</p>;
  }

  return (
    <div className="space-y-3 mt-3">
      {records.map((r) => {
        const style = STATUS[r.status] || STATUS.ACTIVE;
        const available = r.quantity - r.returned_quantity;
        const isOpen = activePanel?.id === r.id;
        const panelType = isOpen ? activePanel.type : null;

        return (
          <div key={r.id} className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden shadow-sm`}>

            {/* ── Record row ── */}
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              {/* Left: icon + info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`${style.iconBg} ${style.iconColor} rounded-lg p-2 shrink-0`}>
                  <Truck size={14} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-800 truncate">{r.supplier_name}</p>
                    {style.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge.cls}`}>
                        {style.badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(r.restocked_at)}
                    {r.invoice_number ? ` · Invoice #${r.invoice_number}` : ""}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                  {/* Return info */}
                  {r.status !== "ACTIVE" && (
                    <p className="text-xs mt-0.5 text-amber-700 font-medium">
                      {r.returned_quantity === r.quantity
                        ? `All ${r.quantity} returned`
                        : `${r.returned_quantity} of ${r.quantity} returned`}
                      {r.return_reason ? ` · "${r.return_reason}"` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: qty + price + action buttons */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className={`text-sm font-black ${r.status === "FULLY_RETURNED" ? "text-red-500 line-through" : "text-blue-700"}`}>
                    +{r.quantity} units
                  </p>
                  {r.status === "PARTIALLY_RETURNED" && (
                    <p className="text-[10px] text-amber-600 font-semibold">
                      {available} remaining
                    </p>
                  )}
                  <p className="text-xs font-semibold text-gray-600">{formatLKR(r.buy_price)} each</p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1">
                  {available > 0 && (
                    <button
                      onClick={() => isOpen && panelType === "return" ? closePanel() : openReturn(r)}
                      className={`p-1.5 rounded-lg border transition-colors text-xs flex items-center gap-1 ${
                        isOpen && panelType === "return"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"
                      }`}
                      title="Return stock"
                    >
                      <RotateCcw size={12} />
                      {isOpen && panelType === "return" ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}
                  <button
                    onClick={() => isOpen && panelType === "edit" ? closePanel() : openEdit(r)}
                    className={`p-1.5 rounded-lg border transition-colors text-xs flex items-center gap-1 ${
                      isOpen && panelType === "edit"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                    }`}
                    title="Edit record"
                  >
                    <Edit2 size={12} />
                    {isOpen && panelType === "edit" ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Return panel ── */}
            {isOpen && panelType === "return" && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <RotateCcw size={12} /> Return Stock
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Quantity to return <span className="text-gray-400 font-normal">(max {available})</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={available}
                        value={returnQty}
                        onChange={(e) => setReturnQty(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                      <input
                        type="number"
                        min={1}
                        max={available}
                        value={returnQty}
                        onChange={(e) => setReturnQty(Math.min(available, Math.max(1, Number(e.target.value))))}
                        className="w-16 text-center border border-amber-300 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      Returning {returnQty} of {available} available ({returnQty === available ? "full return" : "partial return"})
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => { setReturnReason(e.target.value); setReturnError(""); }}
                      placeholder="e.g. Damaged goods, wrong part..."
                      className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  {returnError && <p className="text-xs text-red-600 font-medium">{returnError}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={closePanel}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      <X size={12} className="inline mr-1" /> Cancel
                    </button>
                    <button
                      onClick={() => handleReturn(r)}
                      disabled={returnSubmitting}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {returnSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Confirm Return
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Edit panel ── */}
            {isOpen && panelType === "edit" && (
              <div className="border-t border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Edit2 size={12} /> Edit Record
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">
                        Quantity
                        {r.returned_quantity > 0 && (
                          <span className="text-gray-400 font-normal ml-1">(min {r.returned_quantity})</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min={r.returned_quantity || 1}
                        value={editQty}
                        onChange={(e) => { setEditQty(e.target.value); setEditError(""); }}
                        className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Buy Price (LKR)</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={editPrice}
                        onChange={(e) => { setEditPrice(e.target.value); setEditError(""); }}
                        className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                  {editError && <p className="text-xs text-red-600 font-medium">{editError}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={closePanel}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      <X size={12} className="inline mr-1" /> Cancel
                    </button>
                    <button
                      onClick={() => handleEdit(r)}
                      disabled={editSubmitting}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {editSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const PartDetailsModal = ({ part, onClose, onPartUpdated, onRestock }) => {
  const navigate = useNavigate();
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  const startSupplierPress = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      onClose();
      navigate('/suppliers', { state: { search: part.supplier_details?.name } });
      isLongPress.current = true;
    }, 500);
  };

  const endSupplierPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleSupplierClick = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
  };

  if (!part) return null;

  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return v.year ? `${v.year} ${v.make} ${v.model}` : `${v.make} ${v.model}`;
    }
    return "Vehicle";
  };

  const totalSold = part.total_sold || 0;
  const totalRevenue = parseFloat(part.total_revenue || 0);
  const totalCost = parseFloat(part.total_cost || 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin =
    totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const sellPrice = parseFloat(part.sell_price || 0);
  const buyPrice = parseFloat(part.buy_price || 0);
  const unitProfit = sellPrice - buyPrice;
  const unitMarkup =
    buyPrice > 0 ? ((unitProfit / buyPrice) * 100).toFixed(1) : "0.0";
  const unitMargin =
    sellPrice > 0 ? ((unitProfit / sellPrice) * 100).toFixed(1) : "0.0";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-700 p-4 text-white flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Package size={20} /> Part Details
          </h3>
          <div className="flex items-center gap-2">
            {onRestock && (
              <button
                onClick={() => { onClose(); onRestock(part); }}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/30 transition-colors"
                title="Quick Restock this part"
              >
                <PackagePlus size={14} /> Restock
              </button>
            )}
            <button onClick={onClose} className="hover:bg-red-600 p-1 rounded-full transition-colors">
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto w-full space-y-6">

          {/* ── Image + Identity ── */}
          <div className="flex flex-col sm:flex-row gap-6">
            {part.image ? (
              <img
                src={part.image}
                alt={part.name}
                className="w-full sm:w-40 h-48 sm:h-40 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-full h-48 sm:w-40 sm:h-40 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 text-gray-400 shrink-0">
                <Package size={48} opacity={0.3} />
              </div>
            )}
            <div className="flex-1 w-full overflow-hidden">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight mb-2 break-words">
                {part.name}
              </h2>
              <p className="text-sm text-gray-500 font-mono mb-3 py-1 px-2 bg-gray-100 rounded inline-block break-all">
                Part No: {part.part_number}
              </p>
              {part.brand && (
                <div className="mb-3">
                  <span className="bg-red-50 text-red-800 text-xs font-bold px-2.5 py-1 rounded-md border border-red-100 uppercase tracking-wide inline-block break-words">
                    {part.brand}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Stock & Price Stats ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 shrink-0">
                <AlertTriangle size={12} /> Stock Qty
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-xl font-bold break-words ${part.stock_qty <= 1 ? "text-red-600" : "text-gray-800"}`}>
                  {part.stock_qty}
                </p>
                {part.stock_qty <= 1 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase shrink-0">Low</span>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 shrink-0">
                <MapPin size={12} /> Location
              </p>
              <p className="text-lg sm:text-xl font-bold text-gray-800 break-words">{part.rack_location || "N/A"}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 shrink-0">Avg Buy Price</p>
              <p className="text-lg font-bold text-gray-800 break-words">{formatLKR(part.buy_price)}</p>
            </div>

            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <p className="text-xs text-red-500 mb-1 font-semibold shrink-0">Sell Price</p>
              <p className="text-lg font-bold text-red-700 break-words">{formatLKR(part.sell_price)}</p>
            </div>

            <div 
              className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1 cursor-pointer select-none active:bg-gray-200 transition-colors"
              onMouseDown={startSupplierPress}
              onMouseUp={endSupplierPress}
              onMouseLeave={endSupplierPress}
              onTouchStart={startSupplierPress}
              onTouchEnd={endSupplierPress}
              onClick={handleSupplierClick}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 shrink-0">Primary Supplier</p>
              </div>
              <p className="text-md font-bold text-gray-800 break-words">{part.supplier_details?.name || "N/A"}</p>
            </div>

            {part.description && (
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500 mb-1 shrink-0">Description</p>
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{part.description}</p>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col">
              <p className="text-xs text-blue-500 mb-1 shrink-0 font-semibold flex items-center gap-1">
                <ShoppingCart size={11} /> Total Sold
              </p>
              <p className="text-xl font-bold text-blue-800 break-words">{totalSold} units</p>
            </div>

            <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col">
              <p className="text-xs text-green-600 mb-1 shrink-0 font-semibold flex items-center gap-1">
                <TrendingUp size={11} /> Profit Margin (Sales)
              </p>
              <p className="text-xl font-bold text-green-800 break-words">{profitMargin}%</p>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex flex-col">
              <p className="text-xs text-emerald-600 mb-1 shrink-0 font-semibold">Markup (on Cost)</p>
              <p className="text-xl font-bold text-emerald-800 break-words">{unitMarkup}%</p>
            </div>

            <div className="bg-teal-50 p-3 rounded-xl border border-teal-100 flex flex-col">
              <p className="text-xs text-teal-600 mb-1 shrink-0 font-semibold">Margin (on Sell)</p>
              <p className="text-xl font-bold text-teal-800 break-words">{unitMargin}%</p>
            </div>
          </div>

          {/* ── Purchase / Restock History ── */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5 border-b pb-2 shrink-0">
              <History size={15} className="text-blue-600" />
              Purchase History
              <span className="text-xs text-gray-400 font-normal">(per supplier)</span>
            </h4>
            <RestockHistorySection partId={part.id} onRefresh={onPartUpdated} />
          </div>

          {/* ── Compatible Vehicles ── */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1 border-b pb-2 shrink-0">
              <Car size={16} /> Compatible Vehicles
            </h4>
            <div className="flex flex-wrap gap-2 mt-3">
              {part.compatible_vehicles && part.compatible_vehicles.length > 0 ? (
                part.compatible_vehicles.map((v, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-md border border-gray-200 truncate max-w-[150px]"
                    title={renderVehicleName(v)}
                  >
                    {renderVehicleName(v)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500 italic">Universal Fit / No specific vehicles</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PartDetailsModal;
