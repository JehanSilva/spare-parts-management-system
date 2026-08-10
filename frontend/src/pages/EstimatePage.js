import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import EstimateDocument, {
  ESTIMATE_SECTIONS,
  rowTotal,
  sectionTotal,
  estimateTotal,
  toEstimatePayload,
  fromEstimateRecord,
} from "../components/EstimateDocument";
import AlertComponent from "../components/AlertComponent";
import { fetchEstimate, createEstimate, updateEstimate, lookupVehicle } from "../services/api";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  FileText,
  Car,
  Building2,
  Eye,
  EyeOff,
  ClipboardList,
  Save,
  Loader2,
  Link2,
  UserCheck,
  PlusCircle,
} from "lucide-react";

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount || 0
  );

const emptyRow = () => ({ description: "", hours: "", rate: "" });

const blankSections = () =>
  ESTIMATE_SECTIONS.reduce((acc, s) => ({ ...acc, [s.key]: [emptyRow()] }), {});

// --- One editable task group (Removing & Refitting, Repair, Paint, ...) ---
const SectionEditor = ({ section, rows, onChange }) => {
  // Replacing items are counted per unit; the labour sections are timed.
  const isQty = section.unitLabel === "Qty";

  const updateRow = (index, field, value) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (index) =>
    onChange(rows.length === 1 ? [emptyRow()] : rows.filter((_, i) => i !== index));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 uppercase tracking-wide text-sm">{section.title}</h3>
        <span className="text-sm font-bold text-gray-700">
          LKR {formatAmount(sectionTotal(rows))}
        </span>
      </div>

      <div className="p-4">
        {/* Column captions — mirrored by the printed document */}
        <div className="hidden lg:flex gap-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <span className="flex-1">{isQty ? "Item" : "Task"} Description</span>
          <span className="w-20 text-right">{section.unitLabel}</span>
          <span className="w-28 text-right">Rate</span>
          <span className="w-28 text-right">Total</span>
          <span className="w-8" />
        </div>

        {rows.map((row, index) => (
          <div key={index} className="flex flex-col lg:flex-row gap-2 mb-4 lg:mb-2 border-b lg:border-0 border-gray-100 pb-3 lg:pb-0 last:border-0 last:pb-0">
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase text-gray-400 block lg:hidden mb-1">
                {isQty ? "Item" : "Task"} Description
              </span>
              <input
                value={row.description}
                onChange={(e) => updateRow(index, "description", e.target.value)}
                placeholder={isQty ? `Item ${index + 1} description` : `Task ${index + 1} description`}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>
            {/* Grid while stacked on small screens; from lg it switches to a
                flex row whose widths match the caption row above it exactly —
                a grid here would space the fields evenly and slide every
                caption off its own field. */}
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end w-full lg:flex lg:w-auto">
              <div className="lg:w-20">
                <span className="text-[10px] font-bold uppercase text-gray-400 block lg:hidden mb-1 truncate">
                  {section.unitLabel}
                </span>
                <input
                  value={row.hours}
                  onChange={(e) => updateRow(index, "hours", e.target.value)}
                  inputMode="decimal"
                  placeholder={isQty ? "1" : "—"}
                  title={
                    isQty
                      ? "Quantity — the line total is rate × qty"
                      : "Hours — the line total is rate × hours. Leave blank to quote a flat amount"
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
              <div className="lg:w-28">
                <span className="text-[10px] font-bold uppercase text-gray-400 block lg:hidden mb-1">
                  Rate
                </span>
                <input
                  value={row.rate}
                  onChange={(e) => updateRow(index, "rate", e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
              {/* Calculated, never typed into — styled as a read-only value
                  rather than another input box so it isn't mistaken for one. */}
              <div className="lg:w-28">
                <span className="text-[10px] font-bold uppercase text-gray-400 block lg:hidden mb-1">
                  Total
                </span>
                <div
                  title="Calculated automatically from rate and quantity"
                  className="w-full p-2 text-sm text-right font-bold text-gray-900 bg-gray-100 rounded-lg border border-dashed border-gray-300 truncate"
                >
                  {formatAmount(rowTotal(row))}
                </div>
              </div>
              <div className="lg:w-8 flex justify-center pb-1">
                <button
                  onClick={() => removeRow(index)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title={isQty ? "Remove item" : "Remove task"}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800 transition-colors"
        >
          <Plus size={16} /> Add {isQty ? "item" : "task"}
        </button>
      </div>
    </div>
  );
};

// Tells the user, while they type the plate, whether this estimate will attach
// to a vehicle already on file or register a new one when saved.
const VehicleLookupStatus = ({ lookup }) => {
  if (lookup.status === "idle") return null;

  if (lookup.status === "searching") {
    return (
      <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1.5">
        <Loader2 size={12} className="animate-spin" /> Checking the vehicle registry...
      </p>
    );
  }

  if (lookup.status === "not_found") {
    return (
      <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
        <PlusCircle size={12} className="shrink-0" />
        New vehicle — it'll be added to the registry when you save.
      </p>
    );
  }

  const owner = lookup.vehicle?.customer_details;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
        <Link2 size={12} className="shrink-0" /> Linked to a registered vehicle
      </span>
      {owner && (
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <UserCheck size={12} className="shrink-0 text-gray-400" /> {owner.name}
        </span>
      )}
    </div>
  );
};

const EstimatePage = () => {
  // Present on /estimates/:id (editing a saved estimate), absent on
  // /estimates/new (building a fresh one).
  const { id } = useParams();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const blankEstimate = useCallback(
    () => ({
      date: today,
      insuranceCompany: "",
      vehicleNumber: "",
      makeModel: "",
      validityDays: 30,
      sections: blankSections(),
    }),
    [today]
  );

  const [estimate, setEstimate] = useState(blankEstimate);
  // The id of the record this form is bound to. Set once a new estimate has
  // been saved, so a second Save updates it instead of creating a duplicate.
  const [savedId, setSavedId] = useState(id || null);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const documentRef = useRef(null);
  // Which record the form currently holds (null = a blank, unsaved one).
  const loadedIdRef = useRef(null);

  // Registry lookup for the plate being typed, mirroring POSPage.
  const [vehicleLookup, setVehicleLookup] = useState({ status: "idle", vehicle: null });
  const lookupRequestRef = useRef(0);
  // The plate the user typed, and whose registry make/model we may therefore
  // pull in. Loading a saved estimate leaves this null, so a stored Make &
  // Model is never overwritten behind the user's back.
  const autoFillPlateRef = useRef(null);

  useEffect(() => {
    const current = id || null;
    if (current === loadedIdRef.current) {
      // The form already holds this record — this fires after saving a new
      // estimate redirects to its own URL. Refetching would swap the form out
      // for a loading skeleton, which would also blank the print copy.
      setLoading(false);
      return;
    }
    if (!current) {
      // Navigating from an existing estimate back to /estimates/new.
      loadedIdRef.current = null;
      setEstimate(blankEstimate());
      setSavedId(null);
      setEstimateNumber("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchEstimate(current)
      .then((record) => {
        if (cancelled) return;
        loadedIdRef.current = record.id;
        setEstimate(fromEstimateRecord(record));
        setEstimateNumber(record.estimate_number || "");
        setSavedId(record.id);
      })
      .catch(() => {
        if (!cancelled) navigate("/estimates", { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, blankEstimate]);

  const setField = (field, value) => setEstimate((prev) => ({ ...prev, [field]: value }));

  // Look the plate up in the vehicle registry as it's typed, so the form can
  // say whether this estimate will attach to a vehicle already on file and
  // fill in its make & model.
  const vehicleNumber = estimate.vehicleNumber;
  useEffect(() => {
    const plate = vehicleNumber.trim();
    // Invalidate any request already in flight: cancelling the timer below only
    // stops ones that haven't fired, and a slow response for an older plate
    // must not clobber the current state.
    const requestId = ++lookupRequestRef.current;

    if (plate.length < 3) {
      setVehicleLookup({ status: "idle", vehicle: null });
      return;
    }

    setVehicleLookup({ status: "searching", vehicle: null });
    const timer = setTimeout(async () => {
      try {
        const result = await lookupVehicle(plate);
        if (lookupRequestRef.current !== requestId) return; // superseded by a newer edit
        if (!result.found) {
          setVehicleLookup({ status: "not_found", vehicle: null });
          return;
        }
        setVehicleLookup({ status: "found", vehicle: result.vehicle });

        const registryMakeModel = [result.vehicle.make, result.vehicle.model]
          .filter(Boolean)
          .join(" ");
        // Only for a plate the user just typed — see autoFillPlateRef.
        if (registryMakeModel && autoFillPlateRef.current === plate) {
          setEstimate((prev) => ({ ...prev, makeModel: registryMakeModel }));
        }
      } catch {
        if (lookupRequestRef.current === requestId) {
          setVehicleLookup({ status: "idle", vehicle: null });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [vehicleNumber]);

  const handleVehicleNumberChange = (value) => {
    const plate = value.toUpperCase();
    // The user is choosing this plate, so its registry details are welcome.
    autoFillPlateRef.current = plate.trim();
    setField("vehicleNumber", plate);
  };
  const setSection = (key, rows) =>
    setEstimate((prev) => ({ ...prev, sections: { ...prev.sections, [key]: rows } }));

  // Blank rows are placeholders in the editor — they must not reach the page.
  const printableEstimate = {
    ...estimate,
    sections: ESTIMATE_SECTIONS.reduce((acc, s) => {
      const rows = (estimate.sections[s.key] || []).filter(
        (r) => r.description.trim() || parseFloat(r.rate) > 0
      );
      return { ...acc, [s.key]: rows };
    }, {}),
  };

  const hasAnyTask = ESTIMATE_SECTIONS.some((s) => printableEstimate.sections[s.key].length > 0);

  const validate = () => {
    if (!estimate.vehicleNumber.trim()) return "Enter the vehicle number first.";
    if (!estimate.insuranceCompany.trim()) return "Enter the insurance company first.";
    if (!hasAnyTask) return "Add at least one task first.";
    return null;
  };

  /**
   * Persist the estimate, creating it on first save and updating it after.
   * Only the filtered rows are stored — blank placeholder rows are editor
   * scaffolding and must not reach the database. Returns the saved record, or
   * null if validation or the request failed.
   */
  const handleSave = async () => {
    const error = validate();
    if (error) {
      setAlertInfo({ type: "error", message: error });
      return null;
    }

    setSaving(true);
    try {
      const payload = toEstimatePayload(printableEstimate);
      const record = savedId
        ? await updateEstimate(savedId, payload)
        : await createEstimate(payload);

      setEstimateNumber(record.estimate_number || "");
      if (!savedId) {
        setSavedId(record.id);
        // Bind the form to the new record so the next save updates it. The ref
        // is set first so the URL change doesn't trigger a pointless refetch.
        loadedIdRef.current = record.id;
        navigate(`/estimates/${record.id}`, { replace: true });
      }
      setAlertInfo({
        type: "success",
        message: `Estimate ${record.estimate_number || ""} saved.`.replace("  ", " "),
      });
      return record;
    } catch (err) {
      setAlertInfo({
        type: "error",
        message: err.response?.data?.error || "Could not save the estimate. Please try again.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Generating always saves first, so nothing printed is ever left unrecorded.
  const handlePrint = async () => {
    const record = await handleSave();
    if (!record) return;
    // Plain window.print() + print:/print:hidden classes, matching how the POS
    // and Sales History pages print their documents.
    window.print();
  };

  const handleReset = () => {
    // Clearing a saved estimate must not blank the stored record — start a new
    // one instead, which the /estimates/new effect resets the form for.
    if (savedId) {
      navigate("/estimates/new");
      return;
    }
    setEstimate(blankEstimate());
    setAlertInfo({ type: "success", message: "Estimate cleared." });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-5">
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 print:hidden">
        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
          {alertInfo.message && (
            <AlertComponent
              type={alertInfo.type}
              message={alertInfo.message}
              onClose={() => setAlertInfo({ type: "", message: "" })}
            />
          )}

          <Link
            to="/estimates"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to Estimates
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl text-red-700">
                <ClipboardList size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {savedId ? "Edit Estimate" : "New Estimate"}
                  {estimateNumber && (
                    <span className="ml-3 align-middle text-sm font-bold text-gray-400 tracking-normal">
                      {estimateNumber}
                    </span>
                  )}
                </h1>
                <p className="text-gray-500 mt-0.5">
                  Build an insurance claim estimate on the NSS Auto Engineers letterhead.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition flex items-center gap-2"
              >
                {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showPreview ? "Hide" : "Show"} preview</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={saving}
                className="flex-1 sm:flex-none justify-center px-5 py-2.5 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition shadow-lg shadow-red-200 flex items-center gap-2 disabled:opacity-60"
              >
                <Printer size={16} /> <span>Generate Estimate</span>
              </button>
            </div>
          </div>

          {/* ── CLAIM DETAILS ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-red-700" /> Claim Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Estimate Date
                </label>
                <input
                  type="date"
                  value={estimate.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  <Building2 size={14} className="inline mr-1 -mt-0.5 text-gray-400" />
                  Insurance Company
                </label>
                <input
                  value={estimate.insuranceCompany}
                  onChange={(e) => setField("insuranceCompany", e.target.value)}
                  placeholder="e.g. Amana Takaful Insurance"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  <Car size={14} className="inline mr-1 -mt-0.5 text-gray-400" />
                  Vehicle Number
                </label>
                <input
                  value={estimate.vehicleNumber}
                  onChange={(e) => handleVehicleNumberChange(e.target.value)}
                  placeholder="e.g. DEA-0778"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <VehicleLookupStatus lookup={vehicleLookup} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Make &amp; Model</label>
                <input
                  value={estimate.makeModel}
                  onChange={(e) => setField("makeModel", e.target.value)}
                  placeholder="e.g. TATA Ace"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Filled in from the vehicle registry — edit it for this estimate if it's wrong.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Valid For (days)
                </label>
                <input
                  value={estimate.validityDays}
                  onChange={(e) => setField("validityDays", e.target.value)}
                  inputMode="numeric"
                  className="w-full md:w-40 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── TASK SECTIONS ─────────────────────────────────────────── */}
          {ESTIMATE_SECTIONS.map((section) => (
            <SectionEditor
              key={section.key}
              section={section}
              rows={estimate.sections[section.key]}
              onChange={(rows) => setSection(section.key, rows)}
            />
          ))}

          {/* ── TOTAL ─────────────────────────────────────────────────── */}
          <div className="bg-gray-900 text-white rounded-2xl px-6 py-5 flex items-center justify-between mb-8">
            <span className="font-bold uppercase tracking-wide">Estimate Total</span>
            <span className="text-2xl font-black">
              LKR {formatAmount(estimateTotal(estimate.sections))}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto justify-center px-5 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{savedId ? "Save Changes" : "Save Estimate"}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={saving}
              className="w-full sm:w-auto justify-center px-5 py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition shadow-lg shadow-red-200 flex items-center gap-2 disabled:opacity-60"
            >
              <Printer size={16} /> <span>Generate Estimate</span>
            </button>
            <button
              onClick={handleReset}
              className="w-full sm:w-auto justify-center px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
            >
              {savedId ? "Start a New Estimate" : "Clear Form"}
            </button>
          </div>

          {/* ── LIVE PREVIEW ──────────────────────────────────────────── */}
          {showPreview && (
            <div className="mb-10">
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Eye size={18} className="text-red-700" /> Preview
              </h2>
              <div className="bg-gray-200 rounded-2xl p-4 overflow-x-auto">
                {/* The A4 sheet is 794px wide. `zoom` rather than a transform
                    so the shrunken sheet still occupies its real height in the
                    layout — an estimate can run past one page. */}
                <div className="mx-auto shadow-xl bg-white w-fit" style={{ zoom: 0.62 }}>
                  <EstimateDocument estimate={printableEstimate} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print copy — hidden on screen, the only thing window.print() emits. */}
      <div className="hidden print:block">
        <EstimateDocument ref={documentRef} estimate={printableEstimate} />
      </div>
    </>
  );
};

export default EstimatePage;
