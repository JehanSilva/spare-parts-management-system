import React, { forwardRef } from "react";
import logo from "../assets/logo.png";

const Receipt = forwardRef(({ sale, cartItems }, ref) => {
  // Helper for currency
  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // 1. Determine items source
  const rawItems = sale ? sale.items : cartItems || [];

  // 2. Process items to calculate finals
  let grandTotal = 0;
  let totalSavings = 0;

  const items = rawItems.map((item) => {
    const originalPrice = parseFloat(item.unit_price || item.sell_price || 0);
    const qty = parseInt(item.quantity || 1);

    let discountAmount = 0;

    // CHECK 1: Backend History (Stored as 'discount' cash value)
    if (item.discount !== undefined && item.discount !== null) {
      discountAmount = parseFloat(item.discount);
    }
    // CHECK 2: Live Cart (Stored as 'discountPercent')
    else if (item.discountPercent !== undefined) {
      discountAmount = originalPrice * (parseFloat(item.discountPercent) / 100);
    }

    const finalPrice = originalPrice - discountAmount;
    const lineTotal = finalPrice * qty;

    grandTotal += lineTotal;
    totalSavings += discountAmount * qty;

    return {
      name: item.part_name || item.name,
      part_number: item.part_number,
      qty,
      originalPrice,
      finalPrice,
      discountAmount,
      lineTotal,
    };
  });

  // Meta Info
  const date = sale
    ? new Date(sale.created_at).toLocaleString()
    : new Date().toLocaleString();
  const invoiceId = sale ? sale.id.substring(0, 8).toUpperCase() : "NEW";
  const customer = sale ? sale.customer_name : "Walk-in";
  const vehicle = sale ? sale.vehicle_number : "";

  return (
    <div
      ref={ref}
      className="p-4 bg-white text-black font-mono text-xs leading-tight max-w-[80mm] mx-auto min-h-screen"
      style={{ width: "100%" }}
    >
      {/* HEADER */}
      <div className="flex flex-col items-center text-center mb-4">
        <img
          src={logo}
          alt="Logo"
          className="w-16 h-16 object-contain mb-2 grayscale"
        />
        <h1 className="text-xl font-bold uppercase tracking-wider">
          NSS Auto Spares
        </h1>
        <div className="mt-2 flex flex-col items-center gap-1 text-[10px]">
          <span>No. 272 Thudella, Ja-ela</span>
          <span>+94 71 618 8187</span>
        </div>
      </div>

      <div className="border-b-2 border-black border-dashed my-2"></div>

      {/* META */}
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>Invoice:</span>
          <span className="font-bold">{invoiceId}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span className="text-right truncate">{customer}</span>
        </div>
        {vehicle && (
          <div className="flex justify-between">
            <span>Vehicle:</span>
            <span className="font-bold">{vehicle}</span>
          </div>
        )}
      </div>

      <div className="border-b-2 border-black border-dashed mb-2"></div>

      {/* TABLE */}
      <table className="w-full text-left mb-2">
        <thead>
          <tr className="text-[10px] uppercase border-b border-black border-dotted">
            <th className="pb-1 w-[40%]">Item</th>
            <th className="pb-1 text-center w-[15%]">Qty</th>
            <th className="pb-1 text-right w-[25%]">Price</th>
            <th className="pb-1 text-right w-[20%]">Total</th>
          </tr>
        </thead>
        <tbody className="text-[11px]">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-2 pr-1 align-top">
                <div className="font-bold">{item.name}</div>
                {item.part_number && (
                  <div className="text-[9px] text-gray-500">
                    {item.part_number}
                  </div>
                )}
              </td>
              <td className="py-2 text-center align-top">{item.qty}</td>
              <td className="py-2 text-right align-top">
                {item.discountAmount > 0 ? (
                  <div className="flex flex-col items-end leading-none gap-0.5">
                    <span className="line-through text-[9px] text-gray-400">
                      {Math.round(item.originalPrice)}
                    </span>
                    <span className="font-bold">
                      {Math.round(item.finalPrice)}
                    </span>
                  </div>
                ) : (
                  <span>{Math.round(item.originalPrice)}</span>
                )}
              </td>
              <td className="py-2 text-right font-bold align-top">
                {Math.round(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b-2 border-black border-dashed mb-2"></div>

      {/* TOTALS */}
      <div className="flex flex-col gap-1 text-right mb-4">
        {totalSavings > 0 && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal:</span>
            <span>{formatLKR(grandTotal + totalSavings)}</span>
          </div>
        )}
        {totalSavings > 0 && (
          <div className="flex justify-between text-sm font-bold">
            <span>Discount:</span>
            <span>- {formatLKR(totalSavings)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl font-bold border-t border-black border-dotted pt-2 mt-1">
          <span>TOTAL:</span>
          <span>{formatLKR(grandTotal)}</span>
        </div>
        {totalSavings > 0 && (
          <div className="text-center text-[10px] font-bold border border-black rounded p-1 mt-3">
            *** YOU SAVED {formatLKR(totalSavings)} ***
          </div>
        )}
      </div>

      <div className="text-center space-y-2 border-t border-black border-dotted pt-4">
        <p className="font-bold uppercase">Important Notice</p>
        <p className="text-[10px] leading-tight text-justify">
          Please retain receipt for warranty. No refunds on Electrical Parts.
        </p>
        <p className="font-bold text-sm mt-2">Thank You!</p>
      </div>
    </div>
  );
});

export default Receipt;
