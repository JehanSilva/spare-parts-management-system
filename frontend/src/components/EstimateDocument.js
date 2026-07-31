import React, { forwardRef } from "react";
import logo from "../assets/logo.png";
import signature from "../assets/signature.png";

// The four task groups an estimate is built from, in the order they print.
// Labour is quoted in hours; replacing items are quoted per unit, so that
// section's middle column counts quantity instead.
export const ESTIMATE_SECTIONS = [
  { key: "removing", title: "Removing and Refitting", totalLabel: "Removing and Refitting", unitLabel: "Hours" },
  { key: "repair", title: "Repair Tasks", totalLabel: "Repair Total", unitLabel: "Hours" },
  { key: "paint", title: "Paint Tasks", totalLabel: "Paint Total", unitLabel: "Hours" },
  { key: "replacing", title: "Replacing Items", totalLabel: "Replacing Total", unitLabel: "Qty" },
];

// Total is the rate multiplied by the line's hours (or quantity). Leaving that
// field blank prices the line as a single flat amount.
export const rowTotal = (row) => {
  const rate = parseFloat(row.rate) || 0;
  const units = parseFloat(row.hours);
  return units > 0 ? units * rate : rate;
};

export const sectionTotal = (rows = []) => rows.reduce((sum, r) => sum + rowTotal(r), 0);

export const estimateTotal = (sections = {}) =>
  ESTIMATE_SECTIONS.reduce((sum, s) => sum + sectionTotal(sections[s.key]), 0);

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount || 0
  );

