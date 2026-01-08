import React, { useEffect, useState } from "react";
import { fetchSales } from "../services/api";
import {
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Car,
} from "lucide-react";

const SalesHistoryPage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSaleId, setExpandedSaleId] = useState(null);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    const data = await fetchSales();
    setSales(data);
    setLoading(false);
  };

  // Toggle row expansion to show items
  const toggleExpand = (id) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  // Filter Logic
  const filteredSales = sales.filter(
    (sale) =>
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.vehicle_number &&
        sale.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      sale.id.includes(searchTerm)
  );

  // Format Date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format Currency
  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
          <FileText className="w-8 h-8" /> Sales History
        </h1>
        <p className="text-gray-600 mt-1">
          View past invoices and transaction details.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by Customer, Vehicle No, or Invoice ID..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Sales List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading Sales Records...
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">Invoice ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">
                    No sales found matching your search.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    {/* Main Row */}
                    <tr
                      className={`hover:bg-red-50 transition cursor-pointer ${
                        expandedSaleId === sale.id ? "bg-red-50" : ""
                      }`}
                      onClick={() => toggleExpand(sale.id)}
                    >
                      <td className="p-4 font-mono text-xs text-gray-500">
                        #{sale.id.substring(0, 8)}
                      </td>
                      <td className="p-4 text-sm text-gray-600 flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />{" "}
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                        <User size={14} className="text-blue-500" />{" "}
                        {sale.customer_name}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {sale.vehicle_number ? (
                          <span className="flex items-center gap-2">
                            <Car size={14} className="text-orange-500" />{" "}
                            {sale.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-green-700">
                        {formatLKR(sale.total_amount)}
                      </td>
                      <td className="p-4 text-center text-gray-400">
                        {expandedSaleId === sale.id ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {expandedSaleId === sale.id && (
                      <tr className="bg-gray-50">
                        <td
                          colSpan="6"
                          className="p-4 border-t border-gray-200 shadow-inner"
                        >
                          <div className="ml-4 pl-4 border-l-2 border-red-300">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                              Purchased Items
                            </h4>
                            <table className="w-full max-w-2xl text-sm">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-200">
                                  <th className="pb-2 text-left">Part Name</th>
                                  <th className="pb-2 text-center">Qty</th>
                                  <th className="pb-2 text-right">
                                    Unit Price
                                  </th>
                                  <th className="pb-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sale.items.map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className="border-b border-gray-100 last:border-0"
                                  >
                                    {/* Note: item.part_details.name depends on your serializer depth. 
                                                                            If you only have part ID, we might need to adjust backend.
                                                                            Assuming SaleItemSerializer includes part details or name. */}
                                    <td className="py-2 text-gray-700 font-medium">
                                      {/* Backend usually returns ID. If you need Names here, update Serializer. */}
                                      Part ID: {item.part_name}
                                    </td>
                                    <td className="py-2 text-center">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 text-right">
                                      {formatLKR(item.unit_price)}
                                    </td>
                                    <td className="py-2 text-right font-bold text-gray-800">
                                      {formatLKR(
                                        item.quantity * item.unit_price
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;
