import React, { forwardRef } from "react";
import logo from "../assets/logo.png";

// Small uppercase label above a value — used across the info strip.
const InfoBlock = ({ label, children, align = "left" }) => (
  <div className={align === "right" ? "text-right" : ""}>
    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1">
      {label}
    </div>
    <div className="text-gray-900">{children}</div>
  </div>
);

// Full A4 invoice — the alternative to the 80mm thermal Receipt. Takes exactly
// the same props so the two are interchangeable wherever a sale needs to be
// documented (see BillingDocument).
//
// Everything here has to survive two very different renderers: window.print()
// and html2canvas (for the WhatsApp share image). That rules out CSS filters,
// object-fit and box-shadows, which html2canvas silently drops — hence the
// white logo tile rather than an inverted logo, and flat fills rather than
// gradients.
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
  const customerPhone = sale ? sale.customer_phone : "";
  const vehicle = sale ? sale.vehicle_number : "";

  const paymentStatus = sale ? sale.payment_status : "PAID";
  const amountPaid =
    paymentStatus === "PAID" ? grandTotal : parseFloat(sale?.amount_paid || 0);
  const amountDue = Math.max(grandTotal - amountPaid, 0);

  const statusLabel =
    paymentStatus === "CREDIT"
      ? "Credit — pay later"
      : paymentStatus === "PARTIAL"
      ? "Partially paid"
      : "Paid in full";

  return (
    <div
      ref={ref}
      className="billing-invoice bg-white text-black mx-auto text-[11px] leading-relaxed flex flex-col"
      style={{
        width: "210mm",
        minHeight: "297mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── HEADER BAND ─────────────────────────────────────────────────── */}
      <div className="bg-red-700 text-white px-10 py-7 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {/* White tile: the logo artwork is red, so it needs a light ground.
              Width-only sizing — html2canvas ignores object-fit and would
              stretch the ~2.4:1 mark to fill a fixed box. */}
          <div className="bg-white rounded-lg px-3 py-2 flex items-center">
            <img src={logo} alt="NSS Auto Spares" className="w-24 h-auto" />
          </div>
          <div>
            <div className="text-lg font-black uppercase tracking-wide leading-tight">
              NSS Auto Spares
            </div>
            <div className="text-[10px] text-red-100 leading-snug mt-1">
              <div>No. 272 Thudella, Ja-ela</div>
              <div>+94 71 618 8187</div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-black uppercase tracking-tight leading-none">Invoice</div>
          <div className="text-[10px] text-red-100 mt-2 tracking-wide">#{invoiceId}</div>
        </div>
      </div>

      {/* ── INFO STRIP ──────────────────────────────────────────────────── */}
      <div className="px-10 pt-7 pb-6 flex justify-between gap-6 border-b border-gray-200">
        <InfoBlock label="Bill To">
          <div className="font-bold text-[12px]">{customer || "Walk-in customer"}</div>
          {customerPhone && <div className="text-gray-600">{customerPhone}</div>}
        </InfoBlock>

        {vehicle && (
          <InfoBlock label="Vehicle">
            <div className="font-bold text-[12px]">{vehicle}</div>
          </InfoBlock>
        )}

        <InfoBlock label="Invoice Date" align="right">
          <div className="font-bold text-[12px]">{issuedDate}</div>
        </InfoBlock>

        <InfoBlock label="Payment" align="right">
          <span
            className={`inline-block px-2.5 py-1 rounded font-bold text-[10px] uppercase tracking-wide ${
              paymentStatus === "PAID"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {statusLabel}
          </span>
        </InfoBlock>
      </div>

      {/* ── LINE ITEMS ──────────────────────────────────────────────────── */}
      <div className="px-10 pt-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-red-700 text-white text-[9px] uppercase tracking-[0.1em]">
              <th className="py-2.5 pl-3 pr-2 text-left font-bold w-[6%]">#</th>
              <th className="py-2.5 px-2 text-left font-bold w-[40%]">Description</th>
              <th className="py-2.5 px-2 text-center font-bold w-[8%]">Qty</th>
              <th className="py-2.5 px-2 text-right font-bold w-[16%]">Unit Price</th>
              <th className="py-2.5 px-2 text-right font-bold w-[14%]">Discount</th>
              <th className="py-2.5 pl-2 pr-3 text-right font-bold w-[16%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className={index % 2 ? "bg-gray-50" : "bg-white"}>
                <td className="py-2.5 pl-3 pr-2 align-top text-gray-400">{index + 1}</td>
                <td className="py-2.5 px-2 align-top">
                  <div className="font-bold text-gray-900">{item.name}</div>
                  {item.part_number && (
                    <div className="text-[9px] text-gray-500 mt-0.5">{item.part_number}</div>
                  )}
                </td>
                <td className="py-2.5 px-2 align-top text-center">{item.qty}</td>
                <td className="py-2.5 px-2 align-top text-right">
                  {formatAmount(item.originalPrice)}
                </td>
                <td className="py-2.5 px-2 align-top text-right text-gray-600">
                  {item.discountAmount > 0 ? `- ${formatAmount(item.discountAmount * item.qty)}` : "—"}
                </td>
                <td className="py-2.5 pl-2 pr-3 align-top text-right font-bold">
                  {formatAmount(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS ──────────────────────────────────────────────────────── */}
      <div className="px-10 pt-6 flex justify-end">
        <div className="w-[52%]">
          {/* px-3 throughout so every figure here lands on the same right
              edge as the table's Amount column above. */}
          {totalSavings > 0 && (
            <>
              <div className="flex justify-between px-3 py-1.5 text-gray-600">
                <span>Subtotal</span>
                <span>LKR {formatAmount(grandTotal + totalSavings)}</span>
              </div>
              <div className="flex justify-between px-3 py-1.5 text-gray-600 border-b border-gray-200">
                <span>Discount</span>
                <span>- LKR {formatAmount(totalSavings)}</span>
              </div>
            </>
          )}

          <div className="bg-red-700 text-white flex justify-between items-center px-3 py-3 mt-2 rounded">
            <span className="font-bold uppercase tracking-wide text-[11px]">Total</span>
            <span className="font-black text-base">LKR {formatAmount(grandTotal)}</span>
          </div>

          {paymentStatus !== "PAID" && (
            <>
              <div className="flex justify-between px-3 py-1.5 mt-1 text-gray-600">
                <span>Amount paid</span>
                <span>LKR {formatAmount(amountPaid)}</span>
              </div>
              <div className="flex justify-between px-3 py-2 border-t-2 border-gray-900 font-black">
                <span className="uppercase tracking-wide text-[11px]">Balance due</span>
                <span>LKR {formatAmount(amountDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── NOTES ───────────────────────────────────────────────────────── */}
      {sale?.credit_note && paymentStatus !== "PAID" && (
        <div className="px-10 pt-6">
          <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-800">
              Note
            </span>
            <div className="text-gray-800">{sale.credit_note}</div>
          </div>
        </div>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <div className="px-10 pt-8 mt-auto">
        <div className="border-t border-gray-200 pt-5 flex justify-between gap-10 items-end">
          <div className="text-[10px] text-gray-600 leading-relaxed max-w-[62%]">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
              Terms
            </div>
            {amountDue > 0 ? (
              <p className="mb-1">
                Please settle the outstanding balance within 14 days, quoting the invoice number
                above.
              </p>
            ) : (
              <p className="mb-1">Paid in full — no further payment is due.</p>
            )}
            <p>
              Please retain this invoice for warranty claims. No refunds or returns on electrical
              parts.
            </p>
          </div>

          <div className="text-center shrink-0">
            <div className="w-44 border-t border-gray-400 pt-1.5 text-[10px] text-gray-600">
              For NSS Auto Spares
            </div>
          </div>
        </div>
      </div>

      {/* Base rule closing the page, echoing the header band. */}
      <div className="bg-red-700 h-2 mt-8" />
    </div>
  );
});

export default Invoice;
