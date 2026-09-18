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
  // A part often can't be priced until the spare-part seller quotes it, so only
  // this section's lines can be marked as awaiting a quotation.
  { key: "replacing", title: "Replacing Items", totalLabel: "Replacing Total", unitLabel: "Qty", allowPending: true },
];

// A line whose price isn't known yet — the supplier hasn't quoted the part.
// It carries no money, so it is left out of every total and printed as
// "pending" instead. Mirrored by is_quotation_pending in inventory/models.py.
export const isPendingQuotation = (row) => Boolean(row?.quotationPending);

// Total is the rate multiplied by the line's hours (or quantity). Leaving that
// field blank prices the line as a single flat amount.
export const rowTotal = (row) => {
  if (isPendingQuotation(row)) return 0;
  const rate = parseFloat(row.rate) || 0;
  const units = parseFloat(row.hours);
  return units > 0 ? units * rate : rate;
};

export const sectionTotal = (rows = []) => rows.reduce((sum, r) => sum + rowTotal(r), 0);

export const estimateTotal = (sections = {}) =>
  ESTIMATE_SECTIONS.reduce((sum, s) => sum + sectionTotal(sections[s.key]), 0);

// True once any line is waiting on a supplier quotation, which makes every
// total above only the priced part of the job.
export const hasPendingQuotation = (sections = {}) =>
  ESTIMATE_SECTIONS.some((s) => (sections[s.key] || []).some(isPendingQuotation));

// The note printed beside a total that doesn't yet cover the pending parts.
export const PENDING_QUOTATION_NOTE =
  "Excludes the item(s) marked \u201Cquotation pending\u201D \u2014 those prices follow once the supplier quotes them.";

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount || 0
  );

// --- API <-> builder mapping -------------------------------------------------
// The builder works in camelCase; the API is snake_case. Both the builder and
// the saved-estimates list go through these, so the shape is defined once.

export const toEstimatePayload = (estimate) => ({
  date: estimate.date,
  insurance_company: estimate.insuranceCompany,
  vehicle_number: estimate.vehicleNumber,
  make_model: estimate.makeModel,
  validity_days: parseInt(estimate.validityDays, 10) || 30,
  sections: estimate.sections,
});

