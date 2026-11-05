import React, { useCallback, useEffect, useState } from "react";
import { fetchDailyReport, fetchMonthlyReport } from "../services/api";
import { Link, useSearchParams } from "react-router-dom";
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
  Users,
  Calendar,
  CalendarDays,
  AlertCircle,
  Trophy,
  Landmark,
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

// Months are "YYYY-MM" strings throughout.
const toMonthISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return toMonthISO(new Date(y, m - 1 + n, 1));
};
const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
const shortMonth = (year, month) => new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long" });

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

const DailyContent = ({ r, displayDateStr, onRefresh }) => {
  const profit = num(r.today_profit);
  const hasSales = r.sales && r.sales.length > 0;
  const hasChart = r.chart_data && r.chart_data.some((d) => d.revenue > 0);
  return (
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
              onClick={onRefresh}
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
              {num(r.labor_cost) > 0 && (
                <span className="block">Repair costs −{formatLKR(r.labor_cost)}</span>
              )}
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
                            {item.item_type === "LABOR" && num(item.unit_cost) > 0 && (
                              <span className="text-[10px] md:text-xs text-gray-500">
                                Our cost {formatLKR(num(item.unit_cost) * item.quantity)}
                              </span>
                            )}
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
  );
};

// --- Monthly view ---

