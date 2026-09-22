import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, ClipboardCheck, Car } from "lucide-react";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import { ratingTone } from "../components/inspectionSchema";
import { fetchInspections, deleteInspection } from "../services/api";
import { apiErrorMessage } from "../components/apiErrorMessage";

const PILL_CLASS = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-red-50 text-red-700 border-red-200",
  none: "bg-gray-50 text-gray-400 border-gray-200",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const RatingPill = ({ value }) => {
  const pct = parseFloat(value);
  const tone = Number.isNaN(pct) || pct === 0 ? "none" : ratingTone(pct);
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${PILL_CLASS[tone]}`}>
      {Number.isNaN(pct) || pct === 0 ? "—" : `${pct.toFixed(1)}%`}
    </span>
  );
};

const InspectionListPage = () => {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  const load = useCallback(async (search) => {
    setLoading(true);
    try {
      setInspections(await fetchInspections(search));
    } catch (err) {
      setAlertInfo({ type: "error", message: apiErrorMessage(err, "Could not load inspections.") });
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing a plate doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => load(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, load]);

  const confirmDelete = async () => {
    try {
      await deleteInspection(pendingDelete.id);
      setAlertInfo({ type: "success", message: `Inspection ${pendingDelete.inspection_number} deleted.` });
      load(searchTerm.trim());
    } catch (err) {
      setAlertInfo({ type: "error", message: apiErrorMessage(err, "Could not delete this inspection.") });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <AlertComponent
        type={alertInfo.type}
        message={alertInfo.message}
        onClose={() => setAlertInfo({ type: "", message: "" })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Vehicle Inspections</h1>
          <p className="text-xs text-gray-500">Inspection sheets and their printed reports</p>
        </div>
        <Link
          to="/inspections/new"
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5"
        >
          <Plus size={16} /> New Inspection
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by number, plate, chassis, customer or inspector…"
          className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
          ))}
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ClipboardCheck size={34} className="mx-auto text-gray-300" />
          <p className="mt-3 text-gray-500 text-sm">
            {searchTerm ? "No inspections match that search." : "No inspections recorded yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {inspections.map((record) => (
            <div
              key={record.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/inspections/${record.id}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/inspections/${record.id}`)}
              className="bg-white rounded-2xl border border-gray-200 hover:border-gray-400 transition-colors p-3 flex items-center gap-4 cursor-pointer"
            >
              <div className="w-20 h-16 shrink-0 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                {record.front_image ? (
                  <img src={record.front_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Car size={20} className="text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">{record.vehicle_number || "—"}</span>
                  <span className="text-xs text-gray-400">#{record.inspection_number}</span>
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {record.make_model || "—"}
                  {record.customer_name ? ` · ${record.customer_name}` : ""}
                </div>
                <div className="text-xs text-gray-400">
                  {formatDate(record.date)}
                  {record.inspector_name ? ` · ${record.inspector_name}` : ""}
                </div>
              </div>

              <RatingPill value={record.overall_rating} />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(record);
                }}
                className="p-2 text-gray-300 hover:text-red-600 shrink-0"
                aria-label="Delete inspection"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Delete this inspection?"
        message={
          pendingDelete
            ? `Inspection ${pendingDelete.inspection_number} for ${pendingDelete.vehicle_number} will be permanently deleted.`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default InspectionListPage;
