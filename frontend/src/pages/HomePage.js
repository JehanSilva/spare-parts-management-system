import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardStats } from "../services/api";
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
} from "lucide-react";

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

