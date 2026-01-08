import React, { forwardRef } from "react";

const Receipt = forwardRef(({ sale, cartItems }, ref) => {
  // Helper for currency
  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);
  };

  // Calculate total (works if passed 'sale' object OR 'cartItems' array)
  const items = sale ? sale.items : cartItems;
  const total = sale
    ? parseFloat(sale.total_amount)
    : items.reduce(
        (sum, item) =>
          sum + parseFloat(item.sell_price || item.unit_price) * item.quantity,
        0
      );

  const date = sale
    ? new Date(sale.created_at).toLocaleString()
    : new Date().toLocaleString();
  const invoiceId = sale ? sale.id.substring(0, 8).toUpperCase() : "NEW";
  const customer = sale ? sale.customer_name : "Walk-in Customer";
  const vehicle = sale ? sale.vehicle_number : "";

  return (
    <div
      ref={ref}
      className="p-4 bg-white text-black font-mono text-sm max-w-md mx-auto print:max-w-full"
    >
      {/* Header */}
      <div className="text-center mb-4 border-b border-black pb-2">
        <h1 className="text-2xl font-bold uppercase">NSS Auto Engineers</h1>
        <p className="text-xs">123 Main Street, Colombo</p>
        <p className="text-xs">Tel: +94 77 123 4567</p>
      </div>

      {/* Info */}
      <div className="mb-4 text-xs">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>Invoice #:</span>
          <span>{invoiceId}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span>{customer}</span>
        </div>
        {vehicle && (
          <div className="flex justify-between">
            <span>Vehicle:</span>
            <span>{vehicle}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-left mb-4 border-b border-black pb-2">
        <thead>
          <tr className="border-b border-black border-dashed">
            <th className="py-1">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const price = parseFloat(item.unit_price || item.sell_price);
            const name = item.part_name || item.name; // Handle both backend/frontend structures
            return (
              <tr key={index}>
                <td className="py-1 pr-2">{name}</td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right">{price.toFixed(2)}</td>
                <td className="py-1 text-right font-bold">
                  {(price * item.quantity).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-between items-center text-lg font-bold border-b border-black pb-2 mb-4">
        <span>TOTAL:</span>
        <span>{formatLKR(total)}</span>
      </div>

      {/* Footer */}
      <div className="text-center text-xs mt-4">
        <p>Thank you for your business!</p>
        <p>No refunds on electrical parts.</p>
        <p>Goods once sold cannot be returned.</p>
      </div>
    </div>
  );
});

export default Receipt;
