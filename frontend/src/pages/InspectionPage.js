import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, Printer, Plus, Trash2, Eye, EyeOff, Check, Upload, X, Wand2, List,
  Loader2, Link2, UserCheck, PlusCircle, AlertTriangle,
} from "lucide-react";
import AlertComponent from "../components/AlertComponent";
import InspectionDocument, {
  toInspectionFormData, fromInspectionRecord, blankInspection, answeredCount,
} from "../components/InspectionDocument";
import {
  INSPECTION_CATEGORIES, SYSTEM_SCAN_MODULES, SCAN_OPTIONS, DTC_STATUS_OPTIONS,
  DTC_MODULES, FUEL_TYPES, TONE_CLASS, valueTone, overallRating, emptyDtcRow,
  blankSystemScan,
  optionsFor,
  emptyCustomField,
  CUSTOM_FIELD_OPTIONS,
  isSectionExcluded,
  ratingTone,
} from "../components/inspectionSchema";
import { createInspection, updateInspection, fetchInspection, lookupVehicle } from "../services/api";
import { customerDisplayName } from "../components/customerName";
import { apiErrorMessage } from "../components/apiErrorMessage";

// The steps of the sheet, in the order they're worked through: the eleven
// inspection categories, then the two scan sections, then the ratings summary.
const EXTRA_STEPS = [
  { key: "__scan", title: "System Scan" },
  { key: "__dtc", title: "Fault Codes" },
  { key: "__ratings", title: "Ratings" },
];
const STEPS = [...INSPECTION_CATEGORIES, ...EXTRA_STEPS];

// Phone photos run to several megabytes each and two of them make the save feel
// broken — and every print goes through a save first. Redraw to a sane longest
// edge before uploading; the report prints them about 90mm wide.
const MAX_PHOTO_EDGE = 1600;

const downscaleImage = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
      if (scale === 1) return resolve(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.82
      );
    };
    // A file the browser can't decode is sent as-is and left to the server.
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

// --- Small page-local form pieces --------------------------------------------

const Field = ({ label, id, children }) => (
  <div>
    <label
      htmlFor={id}
      className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1"
    >
      {label}
    </label>
    {children}
  </div>
);

const inputClass =
  "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 focus:bg-white transition-colors";

const TextField = ({ label, id, ...props }) => (
  <Field label={label} id={id}>
    <input id={id} className={inputClass} {...props} />
  </Field>
);

const SelectField = ({ label, id, options, placeholder = "—", ...props }) => (
  <Field label={label} id={id}>
    <select id={id} className={inputClass} {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </Field>
);

// The two vehicle photos. Hidden input behind a label, the dropzone pattern
// AddPartForm already uses — including paste, since an inspector photographing
// on a phone often ends up with the image on the clipboard.
const PhotoDropzone = ({ id, caption, value, onPick, onClear }) => {
  const preview = useMemo(
    () => (value instanceof File ? URL.createObjectURL(value) : value),
    [value]
  );

  // A blob URL made for a preview has to be handed back, or the image stays in
  // memory for the life of the tab.
  useEffect(() => {
    if (value instanceof File && preview) return () => URL.revokeObjectURL(preview);
  }, [value, preview]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {caption}
        </span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files[0] && onPick(e.target.files[0])}
      />
      <label
        htmlFor={id}
        className="block cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:border-gray-400 transition-colors overflow-hidden"
        style={{ aspectRatio: "4 / 3" }}
      >
        {preview ? (
          <img src={preview} alt={caption} className="w-full h-full object-cover" />
        ) : (
          <span className="h-full flex flex-col items-center justify-center text-gray-400 gap-1">
            <Upload size={20} />
            <span className="text-xs">Add {caption.toLowerCase()} photo</span>
            <span className="text-[10px]">or paste (Ctrl+V)</span>
          </span>
        )}
      </label>
    </div>
  );
};

