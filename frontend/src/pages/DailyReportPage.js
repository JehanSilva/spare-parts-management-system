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
  Activity,
  Percent
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
    return `LKR ${parseFloat(amount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const roi = reportData.roi_percentage !== undefined
    ? reportData.roi_percentage
    : (reportData.total_investment > 0 ? ((reportData.today_profit / reportData.total_investment) * 100) : 0);

  return (
    <div className="min-h-screen print:min-h-0 bg-gray-50 print:bg-white pb-12 print:pb-0">
      <div className="max-w-6xl print:max-w-none print:w-full mx-auto p-4 md:p-8 print:p-0">
        {/* --- Header & Actions (Hidden during print) --- */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 print:hidden gap-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors shadow-sm shrink-0">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">Daily Sales Report</h1>
              <p className="text-sm md:text-base text-gray-500">End-of-day summary & analytics</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-500 shadow-sm text-gray-700 font-medium"
            />
            <button
              onClick={handlePrint}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap"
            >
              <Printer size={20} /> Download PDF / Print
            </button>
          </div>
        </div>

        {/* --- PRINTABLE REPORT CONTENT --- */}
        <div className="print-report-container bg-white rounded-3xl md:shadow-lg border border-gray-100 print:border-none print:shadow-none p-6 md:p-10 w-full">
          
          {/* Report Header */}
          <div className="mb-10 print:mb-6 text-center border-b-[3px] border-red-600 pb-6 print:pb-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 uppercase tracking-wider">NSS Auto Spares</h1>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-600">Daily Operating Report</h2>
            <p className="text-gray-500 mt-2 font-medium">{displayDateStr}</p>
          </div>

          {/* --- Key Metrics Grid --- */}
          <div className="print-metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-12 print:mb-6">
            
            {/* Sales Count */}
            <div className="print-metric-card bg-gray-50 p-6 rounded-2xl border border-gray-100">
               <div className="metric-icon flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
               </div>
               <p className="metric-label text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Total Sales</p>
               <p className="metric-value text-2xl font-black text-gray-900">{reportData.today_sales_count}</p>
            </div>

            {/* Revenue */}
            <div className="print-metric-card bg-orange-50 p-6 rounded-2xl border border-orange-100">
               <div className="metric-icon flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
               </div>
               <p className="metric-label text-sm font-bold text-orange-800 uppercase tracking-wider mb-1">Revenue</p>
               <p className="metric-value text-2xl font-black text-gray-900">{formatLKR(reportData.today_revenue)}</p>
            </div>

            {/* Profit / Loss */}
            <div className={`${reportData.today_profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} p-6 rounded-2xl border relative overflow-hidden print:border-gray-300 print:bg-white`}>
               <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={`w-10 h-10 ${reportData.today_profit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} rounded-lg flex items-center justify-center`}>
                    <Activity size={20} />
                  </div>
               </div>
               <p className={`metric-label text-sm font-bold ${reportData.today_profit >= 0 ? 'text-green-800' : 'text-red-800'} uppercase tracking-wider mb-1 relative z-10`}>
                 {reportData.today_profit >= 0 ? 'Net Profit' : 'Net Loss'}
               </p>
               <p className={`metric-value text-2xl font-black ${reportData.today_profit >= 0 ? 'text-gray-900' : 'text-red-700'} relative z-10`}>
                 {formatLKR(reportData.today_profit)}
               </p>
            </div>

            {/* Cost of Goods Sold */}
            <div className="print-metric-card bg-blue-50 p-6 rounded-2xl border border-blue-100">
               <div className="metric-icon flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <Package size={20} />
                  </div>
               </div>
               <p className="metric-label text-sm font-bold text-blue-800 uppercase tracking-wider mb-1">Cost of Goods Sold</p>
               <p className="metric-value text-2xl font-black text-gray-900">{formatLKR(reportData.total_investment)}</p>
            </div>

            {/* Return on Investment (ROI) */}
            <div className={`print-metric-card ${roi >= 0 ? 'bg-purple-50 border-purple-100' : 'bg-red-50 border-red-100'} p-6 rounded-2xl border relative overflow-hidden print:border-gray-300 print:bg-white`}>
               <div className="metric-icon flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 ${roi >= 0 ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'} rounded-lg flex items-center justify-center`}>
                    <Percent size={20} />
                  </div>
               </div>
               <p className={`metric-label text-sm font-bold ${roi >= 0 ? 'text-purple-800' : 'text-red-800'} uppercase tracking-wider mb-1`}>ROI on COGS</p>
               <p className={`metric-value text-2xl font-black ${roi >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                 {parseFloat(roi).toFixed(2)}%
               </p>
            </div>
            
          </div>

          {/* --- Performance Indicator --- */}
          <div className="print-performance mb-12 print:mb-6 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-center sm:text-left">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">Performance vs All-Time Average</h3>
              <p className="text-xs sm:text-sm text-gray-500">Based on historical daily average of {formatLKR(reportData.avg_daily_revenue)}</p>
            </div>
            <div className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full font-bold text-lg sm:text-xl w-full sm:w-auto justify-center ${
              reportData.percentage_change >= 0 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {reportData.percentage_change >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              {Math.abs(reportData.percentage_change)}%
            </div>
          </div>

          {/* --- Chart (hidden in print via CSS) --- */}
          <div className="print-chart-section mb-12">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Hourly Revenue & Profit</h3>
            <div className="h-64 sm:h-80 w-full bg-gray-50/50 p-2 sm:p-4 rounded-xl border border-gray-100 text-xs sm:text-sm">
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
          <div className="print-table-section">
            <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Package className="text-gray-400" />
              Itemized Sales Breakdown
            </h3>
            
            {reportData.items && reportData.items.length > 0 ? (
              <div className="border border-gray-200 rounded-xl print:border-0 print:rounded-none mt-2 overflow-hidden">
                <table className="w-full text-left bg-white text-xs md:text-sm">
                  <thead className="bg-gray-100 text-gray-700 uppercase font-extrabold tracking-wider border-b border-gray-200 text-[10px] md:text-xs">
                    <tr>
                      <th className="col-part p-3 md:p-4">Part Info</th>
                      <th className="col-price p-3 md:p-4 text-right">Unit Price</th>
                      <th className="col-qty p-3 md:p-4 text-center">Qty</th>
                      <th className="col-discount p-3 md:p-4 text-right">Discount</th>
                      <th className="col-total p-3 md:p-4 text-right">Total</th>
                      <th className="col-profit p-3 md:p-4 text-right text-green-700">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="col-part p-3 md:p-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-gray-900 text-sm md:text-base">{item.part_name}</span>
                            <span className="text-[10px] md:text-xs text-gray-500 font-mono">{item.part_number}</span>
                          </div>
                        </td>
                        <td className="col-price p-3 md:p-4 text-right font-medium text-gray-600 whitespace-nowrap align-middle">
                          {formatLKR(item.unit_price)}
                        </td>
                        <td className="col-qty p-3 md:p-4 text-center align-middle">
                          <span className="bg-gray-100 print:bg-transparent text-gray-800 px-2 md:px-3 py-1 print:p-0 rounded-full print:rounded-none font-bold inline-block">{item.quantity}</span>
                        </td>
                        <td className="col-discount p-3 md:p-4 text-right text-red-500 font-medium whitespace-nowrap align-middle">
                          {parseFloat(item.discount) > 0 ? `-${formatLKR(item.discount)}` : '-'}
                        </td>
                        <td className="col-total p-3 md:p-4 text-right font-black text-gray-900 text-sm md:text-base whitespace-nowrap align-middle">
                          {formatLKR(item.total_price)}
                        </td>
                        <td className={`col-profit p-3 md:p-4 text-right font-bold text-sm md:text-base whitespace-nowrap align-middle ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.profit >= 0 ? `+${formatLKR(item.profit)}` : formatLKR(item.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Footer Totals */}
                  <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <tr>
                      <td colSpan="5" className="p-3 md:p-4 text-right text-gray-700 uppercase tracking-wider text-[10px] md:text-xs">Total Profit Review Today</td>
                      <td className="p-3 md:p-4 text-right text-lg md:text-xl font-black text-green-700 whitespace-nowrap">{formatLKR(reportData.today_profit)}</td>
                    </tr>
                    <tr>
                      <td colSpan="5" className="p-3 md:p-4 text-right text-gray-700 uppercase tracking-wider text-[10px] md:text-xs">Total Revenue Today</td>
                      <td className="p-3 md:p-4 text-right text-lg md:text-xl text-gray-900 whitespace-nowrap">{formatLKR(reportData.today_revenue)}</td>
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
