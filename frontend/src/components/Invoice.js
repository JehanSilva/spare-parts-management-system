import React, { forwardRef } from "react";
import logo from "../assets/logo.png";

// Full A4 tax-invoice style document — the alternative to the 80mm thermal
// Receipt. Takes exactly the same props so the two are interchangeable
// wherever a sale needs to be documented (see BillingDocument).
const Invoice = forwardRef(({ sale, cartItems }, ref) => {
  const formatLKR = (amount) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
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
      finalPrice,
      discountAmount,
      lineTotal,
    };
  });

  const issuedAt = sale ? new Date(sale.created_at) : new Date();
  const invoiceId = sale ? sale.id.substring(0, 8).toUpperCase() : "DRAFT";
  const customer = sale ? sale.customer_name : "Walk-in";
  const customerPhone = sale ? sale.customer_phone : "";
  const vehicle = sale ? sale.vehicle_number : "";

  const paymentStatus = sale ? sale.payment_status : "PAID";
  const amountPaid =
    paymentStatus === "PAID" ? grandTotal : parseFloat(sale?.amount_paid || 0);
  const balanceDue = Math.max(grandTotal - amountPaid, 0);

  const statusLabel =
    paymentStatus === "CREDIT"
      ? "CREDIT — PAY LATER"
      : paymentStatus === "PARTIAL"
      ? "PARTIALLY PAID"
      : "PAID";

  return (
    <div
      ref={ref}
      className="billing-invoice bg-white text-black p-10 mx-auto"
      style={{ width: "210mm", minHeight: "297mm", fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      {/* HEADER — company identity left, document identity right */}
      <div className="flex justify-between items-start pb-6 border-b-4 border-red-700">
        <div className="flex flex-col gap-3">
          {/* Width-only sizing: html2canvas ignores object-fit, so a box that
              doesn't match the logo's ~2.4:1 aspect ratio comes out stretched. */}
          <img src={logo} alt="NSS Auto Spares" className="w-40 h-auto" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">
              NSS Auto Spares
            </h1>
            <div className="mt-1 text-xs text-gray-600 leading-relaxed">
              <div>No. 272 Thudella, Ja-ela</div>
              <div>+94 71 618 8187</div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-4xl font-black uppercase tracking-tight text-red-700">Invoice</h2>
          <table className="mt-4 text-xs ml-auto">
            <tbody>
              <tr>
                <td className="pr-4 py-0.5 text-gray-500 text-left">Invoice No.</td>
                <td className="py-0.5 font-bold text-right">#{invoiceId}</td>
              </tr>
              <tr>
                <td className="pr-4 py-0.5 text-gray-500 text-left">Date</td>
                <td className="py-0.5 font-bold text-right">
                  {issuedAt.toLocaleDateString("en-GB")}
                </td>
              </tr>
              <tr>
                <td className="pr-4 py-0.5 text-gray-500 text-left">Time</td>
                <td className="py-0.5 font-bold text-right">
                  {issuedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BILL TO / VEHICLE */}
      <div className="flex justify-between gap-8 mt-6">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Bill To
          </div>
          <div className="text-base font-bold text-gray-900">{customer || "Walk-in Customer"}</div>
          {customerPhone && <div className="text-xs text-gray-600 mt-0.5">{customerPhone}</div>}
        </div>

        {vehicle && (
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              Vehicle
            </div>
            <div className="text-base font-bold text-gray-900">{vehicle}</div>
          </div>
        )}

        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
            Status
          </div>
          <span
            className={`inline-block px-3 py-1 rounded text-[11px] font-black uppercase tracking-wide border-2 ${
              paymentStatus === "PAID"
                ? "border-green-700 text-green-700"
                : "border-amber-600 text-amber-700"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* LINE ITEMS */}
      <table className="w-full mt-8 text-xs border-collapse">
        <thead>
          <tr className="bg-gray-900 text-white text-[10px] uppercase tracking-wider">
            <th className="py-2.5 px-3 text-left w-[6%]">#</th>
            <th className="py-2.5 px-3 text-left w-[42%]">Description</th>
            <th className="py-2.5 px-3 text-center w-[8%]">Qty</th>
            <th className="py-2.5 px-3 text-right w-[15%]">Unit Price</th>
            <th className="py-2.5 px-3 text-right w-[14%]">Discount</th>
            <th className="py-2.5 px-3 text-right w-[15%]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b border-gray-200 align-top">
              <td className="py-2.5 px-3 text-gray-500">{index + 1}</td>
              <td className="py-2.5 px-3">
                <div className="font-bold text-gray-900">{item.name}</div>
                {item.part_number && (
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {item.part_number}
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 text-center">{item.qty}</td>
              <td className="py-2.5 px-3 text-right">{item.originalPrice.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-right">
                {item.discountAmount > 0 ? `- ${(item.discountAmount * item.qty).toFixed(2)}` : "—"}
              </td>
              <td className="py-2.5 px-3 text-right font-bold">{item.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="flex justify-end mt-6">
        <table className="text-sm w-[45%]">
          <tbody>
            {totalSavings > 0 && (
              <>
                <tr>
                  <td className="py-1.5 text-gray-600">Subtotal</td>
                  <td className="py-1.5 text-right">{formatLKR(grandTotal + totalSavings)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-gray-600">Discount</td>
                  <td className="py-1.5 text-right">- {formatLKR(totalSavings)}</td>
                </tr>
              </>
            )}
            <tr className="border-t-2 border-gray-900">
              <td className="py-2.5 text-base font-black uppercase">Total</td>
              <td className="py-2.5 text-right text-base font-black">{formatLKR(grandTotal)}</td>
            </tr>
            {paymentStatus !== "PAID" && (
              <>
                <tr>
                  <td className="py-1.5 text-gray-600">Amount Paid</td>
                  <td className="py-1.5 text-right">{formatLKR(amountPaid)}</td>
                </tr>
                <tr className="border-t border-gray-300">
                  <td className="py-2 font-black uppercase text-red-700">Balance Due</td>
                  <td className="py-2 text-right font-black text-red-700">
                    {formatLKR(balanceDue)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {sale?.credit_note && paymentStatus !== "PAID" && (
        <div className="mt-4 text-xs text-gray-700 border border-gray-300 rounded p-3">
          <span className="font-bold uppercase text-[10px] tracking-wider text-gray-500">
            Credit Note:{" "}
          </span>
          {sale.credit_note}
        </div>
      )}

      {/* TERMS & SIGNATURES */}
      <div className="mt-12 pt-6 border-t border-gray-300">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          Terms &amp; Conditions
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed max-w-[60%]">
          Please retain this invoice for warranty claims. No refunds or returns on electrical
          parts. Goods remain the property of NSS Auto Spares until paid in full.
        </p>

        <div className="flex justify-between items-end mt-16">
          <div className="w-[35%] border-t border-gray-500 pt-2 text-[11px] text-gray-600 text-center">
            Customer Signature
          </div>
          <div className="w-[35%] border-t border-gray-500 pt-2 text-[11px] text-gray-600 text-center">
            For NSS Auto Spares
          </div>
        </div>

        <p className="text-center text-xs font-bold text-gray-700 mt-10">
          Thank you for your business!
        </p>
      </div>
    </div>
  );
});

export default Invoice;
