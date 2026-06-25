import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { fetchRestockHistory } from "../services/api";

const formatLKR = (val) =>
  `LKR ${parseFloat(val || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Restock History Section ──────────────────────────────────────────────────
const RestockHistorySection = ({ partId }) => {
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
      <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 shrink-0" />
        Loading purchase history…
      </div>
    );
  }

  if (!records.length) {
    return (
      <p className="text-sm text-gray-400 italic py-3">
        No restock history recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-3">
      {records.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-blue-100 text-blue-700 rounded-lg p-2 shrink-0">
              <Truck size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">
                {r.supplier_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(r.restocked_at).toLocaleDateString("en-LK", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                {r.notes ? ` · ${r.notes}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-sm font-black text-blue-700">+{r.quantity} units</p>
            <p className="text-xs font-semibold text-gray-600">{formatLKR(r.buy_price)} each</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const PartDetailsModal = ({ part, onClose }) => {
  if (!part) return null;

  // Helper to render vehicle name safely from Object or ID
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return v.year ? `${v.year} ${v.make} ${v.model}` : `${v.make} ${v.model}`;
    }
    return "Vehicle";
  };

  // Calculate profit margin based on past sales (accounting for discounts)
  const totalSold = part.total_sold || 0;
  const totalRevenue = parseFloat(part.total_revenue || 0);
  const totalCost = parseFloat(part.total_cost || 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin =
    totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  // Calculate profit metrics based on buy and sell price (without past sales)
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
          <button
            onClick={onClose}
            className="hover:bg-red-600 p-1 rounded-full transition-colors"
          >
            <XCircle size={20} />
          </button>
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
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                    Low
                  </span>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 shrink-0">
                <MapPin size={12} /> Location
              </p>
              <p className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                {part.rack_location || "N/A"}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 shrink-0">Avg Buy Price</p>
              <p className="text-lg font-bold text-gray-800 break-words">
                {formatLKR(part.buy_price)}
              </p>
            </div>

            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
              <p className="text-xs text-red-500 mb-1 font-semibold shrink-0">Sell Price</p>
              <p className="text-lg font-bold text-red-700 break-words">
                {formatLKR(part.sell_price)}
              </p>
            </div>

            {/* Primary supplier */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 mb-1 shrink-0">Primary Supplier</p>
              <p className="text-md font-bold text-gray-800 break-words">
                {part.supplier_details?.name || "N/A"}
              </p>
            </div>

            {part.description && (
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500 mb-1 shrink-0">Description</p>
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                  {part.description}
                </p>
              </div>
            )}

            {/* Sales & profit */}
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
              <p className="text-xs text-emerald-600 mb-1 shrink-0 font-semibold">
                Markup (on Cost)
              </p>
              <p className="text-xl font-bold text-emerald-800 break-words">{unitMarkup}%</p>
            </div>

            <div className="bg-teal-50 p-3 rounded-xl border border-teal-100 flex flex-col">
              <p className="text-xs text-teal-600 mb-1 shrink-0 font-semibold">
                Margin (on Sell)
              </p>
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
            <RestockHistorySection partId={part.id} />
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
                <span className="text-sm text-gray-500 italic">
                  Universal Fit / No specific vehicles
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PartDetailsModal;
