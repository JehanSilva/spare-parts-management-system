import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchEstimates, deleteEstimate } from "../services/api";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Car,
  Building2,
  Link2,
  Link2Off,
} from "lucide-react";

const formatLKR = (amount) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-LK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const EstimateListPage = () => {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [estimateToDelete, setEstimateToDelete] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // Debounced server-side search, mirroring the vehicle registry page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchEstimates(searchTerm)
        .then(setEstimates)
        .catch(() => setEstimates([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDelete = async () => {
    const target = estimateToDelete;
    if (!target) return;
    try {
      await deleteEstimate(target.id);
      setEstimates((prev) => prev.filter((e) => e.id !== target.id));
      setAlertInfo({
        type: "success",
        message: `Estimate ${target.estimate_number} deleted.`,
      });
    } catch (error) {
      setAlertInfo({
        type: "error",
        message: error.response?.data?.error || "Could not delete the estimate.",
      });
    } finally {
      setEstimateToDelete(null);
    }
  };

  const openEstimate = (estimate) => navigate(`/estimates/${estimate.id}`);

  // The plate is auto-registered on save, so an unlinked estimate only happens
  // when the vehicle was later removed from the registry.
  const VehicleLink = ({ estimate }) =>
    estimate.vehicle ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
        <Link2 size={9} /> Linked
      </span>
    ) : (
      <span
        title="This vehicle is no longer in the registry"
        className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
      >
        <Link2Off size={9} /> Not linked
      </span>
    );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto w-full">
        {alertInfo.message && (
          <AlertComponent
            type={alertInfo.type}
            message={alertInfo.message}
            onClose={() => setAlertInfo({ type: "", message: "" })}
          />
        )}

        <ConfirmModal
          isOpen={!!estimateToDelete}
          title="Delete this estimate?"
          message={
            estimateToDelete
              ? `${estimateToDelete.estimate_number} for ${estimateToDelete.vehicle_number} will be permanently removed. This cannot be undone.`
              : ""
          }
          onConfirm={handleDelete}
          onCancel={() => setEstimateToDelete(null)}
        />

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl text-red-700">
              <ClipboardList size={26} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Saved Estimates
              </h1>
              <p className="text-gray-500 mt-0.5">
                Every insurance claim estimate you've created, ready to reopen, edit or reprint.
              </p>
            </div>
          </div>

          <Link
            to="/estimates/new"
            className="justify-center px-5 py-2.5 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition shadow-lg shadow-red-200 flex items-center gap-2 shrink-0"
          >
            <Plus size={16} /> <span>New Estimate</span>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by reference, plate, insurer or model..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-600">
              {searchTerm ? "No estimates match that search." : "No estimates saved yet."}
            </p>
            {!searchTerm && (
              <Link
                to="/estimates/new"
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-red-700 hover:text-red-800"
              >
                <Plus size={16} /> Create your first estimate
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-4">
              {estimates.map((estimate) => (
                <div
                  key={estimate.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-400">
                          {estimate.estimate_number}
                        </span>
                        <VehicleLink estimate={estimate} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 tracking-wide mt-1 truncate">
                        {estimate.vehicle_number}
                      </h3>
                      <p className="text-xs text-gray-500">{estimate.make_model || "—"}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 shrink-0">
                      {formatLKR(estimate.total_amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
                    <Building2 size={12} className="text-gray-400 shrink-0" />
                    <span className="truncate">{estimate.insurance_company}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(estimate.date)}</p>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => openEstimate(estimate)}
                      className="flex-1 justify-center flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Pencil size={12} /> Open &amp; Edit
                    </button>
                    <button
                      onClick={() => setEstimateToDelete(estimate)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete estimate"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-bold">Reference</th>
                    <th className="px-5 py-3 font-bold">Vehicle</th>
                    <th className="px-5 py-3 font-bold">Insurance Company</th>
                    <th className="px-5 py-3 font-bold">Date</th>
                    <th className="px-5 py-3 font-bold text-right">Total</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {estimates.map((estimate) => (
                    <tr
                      key={estimate.id}
                      onClick={() => openEstimate(estimate)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-bold text-gray-700 whitespace-nowrap">
                        {estimate.estimate_number}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Car size={14} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 tracking-wide">
                                {estimate.vehicle_number}
                              </span>
                              <VehicleLink estimate={estimate} />
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {estimate.make_model || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{estimate.insurance_company}</td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                        {formatDate(estimate.date)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900 whitespace-nowrap">
                        {formatLKR(estimate.total_amount)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEstimate(estimate);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
                            title="Open and edit"
                          >
                            Edit <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEstimateToDelete(estimate);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete estimate"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EstimateListPage;