// Tells the inspector, while they type the plate, whether this sheet will
// attach to a vehicle already on file or file a new one when saved. Mirrors
// the estimate builder's VehicleLookupStatus.
const VehicleLookupStatus = ({ lookup }) => {
  if (lookup.status === "idle") return null;

  if (lookup.status === "searching") {
    return (
      <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1.5">
        <Loader2 size={12} className="animate-spin" /> Checking the vehicle registry…
      </p>
    );
  }

  if (lookup.status === "not_found") {
    return (
      <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
        <PlusCircle size={12} className="shrink-0" />
        New vehicle — it&rsquo;ll be added to the registry when you save.
      </p>
    );
  }

  const owner = lookup.vehicle?.customer_details;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
        <Link2 size={12} className="shrink-0" /> Details filled from the registry
      </span>
      {owner && (
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <UserCheck size={12} className="shrink-0 text-gray-400" /> {customerDisplayName(owner)}
        </span>
      )}
    </div>
  );
};

// A value-identity of the sheet, used only to tell "changed since the last
// save" from "untouched". Keys are sorted so the comparison can't be upset by
// two objects carrying the same data in a different insertion order, and a
// picked photo is identified by name and size because a File has no value to
// compare.
const stableShape = (value) => {
  if (Array.isArray(value)) return value.map(stableShape);
  if (value && typeof value === "object" && !(value instanceof File)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: stableShape(value[key]) }), {});
  }
  return value;
};

const fingerprint = (inspection) => {
  const photo = (v) => (v instanceof File ? `file:${v.name}:${v.size}:${v.lastModified}` : v || "");
  return JSON.stringify(
    stableShape({ ...inspection, frontImage: photo(inspection.frontImage), rearImage: photo(inspection.rearImage) })
  );
};