export const fromEstimateRecord = (record) => ({
  date: record.date,
  insuranceCompany: record.insurance_company || "",
  vehicleNumber: record.vehicle_number || "",
  makeModel: record.make_model || "",
  validityDays: record.validity_days ?? 30,
  // A section the estimate never used comes back missing or empty; the editor
  // always needs at least one row to render, so backfill a blank one.
  sections: ESTIMATE_SECTIONS.reduce((acc, s) => {
    const rows = record.sections?.[s.key];
    return {
      ...acc,
      [s.key]: rows?.length ? rows : [{ description: "", hours: "", rate: "", quotationPending: false }],
    };
  }, {}),
});

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
    <div className="mt-4 break-inside-avoid">
      <h3 className="text-center font-bold uppercase tracking-[0.15em] text-[11px] text-gray-700 mb-1">
        {title}
      </h3>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-gray-700 uppercase tracking-[0.1em] text-[9px]">
            <th className="pb-1 pl-2 text-left font-bold w-[58%]">Task</th>
            <th className="pb-1 px-2 text-right font-bold w-[12%]">{unitLabel}</th>
            <th className="pb-1 px-2 text-right font-bold w-[15%]">Rate</th>
            <th className="pb-1 pr-2 text-right font-bold w-[15%]">Total</th>
          </tr>
        </thead>
        <tbody className="border-t border-gray-400">
          {rows.map((row, i) => {
            // An unpriced item still has to be listed, so the insurer sees the
            // part is part of the job — only its money columns are held back.
            const pending = isPendingQuotation(row);
            return (
              <tr key={i}>
                <td className="py-0.5 pl-2 text-gray-800">
                  <span className="inline-block w-6 text-gray-500">{i + 1}.</span>
                  {row.description || "Task"}
                </td>
                <td className="py-0.5 px-2 text-right text-gray-700">{unitDisplay(row)}</td>
                {pending ? (
                  <td className="py-0.5 px-2 text-right italic text-gray-700" colSpan={2}>
                    Quotation pending
                  </td>
                ) : (
                  <>
                    <td className="py-0.5 px-2 text-right text-gray-700">
                      {formatAmount(parseFloat(row.rate) || 0)}
                    </td>
                    <td className="py-0.5 pr-2 text-right text-gray-800">
                      {formatAmount(rowTotal(row))}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-400">
            <td className="pt-1 pl-2 font-bold uppercase tracking-[0.1em] text-[10px] text-gray-700">
              {totalLabel}
            </td>
            <td />
            <td className="pt-1 px-2 text-right font-bold uppercase tracking-[0.1em] text-[10px] text-gray-700">
              Total
            </td>
            <td className="pt-1 pr-2 text-right font-bold text-[11px] text-gray-900">
              {formatAmount(sectionTotal(rows))}
            </td>
          </tr>
          {rows.some(isPendingQuotation) && (
            <tr>
              <td colSpan={4} className="pt-0.5 pl-2 text-[9px] italic text-gray-600">
                {PENDING_QUOTATION_NOTE}
              </td>
            </tr>
          )}
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

  const pendingQuotation = hasPendingQuotation(sections);

  const issuedDate = date ? new Date(date) : new Date();
  const dateLabel = issuedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      ref={ref}
      className="estimate-doc bg-white text-black mx-auto text-[11px] leading-snug"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "10mm 12mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── LETTERHEAD ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="shrink-0 text-center" style={{ width: "92px" }}>
          {/* Width-only sizing — html2canvas ignores object-fit and would
              stretch the ~2.4:1 mark to fill a fixed box. */}
          <img src={logo} alt="" className="w-[84px] h-auto mx-auto" />
          <div className="font-black tracking-[0.15em] text-[12px] -mt-1">NSS</div>
        </div>

        <div className="flex-1 text-center">
          <h1
            className="font-black tracking-[0.08em] leading-none text-[25px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            NSS AUTO ENGINEERS
          </h1>
          <p className="mt-1.5 text-[9.5px] leading-tight text-gray-900">
            Specialist in Diesel and Petrol Engine Repairs, Radiator Cleaning &amp; Repairs, Hybrid
            Repairs and HV Battery Reconditioning, Scanning &amp; Programming, Engine Tuneups, Auto
            Transmission Repairs and Sales of All Kinds of Motor Spare Parts and Accessories
          </p>
        </div>
      </div>

      <div className="flex justify-between items-start mt-2 font-bold text-[10.5px]">
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

      <div className="border-b-2 border-black mt-1.5" />

      {/* ── ADDRESSEE ───────────────────────────────────────────────────── */}
      {/* The date rides in the heading's row and the two vehicle fields share
          one line: both are short, and every line saved here is a line the
          task tables get to keep on the first sheet. */}
      <div className="flex items-baseline justify-between mt-4">
        <span className="text-[10.5px] text-gray-800 w-1/4">{dateLabel}</span>
        <h2 className="flex-1 text-center font-bold uppercase tracking-[0.2em] text-[12px] text-gray-700">
          Estimate
        </h2>
        <span className="w-1/4" />
      </div>

      <div className="mt-3 text-[10.5px] text-gray-800">
        <div>The Manager,</div>
        <div>Claims Department,</div>
        <div>{insuranceCompany || "Insurance Company"},</div>
        <div>Sri Lanka.</div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-10 gap-y-0.5 text-[10.5px]">
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
      {/* With a part still unquoted the figure below is only the priced work,
          so the total is labelled and footnoted as provisional rather than
          silently under-stating the job. */}
      <div className="border-t-2 border-gray-500 mt-5 pt-2 flex justify-between items-center">
        <span className="font-bold uppercase tracking-[0.15em] text-[15px] text-gray-800">
          {pendingQuotation ? "Total (excluding pending items)" : "Total"}
        </span>
        <span className="font-bold text-[15px] text-gray-900">
          {formatAmount(estimateTotal(sections))}
        </span>
      </div>

      {pendingQuotation && (
        <p className="mt-1.5 text-[9.5px] italic text-gray-700">
          *The above total covers the repairs priced in this estimate. The price of the item(s)
          marked &ldquo;quotation pending&rdquo; is still awaited from the spare-part supplier and
          will be advised separately.
        </p>
      )}

      <p className="mt-2 text-[9.5px] text-gray-700">
        *This estimate is valid for {validityDays} days and applies only to the Insurance company:{" "}
        {insuranceCompany || "—"}
      </p>

      {/* ── SIGNATURE (applied automatically) ───────────────────────────── */}
      <div className="mt-4 break-inside-avoid">
        <img src={signature} alt="" className="w-40 h-auto" />
        <div className="text-[10.5px] text-gray-800 leading-snug mt-0.5">
          <div>Authorized Signature</div>
          <div>NSS Auto Engineers</div>
        </div>
      </div>
    </div>
  );
});

export default EstimateDocument;