const SALARY_BADGE = {
  PAID: { label: "Paid", cls: "bg-green-50 text-green-700 border-green-200" },
  CALCULATED: { label: "Calculated", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  ESTIMATED: { label: "Estimated", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const ChangePill = ({ label, change }) => {
  if (change === null || change === undefined) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-gray-500 bg-gray-100 border border-gray-200 whitespace-nowrap">
        <Minus size={16} /> {label}: no comparison
      </div>
    );
  }
  const up = change >= 0;
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap border ${up ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
        }`}
    >
      {up ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
      {label} {up ? "+" : "−"}
      {Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
    </div>
  );
};

// "vs last month" strip. While a month is running it's compared with the same
// days of last month (1st to today's date), not the whole of last month.
const MonthComparison = ({ r }) => {
  const prev = r.previous;
  const prevName = shortMonth(prev.year, prev.month);
  let note;
  if (prev.revenue === null || prev.revenue === undefined) {
    note = "No earlier sales to compare against yet.";
  } else {
    const span = prev.partial ? `${prevName} 1–${prev.through_day}` : prevName;
    note = `${span}: revenue ${formatLKR(prev.revenue)} · profit ${formatLKR(prev.profit)}${prev.partial ? " (same days, month still in progress)" : ""}`;
  }
  return (
    <div className="print-performance mb-10 print:mb-6 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center lg:justify-between gap-4 text-center lg:text-left">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">Compared with {prevName}</h3>
        <p className="text-xs sm:text-sm text-gray-500">{note}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <ChangePill label="Revenue" change={prev.revenue_change} />
        <ChangePill label="Profit" change={prev.profit_change} />
      </div>
    </div>
  );
};

const WaterfallStep = ({ label, value, sub, tone }) => (
  <div className={`flex-1 min-w-[160px] rounded-2xl border p-4 ${tone}`}>
    <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
    <p className="text-xl xl:text-2xl font-black mt-1">{value}</p>
    {sub && <p className="text-xs mt-1 opacity-80">{sub}</p>}
  </div>
);

const SalarySection = ({ r, monthStr }) => {
  const gross = num(r.today_profit);
  const salaries = num(r.salary_cost);
  const after = num(r.profit_after_salaries);
  const estimated = r.salary_source === "estimate" || r.salary_source === "mixed";
  const rows = r.salary_breakdown || [];

  return (
    <div className="print-salary-section mb-10 print:mb-6 rounded-2xl border-2 border-gray-200 p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Users className="text-gray-400" /> Profit after salaries
      </h3>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
        <WaterfallStep
          label={gross >= 0 ? "Gross profit" : "Gross loss"}
          value={formatLKR(gross)}
          sub="From sales"
          tone={gross >= 0 ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"}
        />
        <span className="text-2xl font-black text-gray-400 text-center">−</span>
        <WaterfallStep
          label="Salaries"
          value={formatLKR(salaries)}
          sub={`${rows.length} employee${rows.length === 1 ? "" : "s"} · incl. employer EPF/ETF`}
          tone="bg-gray-50 border-gray-200 text-gray-800"
        />
        <span className="text-2xl font-black text-gray-400 text-center">=</span>
        <WaterfallStep
          label={after >= 0 ? "Profit after salaries" : "Loss after salaries"}
          value={formatLKR(after)}
          sub={`${num(r.profit_after_salaries_margin).toFixed(1)}% of revenue`}
          tone={after >= 0 ? "bg-emerald-600 border-emerald-700 text-white" : "bg-red-600 border-red-700 text-white"}
        />
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map((row) => {
            const badge = SALARY_BADGE[row.source] || SALARY_BADGE.ESTIMATED;
            return (
              <div key={row.employee} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{row.name}</p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-bold text-gray-900">{formatLKR(row.cost)}</p>
                  {num(row.employer_contributions) > 0 && (
                    <p className="text-[10px] text-gray-500">incl. {formatLKR(row.employer_contributions)} EPF/ETF</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">No employees on the payroll this month.</p>
      )}

      {estimated && (
        <p className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Salaries marked Estimated are worked out from attendance{r.is_current_month ? " and assume the rest of the month is worked" : ""}.{" "}
            <Link to={`/employees?tab=payroll&month=${monthStr}`} className="font-bold underline print:no-underline">
              Calculate salaries in Payroll
            </Link>{" "}
            for final figures.
          </span>
        </p>
      )}
    </div>
  );
};

const CHEQUE_BADGE = {
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  CLEARED: "bg-green-50 text-green-700 border-green-200",
};

// Supplier cheques dated this month are paid from revenue: first out of the
// money the parts sold this month cost (meant to be reinvested in stock), and
// only what goes beyond that comes out of profit.
const ChequeSection = ({ r }) => {
  const total = num(r.cheque_cost);
  const partsCost = num(r.total_investment);
  const fromParts = num(r.cheques_from_parts_cost);
  const fromProfit = num(r.cheques_from_profit);
  const remaining = num(r.parts_cost_remaining);
  const afterSalaries = num(r.profit_after_salaries);
  const after = num(r.profit_after_cheques);
  const rows = r.cheque_breakdown || [];
  const partsShare = total > 0 ? (fromParts / total) * 100 : 0;

  return (
    <div className="print-salary-section mb-10 print:mb-6 rounded-2xl border-2 border-gray-200 p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 flex items-center gap-2">
        <Landmark className="text-gray-400" /> Supplier cheques this month
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Cheques dated this month are paid from revenue, first from the {formatLKR(partsCost)} cost of parts sold, then from profit.
      </p>

      {total > 0 ? (
        <>
          {/* Where the cheque money comes from */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-gray-700">
                {r.cheque_count} cheque{r.cheque_count === 1 ? "" : "s"} due
              </span>
              <span className="text-xl font-black text-gray-900">{formatLKR(total)}</span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-red-200 overflow-hidden flex print:hidden">
              <div className="h-full bg-amber-400" style={{ width: `${partsShare}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-amber-200 px-3 py-2">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> From cost of parts sold
                </span>
                <span className="font-bold text-gray-900">{formatLKR(fromParts)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-red-200 px-3 py-2">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-300" /> Reinvested from profit
                </span>
                <span className={`font-bold ${fromProfit > 0 ? "text-red-700" : "text-gray-400"}`}>{formatLKR(fromProfit)}</span>
              </div>
            </div>
            {remaining > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                {formatLKR(remaining)} of this month's parts cost is not yet used for cheques.
              </p>
            )}
          </div>

          {/* Profit waterfall */}
          <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
            <WaterfallStep
              label={afterSalaries >= 0 ? "Profit after salaries" : "Loss after salaries"}
              value={formatLKR(afterSalaries)}
              tone={afterSalaries >= 0 ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"}
            />
            <span className="text-2xl font-black text-gray-400 text-center">−</span>
            <WaterfallStep
              label="Cheques from profit"
              value={formatLKR(fromProfit)}
              sub={fromProfit > 0 ? "Beyond the cost of parts sold" : "Covered by cost of parts sold"}
              tone="bg-gray-50 border-gray-200 text-gray-800"
            />
            <span className="text-2xl font-black text-gray-400 text-center">=</span>
            <WaterfallStep
              label={after >= 0 ? "Profit after cheques" : "Loss after cheques"}
              value={formatLKR(after)}
              sub={`${num(r.profit_after_cheques_margin).toFixed(1)}% of revenue`}
              tone={after >= 0 ? "bg-emerald-600 border-emerald-700 text-white" : "bg-red-600 border-red-700 text-white"}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{c.supplier_name}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    #{c.cheque_number} · {c.cheque_date}
                    {c.invoice_numbers.length > 0 && ` · ${c.invoice_numbers.join(", ")}`}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-bold text-gray-900">{formatLKR(c.amount)}</p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${CHEQUE_BADGE[c.status] || ""}`}>
                    {c.status.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">No supplier cheques are dated this month.</p>
      )}

      <p className="mt-4 text-xs text-gray-500 print:hidden">
        <Link to="/supplier-payments?tab=cheques" className="font-bold text-red-700 underline">
          Manage supplier invoices & cheques
        </Link>
      </p>
    </div>
  );
};

