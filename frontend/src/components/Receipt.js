import React, { forwardRef } from "react";
import logo from "../assets/logo.png"; // Importing the logo
import { MapPin, Phone, Globe } from "lucide-react"; // Icons for professional look

const Receipt = forwardRef(
  ({ sale, cartItems, cashierName = "Admin" }, ref) => {
    // Helper for currency
    const formatLKR = (amount) => {
      return new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        minimumFractionDigits: 2,
      }).format(amount);
    };

    // Logic to handle both 'sale' object (History) and 'cartItems' (New Sale)
    const items = sale ? sale.items : cartItems || [];

    const total = sale
      ? parseFloat(sale.total_amount)
      : items.reduce(
          (sum, item) =>
            sum +
            parseFloat(item.sell_price || item.unit_price) * item.quantity,
          0,
        );

    const date = sale
      ? new Date(sale.created_at).toLocaleString()
      : new Date().toLocaleString();

    const invoiceId = sale ? sale.id.substring(0, 8).toUpperCase() : "PENDING";
    const customer = sale ? sale.customer_name : "Walk-in Customer";
    const vehicle = sale ? sale.vehicle_number : "N/A";

    // You can pass payment method in props later, defaulting for now
    const paymentMethod = "CASH";

    return (
      <div
        ref={ref}
        className="p-4 bg-white text-black font-mono text-xs leading-tight max-w-[80mm] mx-auto min-h-screen"
        style={{ width: "100%" }}
      >
        {/* --- HEADER --- */}
        <div className="flex flex-col items-center text-center mb-4">
          {/* Logo - Grayscale for thermal printers */}
          <img
            src={logo}
            alt="Logo"
            className="w-16 h-16 object-contain mb-2 grayscale"
          />

          <h1 className="text-xl font-bold uppercase tracking-wider">
            NSS Auto Spares
          </h1>
          {/* <p className="text-[10px] font-bold">Reg No: PV-123456</p> */}

          <div className="mt-2 flex flex-col items-center gap-1 text-[10px]">
            <span className="flex items-center gap-1">
              No. 272 Thudella, Ja-ela
            </span>
            <span className="flex items-center gap-1">+94 71 618 8187</span>
            <span>www.nssauto.lk</span>
          </div>
        </div>

        {/* --- DIVIDER --- */}
        <div className="border-b-2 border-black border-dashed my-2"></div>

        {/* --- META INFO --- */}
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{date}</span>
          </div>
          <div className="flex justify-between">
            <span>Invoice #:</span>
            <span className="font-bold">{invoiceId}</span>
          </div>
          {/* <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{cashierName}</span>
          </div> */}
          <div className="border-b border-black border-dotted my-1"></div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="text-right max-w-[60%] truncate">{customer}</span>
          </div>
          {vehicle && (
            <div className="flex justify-between">
              <span>Vehicle:</span>
              <span className="font-bold">{vehicle}</span>
            </div>
          )}
        </div>

        {/* --- ITEMS TABLE --- */}
        <div className="border-b-2 border-black border-dashed mb-2"></div>

        <table className="w-full text-left mb-2">
          <thead>
            <tr className="text-[10px] uppercase">
              <th className="pb-1 w-[45%]">Item</th>
              <th className="pb-1 text-center w-[15%]">Qty</th>
              <th className="pb-1 text-right w-[20%]">Price</th>
              <th className="pb-1 text-right w-[20%]">Amt</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {items.map((item, index) => {
              const price = parseFloat(item.unit_price || item.sell_price);
              const qty = parseInt(item.quantity);
              const lineTotal = price * qty;
              const name = item.part_name || item.name;

              return (
                <tr key={index}>
                  <td className="py-1 pr-1 align-top">
                    {name}
                    {/* Optional: Show part number below name */}
                    {item.part_number && (
                      <div className="text-[9px] text-gray-600">
                        {item.part_number}
                      </div>
                    )}
                  </td>
                  <td className="py-1 text-center align-top">{qty}</td>
                  <td className="py-1 text-right align-top">
                    {price.toFixed(0)}
                  </td>
                  <td className="py-1 text-right font-bold align-top">
                    {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-b-2 border-black border-dashed mb-2"></div>

        {/* --- TOTALS --- */}
        <div className="flex flex-col gap-1 text-right mb-4">
          <div className="flex justify-between text-xl font-bold">
            <span>TOTAL:</span>
            <span>{formatLKR(total)}</span>
          </div>
          {/* <div className="text-[10px] italic mt-1">
            Paid via: {paymentMethod}
          </div> */}
        </div>

        {/* --- FOOTER / DISCLAIMERS --- */}
        <div className="text-center space-y-2 border-t border-black border-dotted pt-2">
          <p className="font-bold uppercase">Important Notice</p>
          <p className="text-[10px] leading-tight text-justify">
            Please retain this receipt for warranty purposes.
            <strong> No refunds on Electrical Parts. </strong>
            Physical returns accepted within 3 days in original packaging.
          </p>

          {/* Simulated Barcode (Visual only) */}
          {/* <div className="my-3">
            <div className="h-8 bg-black w-3/4 mx-auto mb-1"></div>
            <p className="text-[9px] tracking-[5px]">{invoiceId}</p>
          </div> */}

          <p className="font-bold text-sm">Thank You!</p>
          <p className="text-[9px]">
            Software by NSS Auto Engineers Software Solutions
          </p>
        </div>
      </div>
    );
  },
);

export default Receipt;
