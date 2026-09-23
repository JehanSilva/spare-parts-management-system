import React, { forwardRef } from "react";
import logo from "../assets/logo.png";
import signature from "../assets/signature.png";
import {
  INSPECTION_CATEGORIES,
  SYSTEM_SCAN_MODULES,
  OPTIONS,
  TONE_CLASS,
  valueTone,
  overallRating,
  blankChecklist,
  blankRatings,
  blankSystemScan,
  blankRecommendations,
  emptyDtcRow,
  blankCustomFields,
  filledCustomFields,
  isSectionExcluded,
  ratingTone,
} from "./inspectionSchema";

// --- API <-> editor mapping --------------------------------------------------
// The editor works in camelCase; the API is snake_case. Both the editor and the
// saved-inspections list go through these, so the shape is defined once — the
// same arrangement as toEstimatePayload/fromEstimateRecord.

// Rows the inspector never filled in must not reach the database: the DTC table
// always keeps one blank row on screen so there is something to type into.
const filledDtcRows = (rows = []) =>
  rows.filter((r) => (r.code || "").trim() || (r.module || "").trim() || (r.description || "").trim());

export const toInspectionFormData = (inspection) => {
  const form = new FormData();

  // A cleared date or number has to go as "", which DRF maps to NULL for these
  // nullable columns — the same trap toEstimatePayload documents for dates.
  const scalars = {
    inspector_name: inspection.inspectorName,
    date: inspection.date || "",
    time: inspection.time || "",
    customer_name: inspection.customerName,
    vehicle_number: inspection.vehicleNumber,
    chassis_number: inspection.chassisNumber,
    make_model: inspection.makeModel,
    year: inspection.year || "",
    fuel_type: inspection.fuelType || "",
    mileage: inspection.mileage || "",
  };
  Object.entries(scalars).forEach(([key, value]) => form.append(key, value ?? ""));

  // The blobs travel as JSON strings. DRF's JSONField parses them back out
  // because the request came in as a form, which is what lets the photos and
  // the whole sheet be saved in a single request.
  form.append("checklist", JSON.stringify(inspection.checklist || {}));
  form.append("ratings", JSON.stringify(inspection.ratings || {}));
  form.append("system_scan", JSON.stringify(inspection.systemScan || {}));
  form.append("dtc_codes", JSON.stringify(filledDtcRows(inspection.dtcCodes)));
  form.append("recommendations", JSON.stringify(inspection.recommendations || {}));

  // Rows with no label are dropped here as well as on the server, so what the
  // editor shows and what gets stored agree.
  form.append(
    "custom_fields",
    JSON.stringify(
      Object.fromEntries(
        Object.entries(inspection.customFields || {})
          .map(([section, rows]) => [section, filledCustomFields(rows)])
          .filter(([, rows]) => rows.length)
      )
    )
  );
  form.append("excluded_sections", JSON.stringify(inspection.excludedSections || []));

  // Only append a photo when the inspector actually picked a new one. On edit
  // the value in state is a Cloudinary URL string, and appending that would
  // overwrite the stored image with a filename. Appending "" would clear it.
  // Same guard as AddPartForm's image field.
  if (inspection.frontImage instanceof File) form.append("front_image", inspection.frontImage);
  if (inspection.rearImage instanceof File) form.append("rear_image", inspection.rearImage);

  return form;
};

