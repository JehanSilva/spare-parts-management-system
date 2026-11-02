import React, { useCallback, useEffect, useState } from "react";
import { fetchDailyReport } from "../services/api";
import { Link } from "react-router-dom";
import {
  FileText,
  Printer,
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Package,
  ShoppingBag,
  Activity,
  Wallet,
  Wrench,
  Car,
  RefreshCw,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// YYYY-MM-DD in the browser's local time. toISOString() is UTC, which in
// Sri Lanka (UTC+5:30) still says "yesterday" until 5:30 AM.
const toLocalISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Parse YYYY-MM-DD as a local calendar date (new Date("2026-11-02") is UTC
// midnight, which shows the previous day west of Greenwich).
const fromISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const shiftDate = (iso, days) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

const num = (v) => parseFloat(v || 0);

const formatLKR = (amount) =>
  `LKR ${num(amount).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const compactRs = (value) =>
  value >= 1000 ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : `${value}`;

const PAYMENT_BADGE = {
  PAID: { label: "Paid", cls: "bg-green-50 text-green-700 border-green-200" },
  PARTIAL: { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CREDIT: { label: "Credit", cls: "bg-red-50 text-red-700 border-red-200" },
};

const MetricCard = ({ icon: Icon, label, value, sub, tone }) => (
  <div className={`print-metric-card p-5 rounded-2xl border ${tone.card}`}>
    <div className={`metric-icon w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${tone.icon}`}>
      <Icon size={20} />
    </div>
    <p className={`metric-label text-xs font-bold uppercase tracking-wider mb-1 ${tone.label}`}>{label}</p>
    <p className={`metric-value text-xl xl:text-2xl font-black ${tone.value || "text-gray-900"}`}>{value}</p>
    {sub && <p className="metric-sub text-xs text-gray-500 mt-1.5 leading-snug">{sub}</p>}
  </div>
);

const TONES = {
  gray: { card: "bg-gray-50 border-gray-100", icon: "bg-indigo-100 text-indigo-600", label: "text-gray-500" },
  orange: { card: "bg-orange-50 border-orange-100", icon: "bg-orange-100 text-orange-600", label: "text-orange-800" },
  green: { card: "bg-green-50 border-green-100", icon: "bg-green-100 text-green-600", label: "text-green-800" },
  red: { card: "bg-red-50 border-red-100", icon: "bg-red-100 text-red-600", label: "text-red-800", value: "text-red-700" },
  blue: { card: "bg-blue-50 border-blue-100", icon: "bg-blue-100 text-blue-600", label: "text-blue-800" },
  purple: { card: "bg-purple-50 border-purple-100", icon: "bg-purple-100 text-purple-600", label: "text-purple-800" },
};

const ReportSkeleton = () => (
  <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-10 animate-pulse">
    <div className="h-8 w-64 bg-gray-200 rounded mx-auto mb-3" />
    <div className="h-5 w-48 bg-gray-100 rounded mx-auto mb-10" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-36 bg-gray-100 rounded-2xl" />
      ))}
    </div>
    <div className="h-20 bg-gray-100 rounded-2xl mb-10" />
    <div className="h-64 bg-gray-100 rounded-2xl" />
  </div>
);

// "vs average day" strip. Neutral (not a red -100%) when there's nothing to
// compare yet: no earlier sales, or today with no sales so far.
const Comparison = ({ report }) => {
  const change = report.percentage_change;
  const revenue = num(report.today_revenue);
  const hasBaseline = report.avg_daily_revenue !== null && report.avg_daily_revenue !== undefined;

  let pill;
  let note;
  if (!hasBaseline) {
    note = "No earlier sales to compare against yet.";
  } else if (revenue === 0 && report.is_today) {
    note = `No sales yet today. An average day brings in ${formatLKR(report.avg_daily_revenue)}.`;
  } else {
    note = `Average day before this date: ${formatLKR(report.avg_daily_revenue)}${report.is_today ? " · today is still in progress" : ""}`;
    if (change !== null && change !== undefined) {
      const up = change >= 0;
      pill = (
        <div
          className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-lg whitespace-nowrap border ${up ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
            }`}
        >
          {up ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          {up ? "+" : "−"}
          {Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
        </div>
      );
    }
  }

  return (
    <div className="print-performance mb-10 print:mb-6 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4 text-center sm:text-left">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">Revenue vs Average Day</h3>
        <p className="text-xs sm:text-sm text-gray-500">{note}</p>
      </div>
      {pill || (
        <div className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-gray-500 bg-gray-100 border border-gray-200 whitespace-nowrap">
          <Minus size={18} /> No comparison
        </div>
      )}
    </div>
  );
};

