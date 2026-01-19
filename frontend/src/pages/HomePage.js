import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDashboardStats } from "../services/api";
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
} from "lucide-react";

// --- Quick Action Card Component (Unchanged) ---
const QuickActionCard = ({ to, title, icon: Icon, color, desc }) => (
  <Link
    to={to}
    className={`${color} text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 flex flex-col items-center text-center`}
  >
    <Icon size={48} className="mb-4 opacity-90" />
    <h3 className="text-2xl font-bold">{title}</h3>
    <p className="mt-2 opacity-90 text-sm">{desc}</p>
  </Link>
);

const HomePage = () => {
  // --- State for Dashboard Stats ---
  const [stats, setStats] = useState({
    total_inventory_value: 0,
    total_sales: 0,
    total_profit: 0,
    supplier_stats: [],
  });
  const [loading, setLoading] = useState(true);

  // --- Load Data on Mount ---
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchDashboardStats();
        if (data) setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // --- Helper for LKR Formatting ---
  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount || 0);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome to NSS Auto Spares
        </h1>
        <p className="text-gray-500 mt-1">
          Select an action or view your current performance.
        </p>
      </div>

      {/* --- SECTION 1: Quick Actions (Navigation) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <QuickActionCard
          to="/pos"
          title="New Sale (POS)"
          icon={ShoppingCart}
          color="bg-green-600"
          desc="Create invoice & deduct stock"
        />
        <QuickActionCard
          to="/inventory"
          title="Manage Parts"
          icon={Package}
          color="bg-blue-600"
          desc="Add stock, prices & images"
        />
        <QuickActionCard
          to="/suppliers"
          title="Suppliers"
          icon={Users}
          color="bg-purple-600"
          desc="Add new distributors"
        />
        <QuickActionCard
          to="/vehicles"
          title="Vehicles"
          icon={Car}
          color="bg-orange-600"
          desc="Add supported car models"
        />
      </div>

      {/* --- SECTION 2: Financial Stats Dashboard --- */}
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="text-red-700" />
        <h2 className="text-2xl font-bold text-gray-800">Financial Overview</h2>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-500 bg-white rounded shadow">
          Loading Statistics...
        </div>
      ) : (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* 1. Inventory Cost Card */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-bold uppercase text-xs">
                  Total Stock Value
                </h3>
                <ShoppingBag className="text-blue-500 opacity-50" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {formatLKR(stats.total_inventory_value)}
              </p>
              <p className="text-xs text-gray-400 mt-2">Cost of unsold parts</p>
            </div>

            {/* 2. Total Sales Card */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-bold uppercase text-xs">
                  Total Revenue
                </h3>
                <DollarSign className="text-orange-500 opacity-50" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {formatLKR(stats.total_sales)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Total income from sales
              </p>
            </div>

            {/* 3. Net Profit Card */}
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-bold uppercase text-xs">
                  Net Profit
                </h3>
                <TrendingUp className="text-green-500 opacity-50" size={24} />
              </div>
              <p className="text-3xl font-bold text-green-600">
                {formatLKR(stats.total_profit)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Revenue minus Purchase Cost
              </p>
            </div>
          </div>

          {/* --- SECTION 3: Supplier Spending --- */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
              <Truck className="text-red-700" size={20} />
              <h2 className="text-lg font-bold text-gray-800">
                Spending per Supplier
              </h2>
            </div>

            {/* Empty State Check */}
            {stats.supplier_stats.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                <AlertCircle size={24} />
                <span>
                  No supplier data available yet. Add stock to see stats.
                </span>
              </div>
            ) : (
              <>
                {/* MOBILE VIEW (Card List) 
                   Visible only on small screens (< md)
                */}
                <div className="block md:hidden">
                  <div className="divide-y divide-gray-100">
                    {stats.supplier_stats.map((sup, index) => (
                      <div key={index} className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                              Supplier
                            </p>
                            <p className="font-bold text-gray-800 text-lg leading-tight">
                              {sup.supplier__name}
                            </p>
                          </div>
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 whitespace-nowrap">
                            {sup.part_count} Units
                          </span>
                        </div>
                        <div className="flex justify-between items-end border-t border-dashed border-gray-200 pt-2">
                          <p className="text-xs text-gray-500">
                            Total Investment:
                          </p>
                          <p className="text-xl font-bold text-red-700">
                            {formatLKR(sup.total_spent)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DESKTOP VIEW (Table) 
                   Visible only on medium screens and up (>= md)
                */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-semibold">
                      <tr>
                        <th className="p-4">Supplier Name</th>
                        <th className="p-4 text-center">Current Stock</th>
                        <th className="p-4 text-right">Investment Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.supplier_stats.map((sup, index) => (
                        <tr
                          key={index}
                          className="hover:bg-red-50 transition duration-150"
                        >
                          <td className="p-4 font-medium text-gray-800">
                            {sup.supplier__name}
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold border border-blue-200">
                              {sup.part_count} units
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-gray-700">
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
  );
};

export default HomePage;