export const fromInspectionRecord = (record) => ({
  inspectorName: record.inspector_name || "",
  date: record.date || "",
  // The API returns seconds ("14:37:00") but <input type="time"> wants HH:MM.
  time: (record.time || "").slice(0, 5),
  customerName: record.customer_name || "",
  vehicleNumber: record.vehicle_number || "",
  chassisNumber: record.chassis_number || "",
  makeModel: record.make_model || "",
  year: record.year ?? "",
  fuelType: record.fuel_type || "",
  mileage: record.mileage ?? "",
  frontImage: record.front_image || null,
  rearImage: record.rear_image || null,
  // A category the sheet never used comes back missing; the editor needs every
  // key present to render, so merge the saved values over a blank sheet.
  checklist: INSPECTION_CATEGORIES.reduce(
    (acc, cat) => ({
      ...acc,
      [cat.key]: { ...blankChecklist()[cat.key], ...(record.checklist?.[cat.key] || {}) },
    }),
    {}
  ),
  ratings: { ...blankRatings(), ...(record.ratings || {}) },
  systemScan: { ...blankSystemScan(), ...(record.system_scan || {}) },
  recommendations: { ...blankRecommendations(), ...(record.recommendations || {}) },
  dtcCodes: record.dtc_codes?.length ? record.dtc_codes : [emptyDtcRow()],
  // Every section needs a key present so the editor can push a row onto it.
  customFields: { ...blankCustomFields(), ...(record.custom_fields || {}) },
  // Absent means nothing was excluded — an inspection saved before sections
  // could be switched off still prints in full.
  excludedSections: record.excluded_sections || [],
});

export const blankInspection = () => ({
  inspectorName: "",
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  customerName: "",
  vehicleNumber: "",
  chassisNumber: "",
  makeModel: "",
  year: "",
  fuelType: "",
  mileage: "",
  frontImage: null,
  rearImage: null,
  checklist: blankChecklist(),
  ratings: blankRatings(),
  systemScan: blankSystemScan(),
  recommendations: blankRecommendations(),
  dtcCodes: [emptyDtcRow()],
  customFields: blankCustomFields(),
  excludedSections: [],
});

// How many components in a category have been answered — the badge on the
// editor's step rail, defined here so the count rule lives with the schema.
export const answeredCount = (checklist, category, customFields) =>
  category.components.filter((c) => (checklist?.[category.key]?.[c.key] || "").trim()).length +
  filledCustomFields(customFields?.[category.key]).filter((r) => (r.value || "").trim()).length;

const BAR_CLASS = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  none: "bg-gray-300",
};

const formatImageSrc = (value) => {
  if (!value) return null;
  // Before the sheet is saved the photo is still the File the inspector picked,
  // so the preview has to read it from memory rather than from Cloudinary.
  return value instanceof File ? URL.createObjectURL(value) : value;
};

// --- Printable pieces --------------------------------------------------------

// One label/value line. The value carries the verdict, so it is the bold,
// coloured half — an unanswered component still prints, as a grey dash, because
// a missing line would read as "fine" rather than "not checked".
const CheckRow = ({ label, value, optionSet }) => {
  const tone = valueTone(value, optionSet);
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-100">
      <span className="text-gray-800">{label}</span>
      <span className={`font-bold text-right shrink-0 ${TONE_CLASS[tone]}`}>
        {(value || "").trim() || "—"}
      </span>
    </div>
  );
};

const CategoryBlock = ({ category, values, extras = [] }) => (
  <div className="mt-2 inspection-block">
    <h3 className="font-bold text-[10px] tracking-[0.12em] uppercase text-red-700 border-b border-black pb-0.5 mb-1">
      {category.title}
    </h3>
    <div className="grid grid-cols-2 gap-x-8">
      {category.components.map((comp) => (
        <CheckRow
          key={comp.key}
          label={comp.label}
          value={values?.[comp.key]}
          optionSet={comp.options}
        />
      ))}
      {/* Rows the inspector added for this vehicle, after the catalog ones so
          the standard sheet always reads the same way. A typed value carries
          no option set, so it prints uncoloured. */}
      {extras.map((row, i) => (
        <CheckRow
          key={`custom-${i}`}
          label={row.label}
          value={row.value}
          optionSet={row.free ? "__free" : "condition"}
        />
      ))}
    </div>
  </div>
);

// `action` rides at the right of the rule, for a section that carries a figure
// in its heading. With none passed the single child sits left under
// justify-between, exactly as it did before. Mirrors the `action` prop on
// SectionLabel in components/forms/AddSupplierForm.js.
const SectionHeading = ({ children, action }) => (
  <h3 className="font-bold text-[10px] tracking-[0.12em] uppercase text-red-700 border-b border-black pb-0.5 mb-1 mt-2 flex items-baseline justify-between gap-4">
    <span>{children}</span>
    {action}
  </h3>
);

