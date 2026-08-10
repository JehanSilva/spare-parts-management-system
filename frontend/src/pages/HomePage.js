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
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  BarChart3,
  AlertCircle,
  ArrowRight,
  FileText,
  TrendingDown,
  User,
  History,
  Settings,
  ClipboardList,
  Layers,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

  // --- State for Dashboard Stats ---
  const [stats, setStats] = useState({
    total_inventory_value: 0,
    total_sales: 0,
    total_profit: 0,
    supplier_stats: [],
    low_stock_count: 0,
    out_of_stock_count: 0,
    top_sold_parts: [],
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  // --- Load Data on Mount & Period Change ---
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await fetchDashboardStats(period);
        if (data) setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [period]);

  // --- Helper for LKR Formatting ---
  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount || 0);
  };

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

        {/* --- SECTION 3: Options (settings live on their own page) --- */}
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

        {/* --- SECTION 4: Financial Stats Dashboard --- */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-700">
               <BarChart3 size={24} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Financial Overview</h2>
          </div>
          <select 
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium text-gray-700 bg-white cursor-pointer shadow-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <BarChart3 className="mx-auto mb-4 opacity-20" size={48} />
            <p>Gathering latest financial data...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {/* 1. Inventory Cost Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                    Total Stock Value
                  </h3>
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                    <ShoppingBag size={20} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-gray-900">
                  {formatLKR(stats.total_inventory_value)}
                </p>
                <div className="mt-3 flex items-center text-xs text-gray-400">
                   <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span> Cost of unsold parts
                </div>
              </div>

              {/* 2. Total Sales Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                    Total Revenue
                  </h3>
                  <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                     <DollarSign size={20} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-gray-900">
                  {formatLKR(stats.total_sales)}
                </p>
                 <div className="mt-3 flex items-center text-xs text-gray-400">
                   <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></span> Total income from sales
                </div>
              </div>

              {/* 3. Net Profit / Loss Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-20 h-20 ${stats.total_profit >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-bl-full -mr-6 -mt-6`}></div>
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">
                    {stats.total_profit >= 0 ? 'Net Profit' : 'Net Loss'}
                  </h3>
                  <div className={`p-2 ${stats.total_profit >= 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'} rounded-lg`}>
                     {stats.total_profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                </div>
                <p className={`text-3xl font-extrabold ${stats.total_profit >= 0 ? 'text-green-600' : 'text-red-600'} relative z-10`}>
                  {formatLKR(stats.total_profit)}
                </p>
                <div className="mt-3 flex items-center text-xs text-gray-400 relative z-10">
                   <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span> Revenue - Purchase Cost
                </div>
              </div>
            </div>

            {/* --- Sales Trend Chart --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-10">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Revenue Trend</h3>
              <div className="h-72 w-full">
                {stats.sales_trend && stats.sales_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.sales_trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `Rs ${value}`} tick={{fill: '#6B7280', fontSize: 12}} />
                      <Tooltip formatter={(value) => formatLKR(value)} cursor={{fill: '#fef2f2'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="revenue" name="Revenue" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <BarChart3 size={32} opacity={0.2} />
                    <p>No sales data to display for this period.</p>
                  </div>
                )}
              </div>
            </div>

            {/* --- SECTION: Critical Alerts --- */}
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

            {/* --- SECTION 4: Top Selling Parts --- */}
            {stats.top_sold_parts && stats.top_sold_parts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200 mb-10">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm">
                      <TrendingUp className="text-orange-600" size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Top Selling Parts</h2>
                  </div>
                </div>
                <div className="p-6 overflow-x-auto pb-8">
                  <div className="flex gap-6 pb-2">
                    {stats.top_sold_parts.map((part, index) => (
                      <Link 
                        to="/inventory"
                        key={part.id || index} 
                        className="min-w-[240px] max-w-[280px] bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group flex-shrink-0 block"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-orange-200 shadow-sm">
                            <TrendingUp size={12} /> #{index + 1} Best Seller
                          </span>
                        </div>
                        <div className="h-40 bg-gray-50 rounded-lg mb-4 overflow-hidden flex items-center justify-center relative border border-gray-100">
                           {part.image ? (
                             <img src={part.image} alt={part.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           ) : (
                             <Package size={32} className="text-gray-300" />
                           )}
                        </div>
                        <h3 className="font-bold text-gray-800 truncate mb-1" title={part.name}>{part.name}</h3>
                        <p className="text-xs text-gray-500 font-mono mb-4">{part.part_number}</p>
                        <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                           <div>
                             <p className="text-[10px] text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">Total Sold</p>
                             <p className="text-xl font-black text-gray-800">{part.total_sold} <span className="text-xs font-medium text-gray-500">Units</span></p>
                           </div>
                           <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-red-50 group-hover:text-red-600 transition-colors shadow-sm border border-gray-100">
                             <ArrowRight size={16} />
                           </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 5: Supplier Spending --- */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
              <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                   <Truck className="text-red-700" size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-800">
                  Spending per Supplier
                </h2>
              </div>

              {/* Empty State Check */}
              {stats.supplier_stats.length === 0 ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-gray-50 rounded-full">
                     <AlertCircle size={32} opacity={0.5} />
                  </div>
                  <span>
                    No supplier data available yet. Add stock to see stats.
                  </span>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW (Card List) */}
                  <div className="block md:hidden">
                    <div className="divide-y divide-gray-100">
                      {stats.supplier_stats.map((sup, index) => (
                        <div key={index} className="p-5 flex flex-col gap-3 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3 items-center">
                               <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                                  {(sup.supplier__name || "U").charAt(0)}
                               </div>
                               <div>
                                  <p className="text-xs text-gray-500 uppercase font-bold mb-0.5">
                                    Supplier
                                  </p>
                                  <p className="font-bold text-gray-800 text-lg leading-tight">
                                    {sup.supplier__name || "Unknown"}
                                  </p>
                               </div>
                            </div>
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 whitespace-nowrap">
                              {sup.part_count} Units
                            </span>
                          </div>
                          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mt-1">
                            <p className="text-xs text-gray-500 font-medium">
                              Total Investment
                            </p>
                            <p className="text-lg font-bold text-gray-800">
                              {formatLKR(sup.total_spent)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DESKTOP VIEW (Table) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase font-bold tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="p-5 pl-8">Supplier Name</th>
                          <th className="p-5 text-center">Current Stock</th>
                          <th className="p-5 text-right pr-8">Investment Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {stats.supplier_stats.map((sup, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition duration-150 group"
                          >
                            <td className="p-5 pl-8 font-medium text-gray-800 flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-red-100 group-hover:text-red-600 transition-colors flex items-center justify-center text-xs font-bold">
                                  {(sup.supplier__name || "U").charAt(0)}
                               </div>
                               {sup.supplier__name || "Unknown"}
                            </td>
                            <td className="p-5 text-center">
                              <span className="bg-white text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200 shadow-sm">
                                {sup.part_count} units
                              </span>
                            </td>
                            <td className="p-5 text-right font-bold text-gray-700 pr-8">
                              {formatLKR(sup.total_spent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        
        
      </div>
      
       {/* Footer Integration (Only on Home Page) - Moved outside for full width */}
       <Footer />
    </div>
  );
};

export default HomePage;

