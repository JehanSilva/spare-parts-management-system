import React, { useEffect, useState, useRef } from "react";
import { fetchSales, fetchParts } from "../services/api"; // <--- Import fetchParts
import { useReactToPrint } from "react-to-print";
import Receipt from "../components/Receipt";
import {
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Car,
  Printer,
  Hash, // <--- Import Hash icon
} from "lucide-react";

const SalesHistoryPage = () => {
  const [sales, setSales] = useState([]);
  const [parts, setParts] = useState([]); // <--- New State for Parts
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSaleId, setExpandedSaleId] = useState(null);

  // --- Printing State ---
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);
  const receiptRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Invoice-${selectedSaleForPrint?.id || "Copy"}`,
    onAfterPrint: () => setSelectedSaleForPrint(null),
  });

  useEffect(() => {
    if (selectedSaleForPrint) {
      handlePrint();
    }
  }, [selectedSaleForPrint, handlePrint]);

  // --- NEW: Helper to enrich sale items with Part Numbers ---
  const getEnrichedSale = (sale) => {
    const enrichedItems = sale.items.map((item) => {
      // Find the original part in our list to get the Part Number
      // Note: Backend might send item.part or item.part_id
      const partId = item.part || item.part_id;
      const originalPart = parts.find((p) => p.id === partId);

      return {
        ...item,
        part_number: originalPart ? originalPart.part_number : "N/A",
        part_name:
          item.part_name || (originalPart ? originalPart.name : "Unknown"),
      };
    });
    return { ...sale, items: enrichedItems };
  };

  const printReceipt = (sale, e) => {
    e.stopPropagation();
    // Enrich the sale data before printing so Receipt.js sees the part_number
    const enriched = getEnrichedSale(sale);
    setSelectedSaleForPrint(enriched);
  };

  // --- Load Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load both Sales and Parts in parallel
        const [salesData, partsData] = await Promise.all([
          fetchSales(),
          fetchParts(),
        ]);
        setSales(salesData);
        setParts(partsData);
      } catch (error) {
        console.error("Failed to load data", error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  const filteredSales = sales.filter(
    (sale) =>
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.vehicle_number &&
        sale.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      sale.id.includes(searchTerm),
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount);
  };

  // Helper to find Part Number for display in table
  const getPartNumber = (partId) => {
    const p = parts.find((part) => part.id === partId);
    return p ? p.part_number : "";
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
          <FileText className="w-6 h-6 md:w-8 md:h-8" /> Sales History
        </h1>
        <p className="text-gray-600 mt-1 text-sm md:text-base">
          View past invoices and regenerate receipts.
        </p>
      </div>

      {/* Hidden Receipt Component */}
      <div className="hidden">
        {selectedSaleForPrint && (
          <Receipt ref={receiptRef} sale={selectedSaleForPrint} />
        )}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md w-full">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search Customer, Vehicle, Invoice..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- CONTENT --- */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto mb-2"></div>
          Loading Records...
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded shadow">
          No sales found.
        </div>
      ) : (
        <>
          {/* =========================================
              MOBILE VIEW (Cards)
             ========================================= */}
          <div className="md:hidden space-y-4">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Card Header */}
                <div
                  className="p-4 flex justify-between items-start cursor-pointer active:bg-gray-50"
                  onClick={() => toggleExpand(sale.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        #{sale.id.substring(0, 8)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(sale.created_at)}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {sale.customer_name}
                    </h3>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Car
                          size={14}
                          className={
                            sale.vehicle_number
                              ? "text-orange-500"
                              : "text-gray-300"
                          }
                        />
                        {sale.vehicle_number || "No Vehicle"}
                      </span>
                      <span className="text-lg font-bold text-green-700">
                        {formatLKR(sale.total_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 mt-1 text-gray-400">
                    {expandedSaleId === sale.id ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </div>

                {/* Expanded Details (Mobile) */}
                {expandedSaleId === sale.id && (
                  <div className="bg-gray-50 p-4 border-t border-gray-100 text-sm">
                    <button
                      onClick={(e) => printReceipt(sale, e)}
                      className="w-full bg-gray-800 text-white py-2 rounded mb-4 flex items-center justify-center gap-2 hover:bg-gray-900 shadow"
                    >
                      <Printer size={16} /> Print Receipt
                    </button>

                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                      Purchased Items
                    </h4>
                    <div className="space-y-3">
                      {sale.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between border-b border-gray-200 pb-2 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-gray-700">
                              {item.part_name || "Unknown Part"}
                            </p>
                            {/* Display Part Number */}
                            <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                              <Hash size={10} />
                              {getPartNumber(item.part || item.part_id)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.quantity} x {formatLKR(item.unit_price)}
                            </p>
                          </div>
                          <p className="font-bold text-gray-800">
                            {formatLKR(item.quantity * item.unit_price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* =========================================
              DESKTOP VIEW (Table)
             ========================================= */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold">
                <tr>
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Vehicle</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <React.Fragment key={sale.id}>
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
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="p-4 font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-blue-500" />
                          {sale.customer_name}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {sale.vehicle_number ? (
                          <span className="flex items-center gap-2">
                            <Car size={14} className="text-orange-500" />
                            {sale.vehicle_number}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-green-700">
                        {formatLKR(sale.total_amount)}
                      </td>
                      <td className="p-4 text-center text-gray-400 flex justify-center items-center gap-3">
                        <button
                          onClick={(e) => printReceipt(sale, e)}
                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition"
                          title="Print Receipt"
                        >
                          <Printer size={18} />
                        </button>
                        {expandedSaleId === sale.id ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Row (Desktop) */}
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
                            <table className="w-full max-w-3xl text-sm">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-200">
                                  <th className="pb-2 text-left">
                                    Part Details
                                  </th>
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
                                    <td className="py-2 text-gray-700 font-medium">
                                      <div>
                                        {item.part_name || "Unknown Part"}
                                      </div>
                                      {/* Display Part Number */}
                                      <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                        <Hash size={10} />
                                        {getPartNumber(
                                          item.part || item.part_id,
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 text-center">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 text-right">
                                      {formatLKR(item.unit_price)}
                                    </td>
                                    <td className="py-2 text-right font-bold text-gray-800">
                                      {formatLKR(
                                        item.quantity * item.unit_price,
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesHistoryPage;