// Leaving with unsaved work is the one thing that can lose a sheet outright,
// so it asks rather than warns — and offers to do the save itself.
const LeavePrompt = ({ open, saving, onSave, onDiscard, onStay }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </div>
          <h3 className="font-bold text-gray-900">Unsaved changes</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            This inspection has changes that haven&rsquo;t been saved. Leaving now discards them.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save and leave"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Section-level controls ---------------------------------------------------

// Not every section applies to every vehicle — an EV has no clutch, a small car
// no 4x4. Switching one off keeps whatever is already entered but leaves it off
// the report and out of the Overall Rating average.
const SectionToggle = ({ included, onChange }) => (
  <label
    className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none ${
      included ? "text-gray-600 hover:text-gray-900" : "text-gray-400"
    }`}
  >
    <input
      type="checkbox"
      checked={included}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded border-gray-300 text-gray-900 focus:ring-gray-400"
    />
    Include in report
  </label>
);

// Picking "Other…" swaps the dropdown for a text box, which is the only way to
// record something the standard vocabulary can't say ("78%", "2 of 4 fitted").
const OTHER_VALUE = "__other";

const CustomFieldsEditor = ({ rows, onChange, sectionTitle }) => {
  const setRow = (index, patch) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Additional items</h3>
          <p className="text-xs text-gray-500">
            Anything on this vehicle the standard {sectionTitle.toLowerCase()} list
            doesn&rsquo;t cover.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, emptyCustomField()])}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1 shrink-0"
        >
          <Plus size={13} /> Add field
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No additional items.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                placeholder="Item name"
                className={`${inputClass} flex-1`}
              />
              {row.free ? (
                <div className="flex gap-1 w-44 shrink-0">
                  <input
                    value={row.value}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                    placeholder="Value"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setRow(i, { free: false, value: "" })}
                    className="p-2 text-gray-400 hover:text-gray-900 shrink-0"
                    title="Pick from the standard list instead"
                  >
                    <List size={15} />
                  </button>
                </div>
              ) : (
                <select
                  value={row.value}
                  onChange={(e) =>
                    e.target.value === OTHER_VALUE
                      ? setRow(i, { free: true, value: "" })
                      : setRow(i, { value: e.target.value })
                  }
                  className={`${inputClass} w-44 shrink-0 font-semibold ${
                    TONE_CLASS[valueTone(row.value)]
                  }`}
                >
                  <option value="">—</option>
                  {CUSTOM_FIELD_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  <option value={OTHER_VALUE}>Other…</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="p-2 text-gray-400 hover:text-red-600 shrink-0"
                aria-label="Remove field"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Step bodies -------------------------------------------------------------

const CategoryStep = ({ category, values, ratingValue, recommendation, customRows, included, onSet, onFillRest, onClear, onRating, onRecommendation, onCustomRows, onIncluded }) => {
  // The rating the components already imply: how many answered verdicts were
  // sound. Offered as a starting figure, never written without being asked for.
  const suggestion = useMemo(() => {
    const answered = category.components
      .map((c) => [c, (values?.[c.key] || "").trim()])
      .filter(([, v]) => v);
    if (!answered.length) return null;
    const good = answered.filter(([c, v]) => valueTone(v, c.options) === "good").length;
    return Math.round((100 * good) / answered.length);
  }, [category, values]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">{category.title}</h2>
          <SectionToggle included={included} onChange={onIncluded} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onFillRest}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
          >
            <Check size={13} /> Fill rest as normal
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
        {category.components.map((comp) => {
          const value = values?.[comp.key] || "";
          return (
            <label
              key={comp.key}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50"
            >
              <span className="text-sm text-gray-700">{comp.label}</span>
              <select
                value={value}
                onChange={(e) => onSet(comp.key, e.target.value)}
                className={`w-40 shrink-0 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-gray-900 focus:bg-white ${TONE_CLASS[valueTone(value, comp.options)]}`}
              >
                <option value="">—</option>
                {optionsFor(comp.options).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      {/* The rating and the write-up for this system sit with its components,
          where the inspector's attention already is. */}
      <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
        <Field label="Rating for this system" id={`rating-${category.key}`}>
          <div className="flex items-center gap-2">
            <input
              id={`rating-${category.key}`}
              type="number"
              min="0"
              max="100"
              value={ratingValue}
              onChange={(e) => onRating(e.target.value)}
              className={`${inputClass} font-bold ${TONE_CLASS[ratingTone(ratingValue)]}`}
              placeholder="—"
            />
            <span className="text-gray-400 font-bold">%</span>
          </div>
          {suggestion !== null && String(suggestion) !== String(ratingValue) && (
            <button
              type="button"
              onClick={() => onRating(String(suggestion))}
              className="mt-1.5 text-[11px] text-gray-500 hover:text-gray-900 flex items-center gap-1"
            >
              <Wand2 size={12} /> Suggest {suggestion}%
            </button>
          )}
        </Field>

        <Field label="Required maintenance & recommendations" id={`rec-${category.key}`}>
          <textarea
            id={`rec-${category.key}`}
            rows={4}
            value={recommendation}
            onChange={(e) => onRecommendation(e.target.value)}
            className={inputClass}
            placeholder={`Defects found, work needed, or preventative maintenance for the ${category.title.toLowerCase()}.`}
          />
        </Field>
      </div>

      <CustomFieldsEditor
        rows={customRows}
        onChange={onCustomRows}
        sectionTitle={category.title}
      />
    </div>
  );
};

const ScanStep = ({ values, customRows, included, onSet, onFillRest, onClear, onCustomRows, onIncluded }) => (
  <div>
    <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h2 className="text-lg font-bold text-gray-900">System Scan Summary</h2>
          <SectionToggle included={included} onChange={onIncluded} />
        </div>
        <p className="text-sm text-gray-500">
          The verdict the diagnostic tool returned for each control module.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onFillRest}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
        >
          <Check size={13} /> Fill rest as normal
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Clear
        </button>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
      {SYSTEM_SCAN_MODULES.map((mod) => (
        <label
          key={mod.key}
          className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50"
        >
          <span className="text-sm text-gray-700">{mod.label}</span>
          <select
            value={values?.[mod.key] || ""}
            onChange={(e) => onSet(mod.key, e.target.value)}
            className={`w-40 shrink-0 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-gray-900 focus:bg-white ${TONE_CLASS[valueTone(values?.[mod.key])]}`}
          >
            <option value="">—</option>
            {SCAN_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      ))}
    </div>

    <CustomFieldsEditor
      rows={customRows}
      onChange={onCustomRows}
      sectionTitle="System Scan"
    />
  </div>
);

const DtcStep = ({ rows, included, onChange, onIncluded }) => {
  const setRow = (index, patch) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  // One blank row always stays, so there is something to type into.
  const removeRow = (index) =>
    onChange(rows.length === 1 ? [emptyDtcRow()] : rows.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Diagnostic Trouble Codes</h2>
        <SectionToggle included={included} onChange={onIncluded} />
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Active and stored fault codes read during the scan. Blank rows are not saved.
      </p>

      <div className="hidden lg:flex gap-3 px-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        <span className="w-28">Code</span>
        <span className="w-36">Module</span>
        <span className="flex-1">Description</span>
        <span className="w-28">Status</span>
        <span className="w-8" />
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr] lg:flex gap-2 lg:gap-3 lg:items-center p-2 lg:p-0 rounded-xl bg-gray-50 lg:bg-transparent"
          >
            <input
              value={row.code}
              onChange={(e) => setRow(i, { code: e.target.value.toUpperCase() })}
              placeholder="P0300"
              className={`${inputClass} lg:w-28 font-mono uppercase`}
            />
            <select
              value={row.module}
              onChange={(e) => setRow(i, { module: e.target.value })}
              className={`${inputClass} lg:w-36`}
            >
              <option value="">Module</option>
              {DTC_MODULES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              value={row.description}
              onChange={(e) => setRow(i, { description: e.target.value })}
              placeholder="Random/Multiple Cylinder Misfire Detected"
              className={`${inputClass} col-span-2 lg:flex-1`}
            />
            <select
              value={row.status}
              onChange={(e) => setRow(i, { status: e.target.value })}
              className={`${inputClass} lg:w-28`}
            >
              {DTC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="lg:w-8 shrink-0 p-2 text-gray-400 hover:text-red-600 flex justify-center"
              aria-label="Remove code"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, emptyDtcRow()])}
        className="mt-3 px-3 py-2 text-sm font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"
      >
        <Plus size={15} /> Add code
      </button>
    </div>
  );
};

const RatingsStep = ({ ratings, excludedSections, onRating }) => {
  const overall = overallRating(ratings, excludedSections);
  // A sheet with nothing scored yet shows a dash rather than a hard 0.00%,
  // which would read as a verdict rather than an absence.
  const hasAnyRating = INSPECTION_CATEGORIES.some(
    (cat) =>
      !isSectionExcluded(excludedSections, cat.key) &&
      !Number.isNaN(parseFloat(ratings?.[cat.key]))
  );
  return (
    <div>
      {/* The figure sits on the heading line, where the printed report puts
          it, so the editor and the sheet agree on where to look for it. */}
      <div className="flex items-baseline justify-between gap-4 border-b border-black pb-1 mb-1">
        <h2 className="text-lg font-bold text-gray-900">Vehicle Rating</h2>
        <span className="flex items-baseline gap-2 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500">
            Overall
          </span>
          <span className={`text-2xl font-bold leading-none ${TONE_CLASS[ratingTone(overall)]}`}>
            {hasAnyRating ? `${overall.toFixed(2)}%` : "—"}
          </span>
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Each system&rsquo;s score, as entered on its own step. The overall figure is their average
        and is recalculated on the server when the sheet is saved.
      </p>

      <div className="space-y-1">
        {INSPECTION_CATEGORIES.map((cat) => {
          const value = ratings?.[cat.key] ?? "";
          const included = !isSectionExcluded(excludedSections, cat.key);
          return (
            <div key={cat.key} className="flex items-center gap-3 py-1 border-b border-gray-50">
              {/* An excluded section stays editable — it is only struck
                  through, and its figure sits out of the average below. */}
              <span
                className={`flex-1 text-sm ${
                  included ? "text-gray-700" : "text-gray-400 line-through decoration-gray-300"
                }`}
              >
                {cat.title}
              </span>
              <input
                type="number"
                min="0"
                max="100"
                value={value}
                onChange={(e) => onRating(cat.key, e.target.value)}
                placeholder="—"
                className={`w-24 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-right font-bold focus:outline-none focus:border-gray-900 focus:bg-white ${TONE_CLASS[ratingTone(value)]}`}
              />
              <span className="text-gray-400 text-sm w-3">%</span>
            </div>
          );
        })}
      </div>

    </div>
  );
};

// --- The page ----------------------------------------------------------------

const InspectionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inspection, setInspection] = useState(blankInspection);
  const [savedId, setSavedId] = useState(id || null);
  const [inspectionNumber, setInspectionNumber] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(INSPECTION_CATEGORIES[0].key);
  const [showPreview, setShowPreview] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const documentRef = useRef(null);
  const loadedIdRef = useRef(null);
  // Registry lookup for the plate being typed, mirroring EstimatePage.
  const [vehicleLookup, setVehicleLookup] = useState({ status: "idle", vehicle: null });
  const lookupRequestRef = useRef(0);
  // The plate the inspector typed, and whose registry details may therefore be
  // pulled in. Opening a saved inspection leaves this null, so a sheet's stored
  // vehicle details are never rewritten behind their back.
  const autoFillPlateRef = useRef(null);
  const [leavePrompt, setLeavePrompt] = useState(false);
  // The sheet as it last stood on the server. blankInspection() stamps today's
  // date and time, so the baseline has to come from the actual initial state
  // rather than a second call to it.
  const savedFingerprintRef = useRef(null);
  if (savedFingerprintRef.current === null) savedFingerprintRef.current = fingerprint(inspection);

  // Rendering six A4 pages on every keystroke would make the selects lag, and
  // nobody is reading the preview mid-edit. Let it fall behind the form.
  const deferred = useDeferredValue(inspection);

  useEffect(() => {
    // Saving a new sheet replaces the URL with its id, which would otherwise
    // re-run this effect and overwrite what's on screen. Same guard as the
    // estimate builder.
    const current = id || null;

    if (current === loadedIdRef.current) {
      // The form already holds this record — this fires after saving a new
      // inspection redirects to its own URL. Refetching would swap the form
      // out for a skeleton and blank the print copy with it.
      setLoading(false);
      return;
    }

    if (!current) {
      // Navigating from a saved inspection back to /inspections/new.
      loadedIdRef.current = null;
      const blank = blankInspection();
      savedFingerprintRef.current = fingerprint(blank);
      setInspection(blank);
      setSavedId(null);
      setInspectionNumber("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchInspection(current)
      .then((record) => {
        if (cancelled) return;
        // Claimed only once the record is actually on screen. Claiming it
        // before the fetch resolves lets StrictMode's remount skip the
        // refetch while the first run's result is thrown away as cancelled,
        // which leaves the page stuck on its skeleton forever.
        loadedIdRef.current = record.id;
        const loaded = fromInspectionRecord(record);
        savedFingerprintRef.current = fingerprint(loaded);
        setInspection(loaded);
        setInspectionNumber(record.inspection_number || "");
        setSavedId(record.id);
      })
      .catch((err) =>
        setAlertInfo({ type: "error", message: apiErrorMessage(err, "Could not load this inspection.") })
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  // Paste a photo straight into whichever slot is still empty — front first.
  useEffect(() => {
    const onPaste = async (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const resized = await downscaleImage(file);
      setInspection((prev) =>
        prev.frontImage ? { ...prev, rearImage: resized } : { ...prev, frontImage: resized }
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Look the plate up in the registry as it is typed, so the sheet can say
  // whether it will attach to a vehicle already on file and fill in what that
  // vehicle already knows.
  const vehicleNumber = inspection.vehicleNumber;
  useEffect(() => {
    const plate = vehicleNumber.trim();
    // Invalidate anything already in flight: clearing the timer below only
    // stops requests that haven't fired, and a slow answer for an older plate
    // must not overwrite the current state.
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

        // Only for a plate the inspector just typed — see autoFillPlateRef.
        if (autoFillPlateRef.current !== plate) return;

        const v = result.vehicle;
        const registryMakeModel = [v.make, v.model].filter(Boolean).join(" ");
        const owner = v.customer_details;
        // The registry is the standing record of the vehicle, so what it holds
        // wins. It can only fill, never blank: a field the registry has
        // nothing for is left exactly as typed.
        setInspection((prev) => ({
          ...prev,
          ...(registryMakeModel ? { makeModel: registryMakeModel } : {}),
          ...(v.year ? { year: String(v.year) } : {}),
          ...(v.chassis_number ? { chassisNumber: v.chassis_number } : {}),
          ...(v.fuel_type ? { fuelType: v.fuel_type } : {}),
          ...(v.current_mileage ? { mileage: String(v.current_mileage) } : {}),
          ...(owner?.name ? { customerName: customerDisplayName(owner) } : {}),
        }));
      } catch {
        if (lookupRequestRef.current === requestId) {
          setVehicleLookup({ status: "idle", vehicle: null });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [vehicleNumber]);

  const setField = (field, value) => setInspection((prev) => ({ ...prev, [field]: value }));

  const handlePlateChange = (value) => {
    const plate = value.toUpperCase();
    // The inspector is choosing this plate, so its registry details are welcome.
    autoFillPlateRef.current = plate.trim();
    setField("vehicleNumber", plate);
  };

  const setComponent = (categoryKey, componentKey, value) =>
    setInspection((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [categoryKey]: { ...prev.checklist[categoryKey], [componentKey]: value },
      },
    }));

  const setRating = (categoryKey, value) =>
    setInspection((prev) => ({ ...prev, ratings: { ...prev.ratings, [categoryKey]: value } }));

  const setRecommendation = (categoryKey, value) =>
    setInspection((prev) => ({
      ...prev,
      recommendations: { ...prev.recommendations, [categoryKey]: value },
    }));

  // On a car with nothing wrong, most of a category is "Normal" — fill the
  // blanks in one go and let the inspector correct the handful that differ.
  // Only untouched components are written, so it can't undo real findings.
  const fillRestAsNormal = (category) =>
    setInspection((prev) => {
      const current = prev.checklist[category.key] || {};
      const filled = { ...current };
      category.components.forEach((comp) => {
        if (!(filled[comp.key] || "").trim()) {
          filled[comp.key] = optionsFor(comp.options).find((o) => valueTone(o, comp.options) === "good") || "";
        }
      });
      return { ...prev, checklist: { ...prev.checklist, [category.key]: filled } };
    });

  // The scan equivalent of fillRestAsNormal. Every module shares one option
  // set, so the sound verdict is looked up once rather than per component.
  const fillScanAsNormal = () =>
    setInspection((prev) => {
      const good = SCAN_OPTIONS.find((o) => valueTone(o) === "good") || "";
      const filled = { ...prev.systemScan };
      SYSTEM_SCAN_MODULES.forEach((mod) => {
        if (!(filled[mod.key] || "").trim()) filled[mod.key] = good;
      });
      return { ...prev, systemScan: filled };
    });

  const clearScan = () => setInspection((prev) => ({ ...prev, systemScan: blankSystemScan() }));

  // Blank the catalog values in place rather than rebuilding the category from
  // the schema — rebuilding would silently drop any key the catalog doesn't
  // know about, which is exactly what a custom field is.
  const clearCategory = (category) =>
    setInspection((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [category.key]: category.components.reduce(
          (acc, c) => ({ ...acc, [c.key]: "" }),
          { ...prev.checklist[category.key] }
        ),
      },
    }));

  const setCustomRows = (sectionKey, rows) =>
    setInspection((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [sectionKey]: rows },
    }));

  // Stored as exclusions, so a section is in the report unless it was
  // deliberately switched off.
  const setSectionIncluded = (sectionKey, included) =>
    setInspection((prev) => ({
      ...prev,
      excludedSections: included
        ? (prev.excludedSections || []).filter((k) => k !== sectionKey)
        : [...new Set([...(prev.excludedSections || []), sectionKey])],
    }));

  const sectionIncluded = (sectionKey) =>
    !isSectionExcluded(inspection.excludedSections, sectionKey);

  const pickPhoto = async (field, file) => setField(field, await downscaleImage(file));

  const validate = () => {
    // The plate is the only hard requirement: it is what the sheet is filed
    // against and what the registry link resolves from. Components are filled
    // in while the car is worked through — often across more than one sitting
    // — so an empty checklist is a normal starting point, not an error.
    if (!inspection.vehicleNumber.trim()) return "Enter the vehicle's registration number first.";
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setAlertInfo({ type: "error", message: problem });
      return null;
    }
    setSaving(true);
    try {
      const form = toInspectionFormData(inspection);
      const record = savedId
        ? await updateInspection(savedId, form)
        : await createInspection(form);

      setSavedId(record.id);
      setInspectionNumber(record.inspection_number || "");
      // Take the saved record back: the photos are now Cloudinary URLs rather
      // than Files, which is what stops the next save re-uploading them. The
      // baseline comes from that same object, because the server normalises
      // what it stored — a plate is upper-cased, blank ratings are dropped —
      // and comparing against what was sent would read as dirty immediately.
      const saved = fromInspectionRecord(record);
      savedFingerprintRef.current = fingerprint(saved);
      setInspection(saved);
      if (!savedId) {
        loadedIdRef.current = record.id;
        navigate(`/inspections/${record.id}`, { replace: true });
      }
      setAlertInfo({ type: "success", message: `Inspection ${record.inspection_number} saved.` });
      return record;
    } catch (err) {
      setAlertInfo({ type: "error", message: apiErrorMessage(err, "Could not save this inspection.") });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Generating always saves first, so nothing printed is ever left unrecorded.
  const handlePrint = async () => {
    const record = await handleSave();
    if (!record) return;
    // The photos are served from Cloudinary. Printing before they have decoded
    // emits the report with empty photo boxes — something estimates never had
    // to handle, since their logo and signature are bundled assets.
    await Promise.all(
      Array.from(documentRef.current?.querySelectorAll("img") || []).map((img) =>
        img.decode().catch(() => {})
      )
    );
    window.print();
  };

  const isDirty = useMemo(
    () => fingerprint(inspection) !== savedFingerprintRef.current,
    [inspection]
  );

  const handleBack = () => {
    if (isDirty) {
      setLeavePrompt(true);
      return;
    }
    navigate("/inspections");
  };

  const saveAndLeave = async () => {
    const record = await handleSave();
    // A failed save — a missing plate, or the request itself — leaves the
    // prompt up rather than silently dropping the work it was protecting.
    if (!record) return;
    setLeavePrompt(false);
    navigate("/inspections");
  };

  // Covers a refresh or a closed tab, which the in-app prompt can't see.
  // Browsers show their own wording here; the flag is all they take.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const totalAnswered = INSPECTION_CATEGORIES.reduce(
    (n, cat) => n + answeredCount(inspection.checklist, cat, inspection.customFields), 0
  );
  const totalComponents = INSPECTION_CATEGORIES.reduce((n, cat) => n + cat.components.length, 0);

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded-2xl" />
        <div className="h-96 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const activeCategory = INSPECTION_CATEGORIES.find((c) => c.key === activeStep);

  return (
    <>
      <div className="p-4 lg:p-6 print:hidden">
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />

        <LeavePrompt
          open={leavePrompt}
          saving={saving}
          onSave={saveAndLeave}
          onDiscard={() => navigate("/inspections")}
          onStay={() => setLeavePrompt(false)}
        />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
              aria-label="Back to inspections"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                {inspectionNumber ? `Inspection ${inspectionNumber}` : "New Inspection"}
              </h1>
              <p className="text-xs text-gray-500">
                {totalAnswered} of {totalComponents} components recorded
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="px-3 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="hidden sm:inline">{showPreview ? "Hide" : "Preview"}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={16} /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Printer size={16} /> <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Session, vehicle and photos — always on screen, never a step. */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <TextField
                  label="Inspector" id="inspector"
                  value={inspection.inspectorName}
                  onChange={(e) => setField("inspectorName", e.target.value)}
                />
                <TextField
                  label="Customer" id="customer"
                  value={inspection.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                />
                <TextField
                  label="Date" id="date" type="date"
                  value={inspection.date}
                  onChange={(e) => setField("date", e.target.value)}
                />
                <TextField
                  label="Time" id="time" type="time"
                  value={inspection.time}
                  onChange={(e) => setField("time", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {/* The status sits with the plate rather than in the grid
                    flow, so a two-line message can't shove the fields beside
                    it out of alignment. */}
                <div className="col-span-2 lg:col-span-1">
                  <TextField
                    label="Reg. Number" id="plate"
                    value={inspection.vehicleNumber}
                    onChange={(e) => handlePlateChange(e.target.value)}
                    placeholder="WP CAL-3421"
                  />
                  <VehicleLookupStatus lookup={vehicleLookup} />
                </div>
                <TextField
                  label="Chassis Number" id="chassis"
                  value={inspection.chassisNumber}
                  onChange={(e) => setField("chassisNumber", e.target.value)}
                />
                <TextField
                  label="Make / Model" id="makemodel"
                  value={inspection.makeModel}
                  onChange={(e) => setField("makeModel", e.target.value)}
                  placeholder="Honda Fit"
                />
                <TextField
                  label="Year" id="year" type="number" min="1900" max="2100"
                  value={inspection.year}
                  onChange={(e) => setField("year", e.target.value)}
                />
                <SelectField
                  label="Fuel Type" id="fuel" options={FUEL_TYPES}
                  value={inspection.fuelType}
                  onChange={(e) => setField("fuelType", e.target.value)}
                />
                <TextField
                  label="Mileage (km)" id="mileage" type="number" min="0"
                  value={inspection.mileage}
                  onChange={(e) => setField("mileage", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PhotoDropzone
                id="photo-front" caption="Front" value={inspection.frontImage}
                onPick={(f) => pickPhoto("frontImage", f)}
                onClear={() => setField("frontImage", null)}
              />
              <PhotoDropzone
                id="photo-rear" caption="Rear" value={inspection.rearImage}
                onPick={(f) => pickPhoto("rearImage", f)}
                onClear={() => setField("rearImage", null)}
              />
            </div>
          </div>
        </div>

        {/* Step rail + the one open step. Only the active step is mounted, so
            the page holds ~20 selects rather than all 207. */}
        <div className="flex flex-col lg:flex-row gap-5">
          <nav className="lg:w-60 shrink-0">
            <div className="lg:sticky lg:top-20 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {STEPS.map((step) => {
                const category = INSPECTION_CATEGORIES.find((c) => c.key === step.key);
                const done = category ? answeredCount(inspection.checklist, category, inspection.customFields) : 0;
                const total = category ? category.components.length : 0;
                const active = activeStep === step.key;
                // Pseudo-steps carry a "__" prefix in the rail but are stored
                // by their bare key, because that key is persisted.
                const included = sectionIncluded(step.key.replace(/^__/, ""));
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setActiveStep(step.key)}
                    className={`shrink-0 text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? "bg-gray-900 text-white font-semibold"
                        : included
                        ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        : "bg-gray-50 border border-dashed border-gray-200 text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    <span
                      className={`whitespace-nowrap lg:whitespace-normal ${
                        included ? "" : "line-through decoration-gray-300"
                      }`}
                    >
                      {step.title}
                    </span>
                    {category && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                          active
                            ? "bg-white/20"
                            : done === total
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {done}/{total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {activeCategory && (
              <CategoryStep
                category={activeCategory}
                values={inspection.checklist[activeCategory.key]}
                ratingValue={inspection.ratings[activeCategory.key] ?? ""}
                recommendation={inspection.recommendations[activeCategory.key] ?? ""}
                customRows={inspection.customFields?.[activeCategory.key] || []}
                included={sectionIncluded(activeCategory.key)}
                onSet={(key, value) => setComponent(activeCategory.key, key, value)}
                onFillRest={() => fillRestAsNormal(activeCategory)}
                onClear={() => clearCategory(activeCategory)}
                onRating={(value) => setRating(activeCategory.key, value)}
                onRecommendation={(value) => setRecommendation(activeCategory.key, value)}
                onCustomRows={(rows) => setCustomRows(activeCategory.key, rows)}
                onIncluded={(on) => setSectionIncluded(activeCategory.key, on)}
              />
            )}
            {activeStep === "__scan" && (
              <ScanStep
                values={inspection.systemScan}
                onSet={(key, value) =>
                  setInspection((prev) => ({
                    ...prev,
                    systemScan: { ...prev.systemScan, [key]: value },
                  }))
                }
                onFillRest={fillScanAsNormal}
                onClear={clearScan}
                customRows={inspection.customFields?.scan || []}
                included={sectionIncluded("scan")}
                onCustomRows={(rows) => setCustomRows("scan", rows)}
                onIncluded={(on) => setSectionIncluded("scan", on)}
              />
            )}
            {activeStep === "__dtc" && (
              <DtcStep
                rows={inspection.dtcCodes}
                included={sectionIncluded("dtc")}
                onChange={(rows) => setField("dtcCodes", rows)}
                onIncluded={(on) => setSectionIncluded("dtc", on)}
              />
            )}
            {activeStep === "__ratings" && (
              <RatingsStep
                ratings={inspection.ratings}
                excludedSections={inspection.excludedSections}
                onRating={setRating}
              />
            )}
          </div>
        </div>

        {/* Preview. `zoom` rather than a transform so the shrunken sheet still
            occupies its real height — this report runs to six pages. */}
        {showPreview && (
          <div className="mt-6 bg-gray-100 rounded-2xl p-4 overflow-x-auto">
            <div className="mx-auto shadow-xl bg-white w-fit" style={{ zoom: 0.62 }}>
              <InspectionDocument inspection={deferred} inspectionNumber={inspectionNumber} />
            </div>
          </div>
        )}
      </div>

      {/* Print copy — hidden on screen, the only thing window.print() emits. */}
      <div className="hidden print:block">
        <InspectionDocument
          ref={documentRef}
          inspection={deferred}
          inspectionNumber={inspectionNumber}
        />
      </div>
    </>
  );
};

export default InspectionPage;