const MonthlyContent = ({ r, monthStr, today, onRefresh, onOpenDay }) => {
  const profit = num(r.today_profit);
  const chartData = (r.daily || []).map((d) => ({
    day: Number(d.date.slice(8)),
    date: d.date,
    revenue: num(d.revenue),
    profit: num(d.profit),
    sales: d.sales,
  }));
  const hasChart = chartData.some((d) => d.revenue > 0);
  const labour = num(r.labor_revenue);

  return (
    <div className="print-report-container bg-white rounded-3xl md:shadow-lg border border-gray-100 print:border-none print:shadow-none p-6 md:p-10 w-full">
      {/* Report header */}
      <div className="mb-10 print:mb-6 text-center border-b-[3px] border-red-600 pb-6 print:pb-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 uppercase tracking-wider">NSS Auto Spares</h1>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-600">Monthly Operating Report</h2>
        <p className="text-gray-500 mt-2 font-medium">{monthLabel(monthStr)}</p>
        {r.is_current_month && (
          <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse print:hidden" />
            Month in progress — figures so far
            <button onClick={onRefresh} className="ml-1 text-amber-600 hover:text-amber-900 print:hidden" title="Refresh">
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
              {r.days_with_sales > 0
                ? `${r.days_with_sales} trading day${r.days_with_sales === 1 ? "" : "s"} · avg ${formatLKR(r.average_per_trading_day)}/day`
                : "No completed sales"}
              {r.cancelled_count > 0 && <span className="block text-red-600">{r.cancelled_count} cancelled</span>}
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
              {num(r.labor_cost) > 0 && (
                <span className="block">Repair costs −{formatLKR(r.labor_cost)}</span>
              )}
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
          sub={num(r.balance_due) > 0 ? `${formatLKR(r.balance_due)} still owed` : r.today_sales_count > 0 ? "Fully paid" : "—"}
        />
      </div>

      <MonthComparison r={r} />

      <SalarySection r={r} monthStr={monthStr} />

      <ChequeSection r={r} />

      {/* Daily chart (hidden in print) */}
      <div className="print-chart-section mb-10">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 flex items-center justify-between gap-3">
          Daily Revenue & Profit
          {r.best_day && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Trophy size={13} /> Best day: {fromISO(r.best_day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
              {formatLKR(r.best_day.revenue)}
            </span>
          )}
        </h3>
        <div className="h-64 sm:h-80 w-full bg-gray-50/50 p-2 sm:p-4 rounded-xl border border-gray-100 text-xs sm:text-sm">
          {hasChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} onClick={(e) => e?.activePayload?.[0] && onOpenDay(e.activePayload[0].payload.date)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} dy={10} interval={0} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={compactRs} tick={{ fill: "#6B7280", fontSize: 12 }} width={48} />
                <Tooltip
                  formatter={(value, name) => [formatLKR(value), name]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    if (!row) return label;
                    const when = fromISO(row.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return `${when} · ${row.sales} sale${row.sales === 1 ? "" : "s"}`;
                  }}
                  cursor={{ fill: "#f3f4f6" }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="revenue" name="Revenue" fill="#ef4444" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FileText size={48} opacity={0.2} className="mb-4" />
              <p>{r.is_current_month ? "No sales yet this month." : "No sales in this month."}</p>
            </div>
          )}
        </div>
      </div>

      {/* Day by day */}
      <div className="print-table-section print-month-table mb-10 print:mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-1 border-b border-gray-100 pb-2 flex items-center gap-2">
          <CalendarDays className="text-gray-400" /> Day by Day
        </h3>
        <p className="text-xs text-gray-400 mb-3 print:hidden">Click a day to open its daily report.</p>
        <div className="border border-gray-200 rounded-xl print:border-0 print:rounded-none overflow-x-auto">
          <table className="w-full text-left bg-white text-xs md:text-sm min-w-[600px]">
            <thead className="bg-gray-100 text-gray-700 uppercase font-extrabold tracking-wider border-b border-gray-200 text-[10px] md:text-xs">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3 text-center">Sales</th>
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right text-green-700">Profit</th>
                <th className="p-3 text-right">Collected</th>
                <th className="p-3 text-right">Owed</th>
              </tr>
            </thead>
            <tbody>
              {(r.daily || []).map((d) => {
                const future = d.date > today;
                const quiet = d.sales === 0;
                const isBest = r.best_day && r.best_day.date === d.date;
                return (
                  <tr
                    key={d.date}
                    onClick={future ? undefined : () => onOpenDay(d.date)}
                    className={`border-t border-gray-100 ${future ? "text-gray-300" : "cursor-pointer hover:bg-red-50/60"} ${quiet && !future ? "text-gray-400 print-quiet-row" : ""
                      } ${future ? "print:hidden" : ""}`}
                  >
                    <td className="p-2.5 px-3 whitespace-nowrap">
                      <span className={quiet ? "" : "font-semibold text-gray-800"}>
                        {fromISO(d.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      {isBest && <Trophy size={12} className="inline ml-1.5 -mt-0.5 text-amber-500" />}
                      {d.date === today && <span className="ml-1.5 text-[10px] font-bold text-amber-600 uppercase">Today</span>}
                    </td>
                    <td className="p-2.5 px-3 text-center font-bold">{quiet ? "—" : d.sales}</td>
                    <td className="p-2.5 px-3 text-right whitespace-nowrap">{quiet ? "—" : formatLKR(d.revenue)}</td>
                    <td
                      className={`p-2.5 px-3 text-right whitespace-nowrap font-semibold ${quiet ? "" : num(d.profit) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                    >
                      {quiet ? "—" : formatLKR(d.profit)}
                    </td>
                    <td className="p-2.5 px-3 text-right whitespace-nowrap">{quiet ? "—" : formatLKR(d.collected)}</td>
                    <td className={`p-2.5 px-3 text-right whitespace-nowrap ${num(d.balance_due) > 0 ? "text-red-600 font-semibold" : ""}`}>
                      {num(d.balance_due) > 0 ? formatLKR(d.balance_due) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300">
              <tr>
                <td className="p-3 uppercase tracking-wider text-[10px] md:text-xs text-gray-700">Month total</td>
                <td className="p-3 text-center">{r.today_sales_count}</td>
                <td className="p-3 text-right whitespace-nowrap">{formatLKR(r.today_revenue)}</td>
                <td className={`p-3 text-right whitespace-nowrap ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>{formatLKR(profit)}</td>
                <td className="p-3 text-right whitespace-nowrap">{formatLKR(r.collected)}</td>
                <td className={`p-3 text-right whitespace-nowrap ${num(r.balance_due) > 0 ? "text-red-600" : ""}`}>
                  {num(r.balance_due) > 0 ? formatLKR(r.balance_due) : "—"}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px] md:text-xs text-gray-700">
                  Salaries (incl. employer EPF/ETF)
                </td>
                <td className="p-3 text-right whitespace-nowrap text-gray-800">−{formatLKR(r.salary_cost)}</td>
                <td colSpan={2} />
              </tr>
              <tr>
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px] md:text-xs text-gray-700">
                  Profit after salaries
                </td>
                <td
                  className={`p-3 text-right whitespace-nowrap text-lg font-black ${num(r.profit_after_salaries) >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                >
                  {formatLKR(r.profit_after_salaries)}
                </td>
                <td colSpan={2} />
              </tr>
              {num(r.cheque_cost) > 0 && (
                <>
                  <tr>
                    <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px] md:text-xs text-gray-700">
                      Supplier cheques {formatLKR(r.cheque_cost)} · {formatLKR(r.cheques_from_parts_cost)} from parts cost
                    </td>
                    <td className="p-3 text-right whitespace-nowrap text-gray-800">−{formatLKR(r.cheques_from_profit)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px] md:text-xs text-gray-700">
                      Profit after cheques
                    </td>
                    <td
                      className={`p-3 text-right whitespace-nowrap text-lg font-black ${num(r.profit_after_cheques) >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {formatLKR(r.profit_after_cheques)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top parts */}
      <div className="print-table-section print-month-table">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
          <Package className="text-gray-400" /> Top Selling Parts
        </h3>
        {r.top_parts && r.top_parts.length > 0 ? (
          <div className="border border-gray-200 rounded-xl print:border-0 print:rounded-none overflow-x-auto">
            <table className="w-full text-left bg-white text-xs md:text-sm min-w-[520px]">
              <thead className="bg-gray-100 text-gray-700 uppercase font-extrabold tracking-wider border-b border-gray-200 text-[10px] md:text-xs">
                <tr>
                  <th className="p-3 w-8">#</th>
                  <th className="p-3">Part</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-right text-green-700">Profit</th>
                </tr>
              </thead>
              <tbody>
                {r.top_parts.map((p, i) => (
                  <tr key={p.part_id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                    <td className="p-3">
                      <span className="font-semibold text-gray-900 block">{p.part_name}</span>
                      <span className="text-[10px] md:text-xs text-gray-500 font-mono">{p.part_number}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-gray-800">{p.quantity}</td>
                    <td className="p-3 text-right whitespace-nowrap font-medium">{formatLKR(p.revenue)}</td>
                    <td className={`p-3 text-right whitespace-nowrap font-bold ${num(p.profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatLKR(p.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {labour > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td />
                    <td className="p-3 font-semibold text-gray-800 flex items-center gap-1.5">
                      <Wrench size={13} className="text-blue-500" /> Repair / Labour (all jobs)
                    </td>
                    <td className="p-3 text-center text-gray-400">—</td>
                    <td className="p-3 text-right whitespace-nowrap font-bold">{formatLKR(labour)}</td>
                    <td className="p-3 text-right whitespace-nowrap font-bold text-green-600">{formatLKR(labour)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          <div className="text-center p-12 border border-dashed border-gray-300 rounded-xl text-gray-500 bg-gray-50">
            <p className="font-medium">No parts sold {r.is_current_month ? "yet this month" : "in this month"}.</p>
          </div>
        )}

        <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
          Profit uses each part's cost at the time it was sold; labour has no cost and counts fully as profit. Cancelled sales are
          excluded. Salaries are each employee's gross pay plus the shop's 12% EPF and 3% ETF, from Payroll where it has been
          calculated and estimated from attendance otherwise; salary advances aren't an extra cost and aren't counted.
        </p>
      </div>
    </div>
  );
};

// --- Page ---

const isISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const isISOMonth = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v || "");

const DailyReportPage = () => {
  const today = toLocalISO(new Date());
  const thisMonth = today.slice(0, 7);

  // View, date and month live in the URL (?view=monthly&month=2026-11), so a
  // refresh or the back button keeps your place.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "monthly" ? "monthly" : "daily";
  const dateParam = searchParams.get("date");
  const monthParam = searchParams.get("month");
  const selectedDate = isISODate(dateParam) && dateParam <= today ? dateParam : today;
  const selectedMonth = isISOMonth(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;

  const setParams = (next, { replace = false } = {}) => {
    const params = {};
    if (next.view === "monthly") {
      params.view = "monthly";
      if (next.month && next.month !== thisMonth) params.month = next.month;
    } else if (next.date && next.date !== today) {
      params.date = next.date;
    }
    setSearchParams(params, { replace });
  };
  const setSelectedDate = (date) => setParams({ view: "daily", date }, { replace: true });
  const setSelectedMonth = (month) => setParams({ view: "monthly", month }, { replace: true });
  const switchView = (next) => {
    if (next === view) return;
    if (next === "monthly") setParams({ view: "monthly", month: selectedDate.slice(0, 7) });
    else setParams({ view: "daily", date: selectedMonth === thisMonth ? today : `${selectedMonth}-01` });
  };
  const openDay = (date) => setParams({ view: "daily", date });

  const reportKey = view === "monthly" ? `m:${selectedMonth}` : `d:${selectedDate}`;
  const [report, setReport] = useState({ key: null, data: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [quietReload, setQuietReload] = useState(false);

  useEffect(() => {
    // Ignore a response for a day/month the user has already moved away from.
    let active = true;
    if (!quietReload) setLoading(true);
    setError(null);
    const request =
      view === "monthly"
        ? fetchMonthlyReport(Number(selectedMonth.slice(5)), Number(selectedMonth.slice(0, 4)))
        : fetchDailyReport(selectedDate);
    request
      .then((data) => active && setReport({ key: reportKey, data }))
      .catch((err) => {
        console.error("Failed to load report:", err);
        if (active) setError(view === "monthly" ? "Could not load the report for this month." : "Could not load the report for this day.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setQuietReload(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, reloadTick]);

  const reload = useCallback(({ quiet = false } = {}) => {
    setQuietReload(quiet);
    setReloadTick((t) => t + 1);
  }, []);

  const r = report.key === reportKey ? report.data : null;
  const isToday = selectedDate === today;
  const isThisMonth = selectedMonth === thisMonth;
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
  const handleMonthInput = (value) => {
    if (!isISOMonth(value)) return;
    setSelectedMonth(value > thisMonth ? thisMonth : value);
  };

  const navBtn =
    "px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen print:min-h-0 bg-gray-50 print:bg-white pb-12 print:pb-0">
      <div className="max-w-6xl print:max-w-none print:w-full mx-auto p-4 md:p-8 print:p-0">
        {/* --- Header & Actions (hidden in print) --- */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 print:hidden gap-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
                {view === "monthly" ? "Monthly Sales Report" : "Daily Sales Report"}
              </h1>
              <p className="text-sm md:text-base text-gray-500">
                {view === "monthly" ? "Month summary, salaries & profit" : "End-of-day summary & analytics"}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex bg-white rounded-xl border border-gray-200 shadow-sm p-1">
              {[
                { id: "daily", label: "Daily", icon: Calendar },
                { id: "monthly", label: "Monthly", icon: CalendarDays },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchView(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${view === t.id ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
            </div>

            {view === "daily" ? (
              <>
                <div className="flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className={`${navBtn} border-r border-gray-200`} title="Previous day">
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
                    className={`${navBtn} border-l border-gray-200`}
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
              </>
            ) : (
              <>
                <div className="flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className={`${navBtn} border-r border-gray-200`} title="Previous month">
                    <ChevronLeft size={20} />
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    max={thisMonth}
                    onChange={(e) => handleMonthInput(e.target.value)}
                    className="flex-1 px-3 py-3 outline-none text-gray-700 font-medium bg-transparent"
                  />
                  <button
                    onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                    disabled={isThisMonth}
                    className={`${navBtn} border-l border-gray-200`}
                    title="Next month"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                {!isThisMonth && (
                  <button
                    onClick={() => setSelectedMonth(thisMonth)}
                    className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 shadow-sm whitespace-nowrap"
                  >
                    This month
                  </button>
                )}
              </>
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

        {loading || (!r && !error) ? (
          <ReportSkeleton />
        ) : error || !r ? (
          <div className="bg-white p-10 rounded-3xl border border-red-200 shadow-sm text-center">
            <p className="text-red-600 font-medium mb-4">{error || "No report data."}</p>
            <button
              onClick={() => reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
            >
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        ) : view === "monthly" ? (
          <MonthlyContent r={r} monthStr={selectedMonth} today={today} onRefresh={() => reload({ quiet: true })} onOpenDay={openDay} />
        ) : (
          <DailyContent r={r} displayDateStr={displayDateStr} onRefresh={() => reload({ quiet: true })} />
        )}
      </div>
    </div>
  );
};

export default DailyReportPage;