// --- The report --------------------------------------------------------------

const InspectionDocument = forwardRef(({ inspection = {}, inspectionNumber = "" }, ref) => {
  const {
    checklist = {}, ratings = {}, systemScan = {}, recommendations = {}, dtcCodes = [],
    customFields = {}, excludedSections = [],
  } = inspection;

  // Sections switched off for this vehicle are absent from the report
  // entirely, rather than printed as a column of dashes.
  const shows = (sectionKey) => !isSectionExcluded(excludedSections, sectionKey);
  const printedCategories = INSPECTION_CATEGORIES.filter((cat) => shows(cat.key));
  const extrasFor = (sectionKey) => filledCustomFields(customFields?.[sectionKey]);

  const overall = overallRating(ratings, excludedSections);
  // A sheet with nothing scored yet shows a dash rather than a hard 0.00%,
  // which would read as a verdict rather than an absence.
  const hasAnyRating = printedCategories.some(
    (cat) => !Number.isNaN(parseFloat(ratings?.[cat.key]))
  );
  const frontSrc = formatImageSrc(inspection.frontImage);
  const rearSrc = formatImageSrc(inspection.rearImage);
  const codes = filledDtcRows(dtcCodes);

  // Only systems the inspector actually wrote about get a heading — the same
  // filtering EstimateDocument does so a blank never prints a dangling label.
  const writtenRecommendations = printedCategories
    .map((cat) => [cat, (recommendations?.[cat.key] || "").trim()])
    .filter(([, text]) => text);

  const facts = [
    ["Reg. Number", inspection.vehicleNumber],
    ["Chassis Number", inspection.chassisNumber],
    ["Make / Model", inspection.makeModel],
    ["Year", inspection.year],
    ["Fuel Type", inspection.fuelType],
    ["Mileage", inspection.mileage ? `${inspection.mileage} KM` : ""],
  ];

  const session = [
    ["Inspection No.", inspectionNumber],
    ["Inspector", inspection.inspectorName],
    ["Date", inspection.date],
    ["Time", inspection.time],
    ["Customer Name", inspection.customerName],
  ];

  return (
    <div
      ref={ref}
      className="inspection-doc bg-white text-black mx-auto text-[9px] leading-[1.2]"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "10mm 10mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── Header: cover, vehicle, photos, ratings ─────────────────────── */}
      <section>
        {/* Letterhead, matching the estimate and the invoice. */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 text-center" style={{ width: "92px" }}>
            {/* Width-only sizing — a fixed box would stretch the ~2.4:1 mark. */}
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

        <h2 className="text-center font-bold uppercase tracking-[0.2em] text-[13px] text-gray-800 mt-3">
          Vehicle Inspection Report
        </h2>

        {/* Session and vehicle facts, side by side as on the source sheet. */}
        <div className="grid grid-cols-2 gap-x-10 mt-2 inspection-block">
          <div>
            <SectionHeading>Inspection Session</SectionHeading>
            {session.map(([label, value]) => (
              <div key={label} className="flex justify-between py-[1.5px]">
                <span className="text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value || "—"}</span>
              </div>
            ))}
          </div>
          <div>
            <SectionHeading>Vehicle Information</SectionHeading>
            {facts.map(([label, value]) => (
              <div key={label} className="flex justify-between py-[1.5px]">
                <span className="text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Photos. A fixed aspect ratio so an unusually tall photo can't push
            the ratings table off the first sheet. */}
        {(frontSrc || rearSrc) && (
          <div className="mt-2 inspection-block break-inside-avoid">
            <SectionHeading>Visual Images</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              {[["Front", frontSrc], ["Rear", rearSrc]].map(([caption, src]) => (
                <div key={caption}>
                  {src ? (
                    <img
                      src={src}
                      alt={caption}
                      className="w-full object-cover border border-gray-300"
                      style={{ aspectRatio: "16 / 10" }}
                    />
                  ) : (
                    <div
                      className="w-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400"
                      style={{ aspectRatio: "16 / 10" }}
                    >
                      No photo
                    </div>
                  )}
                  <div className="text-center text-gray-600 mt-0.5">{caption}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ratings. Plain divs, never a chart — index.css hides SVG charts in
            print because they rasterise poorly. */}
        <div className="mt-2 inspection-block">
          {/* The headline figure rides on the heading rule rather than in a
              block of its own — on a six-page report the vertical space costs
              more than the emphasis a separate panel would buy. */}
          <SectionHeading
            action={
              <span className="flex items-baseline gap-2 shrink-0">
                <span className="text-gray-600">Overall</span>
                <span
                  className={`text-[17px] leading-none ${TONE_CLASS[ratingTone(overall)]}`}
                >
                  {hasAnyRating ? `${overall.toFixed(2)}%` : "—"}
                </span>
              </span>
            }
          >
            Vehicle Rating
          </SectionHeading>
          <div className="grid grid-cols-2 gap-x-10">
            {printedCategories.map((cat) => {
              const pct = parseFloat(ratings?.[cat.key]);
              const shown = Number.isNaN(pct) ? 0 : pct;
              return (
                <div key={cat.key} className="flex items-center gap-2 py-[2px]">
                  <span className="flex-1 text-gray-800">{cat.title}</span>
                  <span className="w-20 h-[6px] bg-gray-200 shrink-0">
                    <span
                      className={`block h-full ${BAR_CLASS[ratingTone(shown)]}`}
                      style={{ width: `${shown}%` }}
                    />
                  </span>
                  <span className={`w-9 text-right font-bold ${TONE_CLASS[ratingTone(shown)]}`}>
                    {Number.isNaN(pct) ? "—" : `${shown}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── The component checklist ─────────────────────────────────────── */}
      {/* One continuous run, deliberately not split into fixed sheets. Each
          category is atomic (break-inside: avoid), so the browser fills every
          page as far as it will go and moves a whole category down only when
          it genuinely will not fit — which packs tighter than any split this
          code could guess at, and leaves no half-empty sheets behind. */}
      {printedCategories.map((cat) => (
        <CategoryBlock
          key={cat.key}
          category={cat}
          values={checklist?.[cat.key]}
          extras={extrasFor(cat.key)}
        />
      ))}

      {/* ── Scan, fault codes, recommendations ──────────────────────────── */}
      <section>
        {shows("scan") && (
          <div className="inspection-block">
            <SectionHeading>System Scan Summary</SectionHeading>
            <div className="grid grid-cols-2 gap-x-8">
              {SYSTEM_SCAN_MODULES.map((mod) => (
                <CheckRow key={mod.key} label={mod.label} value={systemScan?.[mod.key]} />
              ))}
              {extrasFor("scan").map((row, i) => (
                <CheckRow
                  key={`custom-${i}`}
                  label={row.label}
                  value={row.value}
                  optionSet={row.free ? "__free" : "condition"}
                />
              ))}
            </div>
          </div>
        )}

        {shows("dtc") && (
          <div className="mt-3 inspection-block">
            <SectionHeading>Diagnostic Trouble Codes</SectionHeading>
            {codes.length === 0 ? (
              <p className="text-gray-600 italic">No diagnostic trouble codes recorded.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-gray-700 uppercase tracking-[0.1em] text-[8px]">
                    <th className="pb-1 pl-1 text-left font-bold w-[15%]">DTC Code</th>
                    <th className="pb-1 px-1 text-left font-bold w-[15%]">Module</th>
                    <th className="pb-1 px-1 text-left font-bold w-[55%]">Code Description</th>
                    <th className="pb-1 pr-1 text-right font-bold w-[15%]">Status</th>
                  </tr>
                </thead>
                <tbody className="border-t border-gray-400">
                  {codes.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-[2px] pl-1 font-bold">{row.code || "—"}</td>
                      <td className="py-[2px] px-1">{row.module || "—"}</td>
                      <td className="py-[2px] px-1">{row.description || "—"}</td>
                      <td
                        className={`py-[2px] pr-1 text-right font-bold ${
                          row.status === "Active"
                            ? TONE_CLASS.bad
                            : row.status === "History"
                            ? TONE_CLASS.warn
                            : TONE_CLASS.none
                        }`}
                      >
                        {row.status || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="mt-4">
          <SectionHeading>Required Maintenance &amp; Future Recommendations</SectionHeading>
          {writtenRecommendations.length === 0 ? (
            <p className="text-gray-600 italic">No maintenance recommendations recorded.</p>
          ) : (
            writtenRecommendations.map(([cat, text]) => (
              <div key={cat.key} className="mt-2 inspection-block">
                <div className="font-bold text-gray-700 text-[9px]">{cat.title}</div>
                <p className="text-red-700 whitespace-pre-line mt-0.5">{text}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── How to read the report ──────────────────────────────────────── */}
      {/* Built from the same option vocabulary the body is coloured from, so
          the key can never contradict the pages in front of it. */}
      <section>
        <SectionHeading>How To Read This Report</SectionHeading>
        <p className="text-gray-800 leading-relaxed">
          Each item on this sheet records the condition of that component at the time of
          inspection. Findings are printed in three colours:
        </p>

        <div className="mt-3 space-y-2">
          {[
            ["good", "In good order", "No work required at this time."],
            ["warn", "Needs attention", "Wearing, low, or due for service — plan the work."],
            ["bad", "Major work required", "A defect or damage needing repair now."],
          ].map(([tone, title, meaning]) => {
            const words = [
              ...new Set(
                Object.values(OPTIONS)
                  .flat()
                  .filter((v) => valueTone(v) === tone)
              ),
            ];
            return (
              <div key={tone} className="flex gap-3 items-baseline inspection-block">
                <span className={`w-36 shrink-0 font-bold ${TONE_CLASS[tone]}`}>{title}</span>
                <span className="flex-1">
                  <span className="text-gray-800">{meaning}</span>
                  <span className={`ml-1 ${TONE_CLASS[tone]}`}>{words.join(", ")}.</span>
                </span>
              </div>
            );
          })}
          <div className="flex gap-3 items-baseline">
            <span className={`w-36 shrink-0 font-bold ${TONE_CLASS.none}`}>Not checked</span>
            <span className="flex-1 text-gray-800">
              Printed as a dash. The component was not assessed during this inspection.
            </span>
          </div>
        </div>

        <p className="mt-3 text-gray-800 leading-relaxed">
          Tyre figures are tread remaining, so 100% is a new tyre. Category ratings are the
          inspector&rsquo;s assessment of that system as a whole, and the overall rating is their
          average.
        </p>

        <SectionHeading>Please Note</SectionHeading>
        <ol className="list-decimal ml-4 space-y-1 text-gray-800 leading-relaxed">
          <li>
            This report records the condition of the vehicle on the date of inspection only, and is
            issued for the customer named above.
          </li>
          <li>
            We assess the vehicle&rsquo;s current condition. We cannot predict faults that may
            develop later, and we accept no responsibility for them.
          </li>
          <li>
            The odometer reading is recorded as displayed. We cannot confirm that it reflects the
            vehicle&rsquo;s true mileage.
          </li>
          <li>
            Service records and documents belonging to the vehicle are outside the scope of this
            inspection.
          </li>
          <li>
            Any unclear point or disagreement with this report must be raised with us within 7 days
            of its date.
          </li>
          <li>
            Where maintenance work is listed above, carrying it out is the owner&rsquo;s
            responsibility.
          </li>
        </ol>

        {/* ── SIGNATURE (applied automatically) ─────────────────────────── */}
        {/* Width-only sizing, like the logo — the ~2.7:1 mark would be
            stretched by a fixed box. */}
        <div className="mt-6 break-inside-avoid">
          <img src={signature} alt="" className="w-40 h-auto" />
          <div className="text-[10px] text-gray-800 leading-snug mt-0.5">
            <div>Authorized Signature</div>
            <div>NSS Auto Engineers</div>
            {inspection.inspectorName && (
              <div className="mt-0.5">Inspected by: {inspection.inspectorName}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
});

export default InspectionDocument;