// One task group: centred title, the task table, and its own total line.
const TaskSection = ({ title, totalLabel, unitLabel = "Hours", rows }) => {
  if (!rows || rows.length === 0) return null;

  // A blank quantity means one unit; a blank hours figure means the line was
  // quoted as a flat amount, which prints as a dash the way it always has.
  const unitDisplay = (row) => {
    const units = parseFloat(row.hours);
    if (units > 0) return row.hours;
    return unitLabel === "Qty" ? "1" : "-";
  };

  return (
    <div className="mt-8 break-inside-avoid">
      <h3 className="text-center font-bold uppercase tracking-[0.15em] text-[12px] text-gray-700 mb-4">
        {title}
      </h3>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-gray-700 uppercase tracking-[0.1em] text-[10px]">
            <th className="pb-2 pl-2 text-left font-bold w-[58%]">Task</th>
            <th className="pb-2 px-2 text-right font-bold w-[12%]">{unitLabel}</th>
            <th className="pb-2 px-2 text-right font-bold w-[15%]">Rate</th>
            <th className="pb-2 pr-2 text-right font-bold w-[15%]">Total</th>
          </tr>
        </thead>
        <tbody className="border-t border-gray-400">
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="py-1.5 pl-2 text-gray-800">
                <span className="inline-block w-6 text-gray-500">{i + 1}.</span>
                {row.description || "Task"}
              </td>
              <td className="py-1.5 px-2 text-right text-gray-700">{unitDisplay(row)}</td>
              <td className="py-1.5 px-2 text-right text-gray-700">
                {formatAmount(parseFloat(row.rate) || 0)}
              </td>
              <td className="py-1.5 pr-2 text-right text-gray-800">{formatAmount(rowTotal(row))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-400">
            <td className="pt-2.5 pl-2 font-bold uppercase tracking-[0.1em] text-[11px] text-gray-700">
              {totalLabel}
            </td>
            <td />
            <td className="pt-2.5 px-2 text-right font-bold uppercase tracking-[0.1em] text-[11px] text-gray-700">
              Total
            </td>
            <td className="pt-2.5 pr-2 text-right font-bold text-[12px] text-gray-900">
              {formatAmount(sectionTotal(rows))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/**
 * Printable insurance repair estimate on the NSS Auto Engineers letterhead.
 * Rendered from the form on the Estimates page; the proprietor's signature is
 * applied automatically.
 */
const EstimateDocument = forwardRef(({ estimate }, ref) => {
  const {
    date,
    insuranceCompany,
    vehicleNumber,
    makeModel,
    validityDays = 30,
    sections = {},
  } = estimate || {};

  const issuedDate = date ? new Date(date) : new Date();
  const dateLabel = issuedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      ref={ref}
      className="estimate-doc bg-white text-black mx-auto text-[11px] leading-relaxed"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm 14mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── LETTERHEAD ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="shrink-0 text-center" style={{ width: "120px" }}>
          {/* Width-only sizing — html2canvas ignores object-fit and would
              stretch the ~2.4:1 mark to fill a fixed box. */}
          <img src={logo} alt="" className="w-28 h-auto mx-auto" />
          <div className="font-black tracking-[0.15em] text-[15px] -mt-1">NSS</div>
        </div>

        <div className="flex-1 text-center">
          <h1
            className="font-black tracking-[0.08em] leading-none text-[30px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            NSS AUTO ENGINEERS
          </h1>
          <p className="mt-2 text-[11px] leading-snug text-gray-900">
            Specialist in Diesel and Petrol Engine Repairs, Radiator Cleaning &amp; Repairs, Hybrid
            Repairs and HV Battery Reconditioning, Scanning &amp; Programming, Engine Tuneups, Auto
            Transmission Repairs and Sales of All Kinds of Motor Spare Parts and Accessories
          </p>
        </div>
      </div>

      <div className="flex justify-between items-start mt-3 font-bold text-[12px]">
        <div className="leading-snug">
          <div>No. 272, Negombo Road,</div>
          <div>Thudella, Ja-ela</div>
        </div>
        <div className="leading-snug">
          <div className="flex gap-2">
            <span className="w-16">Mobile</span>
            <span>: 071 6188187</span>
          </div>
          <div className="flex gap-2">
            <span className="w-16">Email</span>
            <span>: info@nssauto.lk</span>
          </div>
        </div>
      </div>

      <div className="border-b-2 border-black mt-2" />

      {/* ── ADDRESSEE ───────────────────────────────────────────────────── */}
      <h2 className="text-center font-bold uppercase tracking-[0.2em] text-[13px] text-gray-700 mt-8">
        Estimate
      </h2>

      <div className="mt-6 text-[12px] text-gray-800 leading-relaxed">
        <div>{dateLabel}</div>
        <div>The Manager,</div>
        <div>Claims Department,</div>
        <div>{insuranceCompany || "Insurance Company"},</div>
        <div>Sri Lanka.</div>
      </div>

      <div className="mt-4 text-[12px] leading-relaxed">
        <div>
          <span className="font-bold">Vehicle Number:</span>{" "}
          <span className="text-gray-800">{vehicleNumber || "—"}</span>
        </div>
        <div>
          <span className="font-bold">Make &amp; Model:</span>{" "}
          <span className="text-gray-800">{makeModel || "—"}</span>
        </div>
      </div>

      {/* ── TASK SECTIONS ───────────────────────────────────────────────── */}
      {ESTIMATE_SECTIONS.map((section) => (
        <TaskSection
          key={section.key}
          title={section.title}
          totalLabel={section.totalLabel}
          unitLabel={section.unitLabel}
          rows={sections[section.key]}
        />
      ))}

      {/* ── GRAND TOTAL ─────────────────────────────────────────────────── */}
      <div className="border-t-2 border-gray-500 mt-10 pt-4 flex justify-between items-center">
        <span className="font-bold uppercase tracking-[0.15em] text-[18px] text-gray-800">
          Total
        </span>
        <span className="font-bold text-[18px] text-gray-900">
          {formatAmount(estimateTotal(sections))}
        </span>
      </div>

      <p className="mt-8 text-[11px] text-gray-700">
        *This estimate is valid for {validityDays} days and applies only to the Insurance company:{" "}
        {insuranceCompany || "—"}
      </p>

      {/* ── SIGNATURE (applied automatically) ───────────────────────────── */}
      <div className="mt-8 break-inside-avoid">
        <img src={signature} alt="" className="w-52 h-auto" />
        <div className="text-[12px] text-gray-800 leading-snug mt-1">
          <div>Authorized Signature</div>
          <div>NSS Auto Engineers</div>
        </div>
      </div>
    </div>
  );
});

export default EstimateDocument;
