import React, { useEffect, useState } from "react";
import { fetchDailyReport } from "../services/api";
import { Link } from "react-router-dom";
import {
  FileText,
  Printer,
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Package,
  ShoppingBag,
  Activity
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

const DailyReportPage = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDailyReport(selectedDate);
        setReportData(data);
      } catch (err) {
        console.error("Failed to load daily report:", err);
        setError("Could not load daily report data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount || 0);
  };

  const displayDateStr = new Date(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-gray-500 animate-pulse">
          <Activity size={48} />
          <p className="font-medium text-lg">Compiling today's report...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-red-200 shadow-sm text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/" className="text-blue-600 hover:underline">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen print:min-h-0 bg-gray-50 print:bg-white pb-12 print:pb-0">
      <div className="max-w-6xl print:max-w-none print:w-full mx-auto p-4 md:p-8 print:p-0">
        {/* --- Header & Actions (Hidden during print) --- */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 print:hidden gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Daily Sales Report</h1>
              <p className="text-gray-500">End-of-day summary & analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-500 shadow-sm text-gray-700 font-medium"
            />
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
            >
              <Printer size={20} /> Download PDF / Print
            </button>
          </div>
        </div>

        {/* --- PRINTABLE REPORT CONTENT --- */}
        <div className="print:block bg-white rounded-3xl md:shadow-lg border border-gray-100 print:border-none print:shadow-none p-6 md:p-10 print:p-12 print:m-0 w-full min-h-screen print:min-h-0">
          
          {/* Report Header for Print */}
          <div className="mb-10 text-center border-b-[3px] border-red-600 pb-6 print:pb-4 print:mb-6">
            <h1 className="text-4xl print:text-5xl font-extrabold text-gray-900 mb-2 uppercase tracking-wider">NSS Auto Spares</h1>
            <h2 className="text-2xl print:text-3xl font-bold text-gray-600">Daily Operating Report</h2>
            <p className="text-gray-500 mt-2 font-medium print:text-lg">{displayDateStr}</p>
          </div>

          {/* --- Key Metrics Grid --- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12 print:mb-8 print:gap-4">
            
            {/* Sales Count */}
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative overflow-hidden print:border-gray-300">
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
               </div>
               <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 relative z-10">Total Sales</p>
               <p className="text-2xl font-black text-gray-900 relative z-10">{reportData.today_sales_count}</p>
            </div>

            {/* Revenue */}
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 relative overflow-hidden print:border-gray-300 print:bg-white">
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
               </div>
               <p className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-1 relative z-10">Revenue</p>
               <p className="text-2xl font-black text-gray-900 relative z-10">{formatLKR(reportData.today_revenue)}</p>
            </div>

            {/* Profit */}
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100 relative overflow-hidden print:border-green-300 print:bg-white">
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                    <Activity size={20} />
                  </div>
               </div>
               <p className="text-sm font-bold text-green-800 uppercase tracking-wider mb-1 relative z-10">Net Profit</p>
               <p className="text-2xl font-black text-gray-900 relative z-10">{formatLKR(reportData.today_profit)}</p>
            </div>

            {/* Investment Valuation */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden print:border-gray-300 print:bg-white">
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <Package size={20} />
                  </div>
               </div>
               <p className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-1 relative z-10" title="Investment cost of items sold today">Cost of Goods Sold</p>
               <p className="text-2xl font-black text-gray-900 relative z-10">
                 {formatLKR(reportData.total_investment)}
               </p>
            </div>
            
          </div>

          {/* --- Performance Indicator --- */}
          <div className="mb-12 print:mb-8 bg-white p-6 print:p-4 rounded-2xl border border-gray-100 shadow-sm print:shadow-none print:border print:border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-1 lg:text-xl print:text-lg">Performance vs All-Time Average</h3>
              <p className="text-sm text-gray-500">Based on historical daily average of {formatLKR(reportData.avg_daily_revenue)}</p>
            </div>
            <div className={`flex items-center gap-2 px-6 py-3 print:py-2 rounded-full font-bold text-xl print:text-lg ${
              reportData.percentage_change >= 0 
                ? 'bg-green-100 text-green-700 border border-green-200 print:border-green-400' 
                : 'bg-red-100 text-red-700 border border-red-200 print:border-red-400'
            }`}>
              {reportData.percentage_change >= 0 ? <TrendingUp className="print:w-5 print:h-5" size={24} /> : <TrendingDown className="print:w-5 print:h-5" size={24} />}
              {Math.abs(reportData.percentage_change)}%
            </div>
          </div>

          {/* --- Chart --- */}
          <div className="mb-12 print:mb-8 print:break-inside-avoid">
            <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 print:border-gray-300">Hourly Revenue & Profit</h3>
            <div className="h-80 print:h-64 w-full bg-gray-50/50 p-4 print:p-0 rounded-xl border border-gray-100 print:border-none print:bg-white text-sm">
              {reportData.chart_data && reportData.chart_data.some(d => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `Rs ${value}`} tick={{fill: '#6B7280', fontSize: 12}} />
                    <Tooltip formatter={(value) => formatLKR(value)} cursor={{fill: '#f3f4f6'}} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Bar dataKey="revenue" name="Revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FileText size={48} opacity={0.2} className="mb-4" />
                  <p>No sales activity registered today.</p>
                </div>
              )}
            </div>
          </div>

          {/* --- Sales Items Table --- */}
          <div className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Package className="text-gray-400" />
              Itemized Sales Breakdown
            </h3>
            
            {reportData.items && reportData.items.length > 0 ? (
              <div className="overflow-x-auto print:overflow-visible border border-gray-200 rounded-xl print:border-0 print:rounded-none mt-2">
                <table className="w-full text-left bg-white text-sm print:border-collapse print:border-y print:border-gray-400 table-auto">
                  <thead className="bg-gray-100 text-gray-700 uppercase font-extrabold tracking-wider print:bg-gray-200 print:text-black border-b border-gray-200 print:border-y print:border-gray-400">
                    <tr>
                      <th className="p-4 print:py-3 print:px-2 w-full md:w-auto">Part Info</th>
                      <th className="p-4 print:py-3 print:px-2 text-right whitespace-nowrap">Unit Price</th>
                      <th className="p-4 print:py-3 print:px-2 text-center whitespace-nowrap">Qty</th>
                      <th className="p-4 print:py-3 print:px-2 text-right whitespace-nowrap">Discount</th>
                      <th className="p-4 print:py-3 print:px-2 text-right whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-y print:divide-dashed print:divide-gray-300">
                    {reportData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors even:bg-gray-50/50 print:even:bg-transparent">
                        <td className="p-4 print:py-4 print:px-2 align-middle">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-gray-900 text-base print:whitespace-nowrap">{item.part_name}</span>
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 self-start px-2 py-0.5 rounded print:bg-transparent print:p-0 print:border print:border-gray-300 print:px-1 print:whitespace-nowrap">{item.part_number}</span>
                          </div>
                        </td>
                        <td className="p-4 print:py-4 print:px-2 text-right font-medium text-gray-600 whitespace-nowrap align-middle">
                          {formatLKR(item.unit_price)}
                        </td>
                        <td className="p-4 print:py-4 print:px-2 text-center align-middle">
                          <span className="bg-gray-100 print:bg-transparent text-gray-800 px-3 py-1 print:p-0 rounded-full print:rounded-none font-bold inline-block whitespace-nowrap">{item.quantity}</span>
                        </td>
                        <td className="p-4 print:py-4 print:px-2 text-right text-red-500 font-medium whitespace-nowrap align-middle">
                          {parseFloat(item.discount) > 0 ? `-${formatLKR(item.discount)}` : '-'}
                        </td>
                        <td className="p-4 print:py-4 print:px-2 text-right font-black text-gray-900 text-base whitespace-nowrap align-middle">
                          {formatLKR(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Footer Totals */}
                  <tfoot className="bg-gray-50 font-bold print:bg-gray-100 border-t-2 border-gray-300 print:border-y-2 print:border-gray-800">
                    <tr>
                      <td colSpan="4" className="p-4 print:py-4 print:px-2 text-right text-gray-700 uppercase tracking-wider text-xs">Total Revenue Today</td>
                      <td className="p-4 print:py-4 print:px-2 text-right text-xl text-gray-900 whitespace-nowrap">{formatLKR(reportData.today_revenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center p-12 border border-dashed border-gray-300 rounded-xl text-gray-500 bg-gray-50">
                <p className="font-medium">No items sold today yet.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default DailyReportPage;