const DailyReportPage = () => {
  const today = toLocalISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReport = useCallback(async (date, { quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      const data = await fetchDailyReport(date);
      setReportData(data);
    } catch (err) {
      console.error("Failed to load daily report:", err);
      setError("Could not load the report for this day.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ignore a response for a date the user has already moved away from.
    let active = true;
    setLoading(true);
    setError(null);
    fetchDailyReport(selectedDate)
      .then((data) => active && setReportData(data))
      .catch((err) => {
        console.error("Failed to load daily report:", err);
        if (active) setError("Could not load the report for this day.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [selectedDate]);

  const isToday = selectedDate === today;
  const displayDateStr = fromISO(selectedDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleDateInput = (value) => {
    if (!value) return;
    setSelectedDate(value > today ? today : value);
  };

  const r = reportData;
  const profit = r ? num(r.today_profit) : 0;
  const hasSales = r && r.sales && r.sales.length > 0;
  const hasChart = r && r.chart_data && r.chart_data.some((d) => d.revenue > 0);

  return (
    <div className="min-h-screen print:min-h-0 bg-gray-50 print:bg-white pb-12 print:pb-0">
      <div className="max-w-6xl print:max-w-none print:w-full mx-auto p-4 md:p-8 print:p-0">
        {/* --- Header & Actions (hidden in print) --- */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 print:hidden gap-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">Daily Sales Report</h1>
              <p className="text-sm md:text-base text-gray-500">End-of-day summary & analytics</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-r border-gray-200"
                title="Previous day"
              >
                <ChevronLeft size={20} />
              </button>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => handleDateInput(e.target.value)}
                className="flex-1 px-3 py-3 outline-none text-gray-700 font-medium bg-transparent"
              />
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={isToday}
                className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-l border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                title="Next day"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 shadow-sm"
              >
                Today
              </button>
            )}
            <button
              onClick={() => window.print()}
              disabled={loading || !!error || !r}
              className="flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Printer size={20} /> Download PDF / Print
            </button>
          </div>
        </div>

        {loading ? (
          <ReportSkeleton />
        ) : error || !r ? (
          <div className="bg-white p-10 rounded-3xl border border-red-200 shadow-sm text-center">
            <p className="text-red-600 font-medium mb-4">{error || "No report data."}</p>
            <button
              onClick={() => loadReport(selectedDate)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
            >
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        ) : (
          /* --- PRINTABLE REPORT --- */
          <div className="print-report-container bg-white rounded-3xl md:shadow-lg border border-gray-100 print:border-none print:shadow-none p-6 md:p-10 w-full">
            {/* Report header */}
            <div className="mb-10 print:mb-6 text-center border-b-[3px] border-red-600 pb-6 print:pb-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 uppercase tracking-wider">
                NSS Auto Spares
              </h1>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-600">Daily Operating Report</h2>
              <p className="text-gray-500 mt-2 font-medium">{displayDateStr}</p>
              {r.is_today && (
                <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse print:hidden" />
                  Day in progress — figures so far
                  <button
                    onClick={() => loadReport(selectedDate, { quiet: true })}
                    className="ml-1 text-amber-600 hover:text-amber-900 print:hidden"
                    title="Refresh"
                  >
                    <RefreshCw size={12} />
                  </button>
                </span>
              )}
            </div>

            {/* Key metrics */}
            <div className="print-metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10 print:mb-6">
              <MetricCard
                icon={ShoppingBag}
                tone={TONES.gray}
                label="Sales"
                value={r.today_sales_count}
                sub={
                  <>
                    {r.today_sales_count > 0 ? `Avg ${formatLKR(r.average_sale)}` : "No completed sales"}
                    {r.cancelled_count > 0 && (
                      <span className="block text-red-600">{r.cancelled_count} cancelled</span>
                    )}
                  </>
                }
              />
              <MetricCard
                icon={DollarSign}
                tone={TONES.orange}
                label="Revenue"
                value={formatLKR(r.today_revenue)}
                sub={
                  <>
                    Parts {formatLKR(r.parts_revenue)}
                    <span className="block">Labour {formatLKR(r.labor_revenue)}</span>
                  </>
                }
              />
              <MetricCard
                icon={Activity}
                tone={profit >= 0 ? TONES.green : TONES.red}
                label={profit >= 0 ? "Gross Profit" : "Gross Loss"}
                value={formatLKR(profit)}
                sub={`Margin ${num(r.margin_percentage).toFixed(1)}% · Markup on parts ${num(r.roi_percentage).toFixed(1)}%`}
              />
              <MetricCard
                icon={Package}
                tone={TONES.blue}
                label="Cost of Parts Sold"
                value={formatLKR(r.total_investment)}
                sub={`${r.units_sold} part unit${r.units_sold === 1 ? "" : "s"} sold`}
              />
              <MetricCard
                icon={Wallet}
                tone={num(r.balance_due) > 0 ? TONES.red : TONES.purple}
                label="Collected"
                value={formatLKR(r.collected)}
                sub={
                  num(r.balance_due) > 0
                    ? `${formatLKR(r.balance_due)} still owed`
                    : r.today_sales_count > 0
                      ? "Fully paid"
                      : "—"
                }
              />
            </div>

            <Comparison report={r} />

            {/* Hourly chart (hidden in print) */}
            <div className="print-chart-section mb-10">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">
                Hourly Revenue & Profit
              </h3>
              <div className="h-64 sm:h-80 w-full bg-gray-50/50 p-2 sm:p-4 rounded-xl border border-gray-100 text-xs sm:text-sm">
                {hasChart ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={compactRs} tick={{ fill: "#6B7280", fontSize: 12 }} width={48} />
                      <Tooltip
                        formatter={(value, name) => [formatLKR(value), name]}
                        labelFormatter={(label, payload) => {
                          const sales = payload?.[0]?.payload?.sales || 0;
                          return `${label} · ${sales} sale${sales === 1 ? "" : "s"}`;
                        }}
                        cursor={{ fill: "#f3f4f6" }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="revenue" name="Revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FileText size={48} opacity={0.2} className="mb-4" />
                    <p>{r.is_today ? "No sales yet today." : "No sales on this day."}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sales breakdown, grouped by sale */}
            <div className="print-table-section">
              <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Package className="text-gray-400" />
                Sales Breakdown
              </h3>

              {hasSales ? (
                <div className="border border-gray-200 rounded-xl print:border-0 print:rounded-none overflow-x-auto">
                  <table className="w-full text-left bg-white text-xs md:text-sm min-w-[640px]">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-extrabold tracking-wider border-b border-gray-200 text-[10px] md:text-xs">
                      <tr>
                        <th className="col-part p-3">Item</th>
                        <th className="col-price p-3 text-right">Unit Price</th>
                        <th className="col-qty p-3 text-center">Qty</th>
                        <th className="col-discount p-3 text-right">Discount</th>
                        <th className="col-total p-3 text-right">Total</th>
                        <th className="col-profit p-3 text-right text-green-700">Profit</th>
                      </tr>
                    </thead>
                    {r.sales.map((sale) => {
                      const badge = PAYMENT_BADGE[sale.payment_status] || PAYMENT_BADGE.PAID;
                      return (
                        <tbody key={sale.id} className="border-b-2 border-gray-200 last:border-b-0">
                          <tr className="sale-group-row bg-gray-50/80">
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-mono font-bold text-gray-900">{sale.time}</span>
                                {sale.vehicle_number && (
                                  <span className="inline-flex items-center gap-1 font-bold text-gray-800">
                                    <Car size={13} className="text-gray-400" />
                                    {sale.vehicle_number}
                                  </span>
                                )}
                                <span className="text-gray-600 truncate">{sale.customer_name}</span>
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${badge.cls}`}>
                                  {badge.label}
                                </span>
                                {num(sale.balance_due) > 0 && (
                                  <span className="text-[11px] font-semibold text-red-600">
                                    {formatLKR(sale.balance_due)} due
                                  </span>
                                )}
                                <span className="ml-auto font-black text-gray-900">{formatLKR(sale.total_amount)}</span>
                              </div>
                            </td>
                          </tr>
                          {sale.items.map((item, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="col-part p-3 align-middle">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                                    {item.item_type === "LABOR" && <Wrench size={12} className="text-blue-500 shrink-0" />}
                                    {item.part_name}
                                  </span>
                                  <span className="text-[10px] md:text-xs text-gray-500 font-mono">
                                    {item.item_type === "LABOR" ? "Repair / Labour" : item.part_number}
                                  </span>
                                </div>
                              </td>
                              <td className="col-price p-3 text-right font-medium text-gray-600 whitespace-nowrap align-middle">
                                {formatLKR(item.unit_price)}
                                {item.price_raised && (
                                  <span
                                    className="flex items-center justify-end gap-0.5 text-[10px] font-bold text-amber-700"
                                    title="Price raised above the catalog price for this sale"
                                  >
                                    <ArrowUp size={10} /> from {num(item.list_price).toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="col-qty p-3 text-center align-middle font-bold text-gray-800">{item.quantity}</td>
                              <td className="col-discount p-3 text-right text-red-500 font-medium whitespace-nowrap align-middle">
                                {num(item.discount_total) > 0 ? `−${formatLKR(item.discount_total)}` : "—"}
                              </td>
                              <td className="col-total p-3 text-right font-bold text-gray-900 whitespace-nowrap align-middle">
                                {formatLKR(item.total_price)}
                              </td>
                              <td
                                className={`col-profit p-3 text-right font-bold whitespace-nowrap align-middle ${num(item.profit) >= 0 ? "text-green-600" : "text-red-600"
                                  }`}
                              >
                                {num(item.profit) >= 0 ? "+" : ""}
                                {formatLKR(item.profit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      );
                    })}
                    <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
                      {num(r.discount_total) > 0 && (
                        <tr>
                          <td colSpan={5} className="p-3 text-right text-gray-700 uppercase tracking-wider text-[10px] md:text-xs">
                            Discounts given
                          </td>
                          <td className="p-3 text-right text-red-600 whitespace-nowrap">−{formatLKR(r.discount_total)}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={5} className="p-3 text-right text-gray-700 uppercase tracking-wider text-[10px] md:text-xs">
                          Total revenue
                        </td>
                        <td className="p-3 text-right text-lg text-gray-900 whitespace-nowrap">{formatLKR(r.today_revenue)}</td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="p-3 text-right text-gray-700 uppercase tracking-wider text-[10px] md:text-xs">
                          Gross profit
                        </td>
                        <td className={`p-3 text-right text-lg font-black whitespace-nowrap ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {formatLKR(profit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center p-12 border border-dashed border-gray-300 rounded-xl text-gray-500 bg-gray-50">
                  <p className="font-medium">{r.is_today ? "No items sold today yet." : "No items were sold on this day."}</p>
                </div>
              )}

              <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
                Profit uses each part's cost at the time it was sold; labour has no cost and counts fully as profit. Cancelled sales are
                excluded. "Still owed" is the unpaid balance of this day's credit and partial sales as of now.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReportPage;
