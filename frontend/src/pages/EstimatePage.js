import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import EstimateDocument, {
  ESTIMATE_SECTIONS,
  rowTotal,
  sectionTotal,
  estimateTotal,
} from "../components/EstimateDocument";
import AlertComponent from "../components/AlertComponent";
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

const EstimatePage = () => {
  const today = new Date().toISOString().split("T")[0];
  const [estimate, setEstimate] = useState({
    date: today,
    insuranceCompany: "",
    vehicleNumber: "",
    makeModel: "",
    validityDays: 30,
    sections: blankSections(),
  });
  const [showPreview, setShowPreview] = useState(true);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const documentRef = useRef(null);

  const setField = (field, value) => setEstimate((prev) => ({ ...prev, [field]: value }));
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

  const handlePrint = () => {
    if (!estimate.vehicleNumber.trim()) {
      setAlertInfo({ type: "error", message: "Enter the vehicle number before generating." });
      return;
    }
    if (!estimate.insuranceCompany.trim()) {
      setAlertInfo({ type: "error", message: "Enter the insurance company before generating." });
      return;
    }
    if (!hasAnyTask) {
      setAlertInfo({ type: "error", message: "Add at least one task before generating." });
      return;
    }
    // Plain window.print() + print:/print:hidden classes, matching how the POS
    // and Sales History pages print their documents.
    window.print();
  };

  const handleReset = () => {
    setEstimate({
      date: today,
      insuranceCompany: "",
      vehicleNumber: "",
      makeModel: "",
      validityDays: 30,
      sections: blankSections(),
    });
    setAlertInfo({ type: "success", message: "Estimate cleared." });
  };

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
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl text-red-700">
                <ClipboardList size={26} />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  Vehicle Repair Estimate
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
                onClick={handlePrint}
                className="flex-1 sm:flex-none justify-center px-5 py-2.5 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition shadow-lg shadow-red-200 flex items-center gap-2"
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
                  onChange={(e) => setField("vehicleNumber", e.target.value.toUpperCase())}
                  placeholder="e.g. DEA-0778"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Make &amp; Model</label>
                <input
                  value={estimate.makeModel}
                  onChange={(e) => setField("makeModel", e.target.value)}
                  placeholder="e.g. TATA Ace"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
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
              onClick={handlePrint}
              className="w-full sm:w-auto justify-center px-5 py-3 bg-red-700 text-white rounded-xl font-bold text-sm hover:bg-red-800 transition shadow-lg shadow-red-200 flex items-center gap-2"
            >
              <Printer size={16} /> <span>Generate Estimate</span>
            </button>
            <button
              onClick={handleReset}
              className="w-full sm:w-auto justify-center px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
            >
              Clear Form
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
