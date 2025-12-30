import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Package, Users, Car, TrendingUp } from "lucide-react";

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
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Dashboard Overview
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Placeholder for future Stats Chart */}
      <div className="mt-12 bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-blue-600" />
          <h2 className="text-xl font-bold">Monthly Snapshot</h2>
        </div>
        <p className="text-gray-500">
          Sales and profit charts will appear here.
        </p>
      </div>
    </div>
  );
};

export default HomePage;
