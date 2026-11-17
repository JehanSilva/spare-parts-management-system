import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardStats, fetchSupplierCheques } from "../services/api";
import Footer from "../components/Footer";
import { useSettings } from "../context/SettingsContext";
import {
  ShoppingCart,
  Package,
  Users,
  Car,
  BarChart3,
  AlertCircle,
  ArrowRight,
  FileText,
  User,
  History,
  Settings,
  ClipboardList,
  ClipboardCheck,
  Layers,
  Wrench,
  Landmark,
  CalendarDays,
  Minimize2,
  Maximize2,
} from "lucide-react";

// --- Upcoming cheques (today + the next 7 days) ---
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lkr = (amount) =>
  `Rs ${new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(amount) || 0)}`;
const sumOf = (list) => list.reduce((n, c) => n + (parseFloat(c.amount) || 0), 0);
const dayName = (iso, opts) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", opts);

const ChequeLine = ({ c, strong }) => (
  <div className={`flex items-center justify-between gap-3 py-2 ${strong ? "" : "text-sm"}`}>
    <div className="min-w-0">
      <p className={`truncate ${strong ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>{c.supplier_name}</p>
      <p className="text-xs text-gray-500 truncate">
        #{c.cheque_number}{c.bank && ` · ${c.bank}`}
      </p>
    </div>
    <span className={`whitespace-nowrap ${strong ? "font-extrabold text-gray-900" : "font-bold text-gray-700"}`}>{lkr(c.amount)}</span>
  </div>
);

// Whether the card is shrunk to a tile is remembered per device.
const COLLAPSE_KEY = "nss_home_cheques_collapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const UpcomingCheques = () => {
  const [cheques, setCheques] = useState(null);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (value) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  };

  useEffect(() => {
    fetchSupplierCheques()
      .then(setCheques)
      .catch((error) => {
        console.error("Failed to load cheques", error);
        setCheques([]);
      });
  }, []);

  if (cheques === null) return null;

  const now = new Date();
  const today = isoDay(now);
  const days = Array.from({ length: 7 }, (_, i) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1)));
  const live = cheques.filter((c) => c.status !== "CANCELLED");
  const todays = live.filter((c) => String(c.cheque_date) === today);
  const upcoming = days
    .map((day) => ({ day, items: live.filter((c) => String(c.cheque_date) === day) }))
    .filter((d) => d.items.length);
  const weekCount = todays.length + upcoming.reduce((n, d) => n + d.items.length, 0);
  const weekTotal = sumOf(todays) + upcoming.reduce((n, d) => n + sumOf(d.items), 0);
  const laterCount = weekCount - todays.length;

  if (collapsed) {
    const hasToday = todays.length > 0;
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show this week's cheques"
        className={`group mb-10 w-full sm:w-auto flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left shadow-sm transition-colors ${
          hasToday ? "border-red-600 bg-red-50 hover:bg-red-100/70" : "border-gray-100 bg-white hover:border-gray-300"
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasToday ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500"}`}>
          <Landmark size={20} />
        </div>
        <div className="min-w-0">
          <p className={`font-bold ${hasToday ? "text-red-800" : "text-gray-800"}`}>
            {hasToday
              ? `${todays.length} cheque${todays.length === 1 ? "" : "s"} today · ${lkr(sumOf(todays))}`
              : "No cheques today"}
          </p>
          <p className="text-xs text-gray-500">
            {laterCount ? `${laterCount} more in the next 7 days` : "Nothing else this week"}
          </p>
        </div>
        <Maximize2 size={16} className="ml-auto sm:ml-4 text-gray-400 group-hover:text-gray-700 shrink-0" />
      </button>
    );
  }

  return (
    <div className="mb-10 bg-white rounded-3xl shadow-sm border border-gray-100 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
            <Landmark size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cheques this week</h2>
            <p className="text-sm text-gray-500">
              {weekCount
                ? `${weekCount} cheque${weekCount === 1 ? "" : "s"} · ${lkr(weekTotal)} over the next 7 days`
                : "Nothing due over the next 7 days"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/supplier-payments?tab=calendar"
            className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800"
          >
            <CalendarDays size={16} /> Cheque calendar <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            title="Minimize"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
        {/* Today — highlighted */}
        <div className={`h-fit rounded-2xl p-4 border-2 ${todays.length ? "border-red-600 bg-red-50/60" : "border-gray-200 bg-gray-50"}`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-xs font-extrabold uppercase tracking-wider ${todays.length ? "text-red-700" : "text-gray-500"}`}>
              Today · {dayName(today, { weekday: "short", day: "numeric", month: "short" })}
            </p>
            {todays.length > 0 && <span className="text-sm font-extrabold text-red-700">{lkr(sumOf(todays))}</span>}
          </div>
          {todays.length ? (
            <div className="mt-1 divide-y divide-red-100">
              {todays.map((c) => <ChequeLine key={c.id} c={c} strong />)}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No cheques dated today.</p>
          )}
        </div>

        {/* Coming days — dimmed */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 opacity-80 hover:opacity-100 transition-opacity">
          <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-1">Coming up</p>
          {upcoming.length ? (
            <div className="divide-y divide-gray-200/70">
              {upcoming.map(({ day, items }) => (
                <div key={day} className="flex gap-4 py-1">
                  <div className="w-14 shrink-0 pt-2 text-center">
                    <p className="text-[11px] font-bold uppercase text-gray-400">{dayName(day, { weekday: "short" })}</p>
                    <p className="text-lg font-extrabold text-gray-600 leading-tight">{dayName(day, { day: "numeric" })}</p>
                    <p className="text-[10px] text-gray-400">{dayName(day, { month: "short" })}</p>
                  </div>
                  <div className="flex-1 min-w-0 divide-y divide-gray-100">
                    {items.map((c) => <ChequeLine key={c.id} c={c} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">No cheques in the next 7 days.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Quick Action Card Component ---
const QuickActionCard = ({ to, title, icon: Icon, colorClass, gradient, desc }) => (
  <Link
    to={to}
    className={`group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100`}
  >
    {/* Background Gradient decoration */}
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110`}></div>
    
    <div className="relative z-10 flex flex-col h-full">
      <div className={`w-14 h-14 ${colorClass} bg-opacity-10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
         <Icon size={28} className={colorClass.replace("bg-", "text-")} />
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 group-hover:text-red-700 transition-colors">{title}</h3>
      <p className="mt-2 text-gray-500 text-sm leading-relaxed mb-4 flex-grow">{desc}</p>
      
      <div className="flex items-center text-sm font-semibold text-gray-400 group-hover:text-red-600 transition-colors">
        Access Module <ArrowRight size={16} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </Link>
);

const HomePage = () => {
  // Billing method (Options page): "Receipt" or "Invoice".
  const { documentLabel } = useSettings();

  // Only the stock-alert counts are shown here; revenue, best sellers and
  // supplier spending live on the Business Insights page (/insights).
  const [stats, setStats] = useState({ low_stock_count: 0, out_of_stock_count: 0 });

  useEffect(() => {
    fetchDashboardStats("all")
      .then((data) => data && setStats(data))
      .catch((error) => console.error("Failed to load stock alerts", error));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-4 md:p-8 flex-1 max-w-7xl mx-auto w-full">
        {/* Page Title & Hero */}
        <div className="mb-10 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
           {/* Decorative Background */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full -mr-20 -mt-20 opacity-50 pointer-events-none"></div>
           
           <div className="relative z-10">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                Welcome to <span className="text-red-700">NSS Auto Spares</span>
              </h1>
              <p className="text-gray-500 text-lg max-w-xl">
                Your centralized dashboard for managing inventory, tracking sales, and optimizing supply chains.
              </p>
           </div>
           
           <div className="flex gap-3 relative z-10">
              <span className="px-4 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold border border-red-200 shadow-sm">
                 v1.0.0
              </span>
              <span className="px-4 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold border border-green-200 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> System Online
              </span>
           </div>
        </div>

        <UpcomingCheques />

        {/* --- SECTION 1: Quick Actions (Navigation) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <QuickActionCard
            to="/pos"
            title="New Sale (POS)"
            icon={ShoppingCart}
            colorClass="text-green-600 bg-green-100"
            gradient="from-green-400 to-green-600"
            desc="Create invoice & deduct stock efficiently."
          />
          <QuickActionCard
            to="/inventory"
            title="Manage Parts"
            icon={Package}
            colorClass="text-blue-600 bg-blue-100"
            gradient="from-blue-400 to-blue-600"
            desc="Add stock, update prices & manage images."
          />
          <QuickActionCard
            to="/suppliers"
            title="Suppliers"
            icon={Users}
            colorClass="text-purple-600 bg-purple-100"
            gradient="from-purple-400 to-purple-600"
            desc="Manage distributor relationships."
          />
          <QuickActionCard
            to="/customers"
            title="Customers"
            icon={User}
            colorClass="text-teal-600 bg-teal-100"
            gradient="from-teal-400 to-teal-600"
            desc="Manage customer profiles & their vehicles."
          />
          <QuickActionCard
            to="/vehicles"
            title="Vehicles"
            icon={Car}
            colorClass="text-orange-600 bg-orange-100"
            gradient="from-orange-400 to-orange-600"
            desc="Registered plate numbers, their owners and service history."
          />
          <QuickActionCard
            to="/vehicle-models"
            title="Vehicle Models"
            icon={Layers}
            colorClass="text-amber-600 bg-amber-100"
            gradient="from-amber-400 to-amber-600"
            desc="Configure the make, model & year catalog parts are matched against."
          />
          <QuickActionCard
            to="/repairs"
            title="Repair Services"
            icon={Wrench}
            colorClass="text-teal-600 bg-teal-100"
            gradient="from-teal-400 to-teal-600"
            desc="Standard repairs and their prices, suggested when billing labour."
          />
          <QuickActionCard
            to="/daily-report"
            title="Daily Report"
            icon={FileText}
            colorClass="text-indigo-600 bg-indigo-100"
            gradient="from-indigo-400 to-indigo-600"
            desc="End-of-day sales, revenue & PDF export."
          />
          <QuickActionCard
            to="/sales-history"
            title="Sales History"
            icon={History}
            colorClass="text-pink-600 bg-pink-100"
            gradient="from-pink-400 to-pink-600"
            desc="Browse past invoices & transaction records."
          />
          <QuickActionCard
            to="/employees"
            title="Employees & Payroll"
            icon={Users}
            colorClass="text-red-600 bg-red-100"
            gradient="from-red-400 to-red-600"
            desc="Manage staff, mark daily attendance, and calculate monthly salaries."
          />
          <QuickActionCard
            to="/insights"
            title="Business Insights"
            icon={BarChart3}
            colorClass="text-violet-600 bg-violet-100"
            gradient="from-violet-400 to-violet-600"
            desc="Revenue & profit trends, best selling parts and spending per supplier."
          />
        </div>

        {/* --- Purchase Orders (parts ordered from suppliers) --- */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <ShoppingCart size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Purchase Orders</h2>
          </div>

          <Link
            to="/purchase-orders"
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                Purchase Orders
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Parts you&rsquo;ve added with the cart button on the Inventory page, grouped into
                one order per supplier — review quantities, print the order and send it off.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                When the delivery arrives, receive it here and the stock is updated automatically.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shadow-sm border border-gray-100 shrink-0">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>

        {/* --- SECTION 2: Vehicle Repair Estimates --- */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
              <ClipboardList size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Vehicle Repair Estimates</h2>
          </div>

          <Link
            to="/estimates"
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                Estimates
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Build an insurance claim estimate — removing &amp; refitting, repair, paint and
                replacing items — on the NSS Auto Engineers letterhead, or reopen a saved one.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Every estimate is saved against its vehicle, signed automatically and ready to
                print or send to the claims department.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shadow-sm border border-gray-100 shrink-0">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>

        {/* --- SECTION 3: Vehicle Inspections --- */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <ClipboardCheck size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Vehicle Inspections</h2>
          </div>

          <Link
            to="/inspections"
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                Inspections
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Work through a full condition check — structure, engine, brakes, transmission,
                suspension and the rest — with photographs, a diagnostic scan and fault codes.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Each sheet is rated per system, saved against its vehicle, and prints as a
                signed report for the customer.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shadow-sm border border-gray-100 shrink-0">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>

        {/* --- SECTION 4: Options (settings live on their own page) --- */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-200 rounded-lg text-gray-700">
              <Settings size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Options</h2>
          </div>

          <Link
            to="/options"
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-red-700 transition-colors">
                System Settings
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Billing method and other preferences.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Sales currently generate an{" "}
                <span className="font-bold text-gray-600">{documentLabel.toLowerCase()}</span>.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shadow-sm border border-gray-100 shrink-0">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>

        {/* --- Inventory Alerts --- */}
        {(stats.low_stock_count > 0 || stats.out_of_stock_count > 0) && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Inventory Alerts</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.out_of_stock_count > 0 && (
                <Link to="/inventory?filter=out" className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-200 hover:shadow-md transition-shadow flex items-center justify-between group">
                  <div>
                    <h3 className="text-red-800 font-bold uppercase text-xs tracking-wider mb-2">Out of Stock</h3>
                    <p className="text-3xl font-extrabold text-red-700">{stats.out_of_stock_count} Parts</p>
                    <p className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">Restock immediately <ArrowRight size={14} /></p>
                  </div>
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform shadow-sm">
                    <AlertCircle size={28} />
                  </div>
                </Link>
              )}
              {stats.low_stock_count > 0 && (
                <Link to="/inventory?filter=low" className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-200 hover:shadow-md transition-shadow flex items-center justify-between group">
                  <div>
                    <h3 className="text-orange-800 font-bold uppercase text-xs tracking-wider mb-2">Low Stock</h3>
                    <p className="text-3xl font-extrabold text-orange-700">{stats.low_stock_count} Parts</p>
                    <p className="text-sm text-orange-600 mt-1 font-medium flex items-center gap-1">Review stock soon <ArrowRight size={14} /></p>
                  </div>
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform shadow-sm">
                    <Package size={28} />
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}
        
        
      </div>
      
       {/* Footer Integration (Only on Home Page) - Moved outside for full width */}
       <Footer />
    </div>
  );
};

export default HomePage;

