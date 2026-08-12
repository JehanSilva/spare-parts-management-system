import React, { forwardRef } from "react";
import logo from "../assets/logo.png";
import { getVehicleInfo } from "./billingVehicle";

// Right-aligned "Label : value" row used in the invoice meta column.
const MetaRow = ({ label, value }) => (
  <div className="flex justify-end gap-3">
    <span className="text-gray-600">{label} :</span>
    <span className="text-gray-900 w-32 text-right">{value}</span>
  </div>
);

// Full A4 invoice — the alternative to the 80mm thermal Receipt. Takes exactly
// the same props so the two are interchangeable wherever a sale needs to be
// documented (see BillingDocument).
//
// Everything here has to survive two very different renderers: window.print()
// and html2canvas (for the WhatsApp share image). That rules out CSS filters,
// object-fit and box-shadows, which html2canvas silently drops.
const Invoice = forwardRef(({ sale, cartItems }, ref) => {
  const formatAmount = (amount) =>
    new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const rawItems = sale ? sale.items : cartItems || [];

  // Same discount handling as Receipt: backend history stores `discount` as a
  // per-unit cash value, the live cart stores `discountPercent`.
  let grandTotal = 0;
  let totalSavings = 0;

  const items = rawItems.map((item) => {
    const originalPrice = parseFloat(item.unit_price || item.sell_price || 0);
    const qty = parseInt(item.quantity || 1);

    let discountAmount = 0;
    if (item.discount !== undefined && item.discount !== null) {
      discountAmount = parseFloat(item.discount);
    } else if (item.discountPercent !== undefined) {
      discountAmount = originalPrice * (parseFloat(item.discountPercent) / 100);
    }

    const finalPrice = originalPrice - discountAmount;
    const lineTotal = finalPrice * qty;

    grandTotal += lineTotal;
    totalSavings += discountAmount * qty;

    return {
      name: item.part_name || item.name || item.description || "Item",
      part_number: item.part_number,
      qty,
      originalPrice,
      discountAmount,
      lineTotal,
    };
  });

  const issuedAt = sale ? new Date(sale.created_at) : new Date();
  const issuedDate = issuedAt.toLocaleDateString("en-GB");
  const invoiceId = sale ? sale.id.substring(0, 8).toUpperCase() : "DRAFT";
  const customer = sale ? sale.customer_name : "Walk-in";
  // Plate, make/model and the last known odometer reading with its date.
  const vehicleInfo = getVehicleInfo(sale);

  const paymentStatus = sale ? sale.payment_status : "PAID";
  const amountPaid =
    paymentStatus === "PAID" ? grandTotal : parseFloat(sale?.amount_paid || 0);
  const balanceDue = Math.max(grandTotal - amountPaid, 0);

  const termsLabel =
    paymentStatus === "CREDIT"
      ? "Pay Later (Credit)"
      : paymentStatus === "PARTIAL"
      ? "Balance On Credit"
      : "Paid In Full";

  return (
    <div
      ref={ref}
      className="billing-invoice bg-white text-black mx-auto text-[10px] leading-normal"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "16mm 14mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        {/* Circular badge, echoing the reference's monogram mark. The logo
            artwork is red on transparent, so it sits on white inside a black
            ring rather than being recoloured — html2canvas ignores filters. */}
        <div className="w-16 h-16 rounded-full border-[3px] border-black bg-white flex items-center justify-center overflow-hidden">
          <img src={logo} alt="NSS Auto Spares" className="w-12 h-auto" />
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold tracking-tight leading-none">INVOICE</div>
          <div className="text-gray-500 mt-1.5">Invoice# {invoiceId}</div>
        </div>
      </div>

      {/* COMPANY + BALANCE DUE */}
      <div className="flex justify-between items-start mt-4">
        <div className="text-gray-800 leading-relaxed">
          <div className="font-bold text-gray-900">NSS Auto Spares</div>
          <div>No. 272 Thudella</div>
          <div>Ja-ela, Sri Lanka</div>
          <div>+94 71 618 8187</div>
        </div>

        <div className="text-right">
          <div className="text-gray-500">Balance Due</div>
          <div className="text-xl font-bold mt-0.5">LKR {formatAmount(balanceDue)}</div>
        </div>
      </div>

      {/* ── BILL TO + META ──────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mt-10">
        {/* Name only — the customer's phone number is deliberately kept off the
            printed bill; it's still on the sale record for the WhatsApp share. */}
        <div>
          <div className="font-bold text-gray-900 mb-1">Bill To</div>
          <div className="font-bold text-gray-900">{customer || "Walk-in Customer"}</div>
        </div>

        <div className="space-y-1.5">
          <MetaRow label="Invoice Date" value={issuedDate} />
          <MetaRow label="Terms" value={termsLabel} />
          {vehicleInfo.plate && <MetaRow label="Vehicle" value={vehicleInfo.plate} />}
          {vehicleInfo.makeModel && (
            <MetaRow label="Make & Model" value={vehicleInfo.makeModel} />
          )}
          {vehicleInfo.mileageLabel && (
            <MetaRow label="Mileage" value={vehicleInfo.mileageLabel} />
          )}
          {vehicleInfo.mileageDate && (
            <MetaRow label="Recorded On" value={vehicleInfo.mileageDate} />
          )}
        </div>
      </div>

      {/* ── LINE ITEMS ──────────────────────────────────────────────────── */}
      <table className="w-full border-collapse mt-10">
        <thead>
          <tr className="bg-black text-white text-[9px] uppercase tracking-wide">
            <th className="py-2 pl-3 pr-2 text-left font-normal w-[5%]">#</th>
            <th className="py-2 px-2 text-left font-normal w-[45%]">Item &amp; Description</th>
            <th className="py-2 px-2 text-right font-normal w-[10%]">Qty</th>
            <th className="py-2 px-2 text-right font-normal w-[14%]">Rate</th>
            <th className="py-2 px-2 text-right font-normal w-[12%]">Discount</th>
            <th className="py-2 pl-2 pr-3 text-right font-normal w-[14%]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b border-gray-200 align-top">
              <td className="py-3 pl-3 pr-2 text-gray-600">{index + 1}</td>
              <td className="py-3 px-2">
                <div className="font-bold text-gray-900">{item.name}</div>
                {item.part_number && (
                  <div className="text-[9px] text-gray-500 mt-0.5">{item.part_number}</div>
                )}
              </td>
              <td className="py-3 px-2 text-right">{item.qty.toFixed(2)}</td>
              <td className="py-3 px-2 text-right">{formatAmount(item.originalPrice)}</td>
              <td className="py-3 px-2 text-right">
                {formatAmount(item.discountAmount * item.qty)}
              </td>
              <td className="py-3 pl-2 pr-3 text-right">{formatAmount(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTALS ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end mt-6">
        <div className="w-[45%]">
          <div className="flex justify-between px-3 py-1.5">
            <span className="text-gray-600">Sub Total</span>
            <span>{formatAmount(grandTotal + totalSavings)}</span>
          </div>
          {totalSavings > 0 && (
            <div className="flex justify-between px-3 py-1.5">
              <span className="text-gray-600">Discount</span>
              <span>- {formatAmount(totalSavings)}</span>
            </div>
          )}
          <div className="flex justify-between px-3 py-1.5">
            <span className="text-gray-600">Total</span>
            <span>{formatAmount(grandTotal)}</span>
          </div>
          {paymentStatus !== "PAID" && (
            <div className="flex justify-between px-3 py-1.5">
              <span className="text-gray-600">Amount Paid</span>
              <span>{formatAmount(amountPaid)}</span>
            </div>
          )}
          <div className="flex justify-between px-3 py-2.5 mt-1 bg-black text-white font-bold">
            <span>Balance Due</span>
            <span>LKR {formatAmount(balanceDue)}</span>
          </div>
        </div>
      </div>

      {/* ── NOTES ───────────────────────────────────────────────────────── */}
      <div className="mt-16">
        <div className="font-bold text-gray-900 mb-1">Notes</div>
        <p className="text-gray-700">Thanks for your business.</p>
        {sale?.credit_note && paymentStatus !== "PAID" && (
          <p className="text-gray-700 mt-1">{sale.credit_note}</p>
        )}
      </div>

      {/* ── TERMS ───────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="font-bold text-gray-900 mb-1">Terms &amp; Conditions</div>
        <p className="text-gray-600 leading-relaxed">
          {balanceDue > 0
            ? "Please settle the outstanding balance within 14 days, quoting the invoice number above. "
            : ""}
          Please retain this invoice for warranty claims. No refunds or returns on electrical parts.
          Goods remain the property of NSS Auto Spares until paid in full.
        </p>
      </div>
    </div>
  );
});

export default Invoice;
