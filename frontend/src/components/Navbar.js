import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, Package, Truck, Car, Home } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? "bg-blue-700 text-white"
      : "text-blue-100 hover:bg-blue-600";

  return (
    <nav className="bg-blue-800 p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <Link
          to="/"
          className="text-white text-xl font-bold flex items-center gap-2"
        >
          <Car className="w-8 h-8" /> AutoPart Pro
        </Link>
        <div className="flex space-x-4">
          <Link
            to="/"
            className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
              "/"
            )}`}
          >
            <Home size={18} /> Home
          </Link>
          <Link
            to="/pos"
            className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
              "/pos"
            )}`}
          >
            <ShoppingCart size={18} /> POS / Billing
          </Link>
          <Link
            to="/inventory"
            className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
              "/inventory"
            )}`}
          >
            <Package size={18} /> Inventory
          </Link>
          <Link
            to="/suppliers"
            className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
              "/suppliers"
            )}`}
          >
            <Truck size={18} /> Suppliers
          </Link>
          <Link
            to="/vehicles"
            className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
              "/vehicles"
            )}`}
          >
            <Car size={18} /> Vehicles
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
