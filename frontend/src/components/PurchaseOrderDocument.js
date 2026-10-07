import React, { forwardRef } from "react";
import logo from "../assets/logo.png";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

/**
 * Printable A4 purchase order on the NSS Auto Engineers letterhead, sent to a
 * supplier. Lists what's being ordered — name, part number, brand, quantity.
 * Costs are deliberately left off: the supplier quotes those, and our expected
 * prices stay internal. Same header layout as the A4 Invoice.
 */
const PurchaseOrderDocument = forwardRef(({ purchaseOrder }, ref) => {
  if (!purchaseOrder) return null;
  const { po_number, supplier_name, created_at, ordered_at, notes, items = [] } = purchaseOrder;

  return (
    <div
      ref={ref}
      className="po-doc bg-white text-black mx-auto text-[11px] leading-snug"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <img src={logo} alt="NSS Auto Engineers" className="w-28 h-auto" />
        <div className="text-right">
          <div className="text-3xl font-bold tracking-tight leading-none">PURCHASE ORDER</div>
          <div className="text-gray-500 mt-1.5">PO# {po_number}</div>
        </div>
      </div>

      <div className="flex justify-between items-start mt-4 gap-6">
        <div className="text-gray-800 leading-relaxed">
          <div className="font-bold text-gray-900">NSS Auto Engineers</div>
          <div>No. 272 Thudella</div>
          <div>Ja-ela, Sri Lanka</div>
          <div>+94 71 618 8187</div>
        </div>
        <div className="text-right leading-relaxed">
          <div>
            <span className="text-gray-600">Date : </span>
            {formatDate(ordered_at || created_at)}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="font-bold text-gray-900 mb-0.5">Supplier</div>
        <div className="font-bold text-gray-900">{supplier_name || "—"}</div>
      </div>

      {/* ── ITEMS ───────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse mt-5">
        <thead>
          <tr className="bg-gray-900 text-white text-[10px] uppercase tracking-wider">
            <th className="py-2 px-2 text-left font-bold w-8">#</th>
            <th className="py-2 px-2 text-left font-bold">Item</th>
            <th className="py-2 px-2 text-left font-bold">Part No.</th>
            <th className="py-2 px-2 text-left font-bold">Brand</th>
            <th className="py-2 px-2 text-right font-bold">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 px-2 text-gray-900">{item.part_name}</td>
              <td className="py-1.5 px-2 font-mono text-gray-800">{item.part_number}</td>
              <td className="py-1.5 px-2 text-gray-700">{item.brand || "—"}</td>
              <td className="py-1.5 px-2 text-right font-bold">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>


      {notes && notes.trim() && (
        <div className="mt-6">
          <div className="font-bold text-gray-900 mb-0.5">Notes</div>
          <p className="text-gray-700 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      <p className="mt-8 text-[10px] text-gray-500">
        Please confirm availability and pricing before dispatch, and quote PO# {po_number} on
        your invoice.
      </p>
    </div>
  );
});

export default PurchaseOrderDocument;
