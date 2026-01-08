import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, Package, Truck, Car, Home, Menu, X } from "lucide-react";
import logoImg from "../assets/logo.png";
import { FileText } from "lucide-react";

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu

  const toggleMenu = () => setIsOpen(!isOpen);

  // Helper for active link styles
  const isActive = (path) =>
    location.pathname === path
      ? "bg-red-900 text-white shadow-inner"
      : "text-red-100 hover:bg-red-700 hover:text-white";

  return (
    <nav className="bg-red-800 shadow-lg border-b-4 border-red-900">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <Link
            to="/"
            className="text-white text-xl font-bold flex items-center gap-3"
          >
            <img
              src={logoImg}
              alt="NSS Logo"
              className="w-10 h-10 object-contain bg-white rounded-full p-1"
            />
            <span className="tracking-wide">NSS Auto Spares</span>
          </Link>

          {/* Desktop Menu (Hidden on Mobile) */}
          <div className="hidden md:flex space-x-2">
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
              <ShoppingCart size={18} /> POS
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
            <Link
              to="/sales-history"
              className={`px-3 py-2 rounded flex items-center gap-2 ${isActive(
                "/sales-history"
              )}`}
            >
              <FileText size={18} /> Sales History
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-red-100 hover:text-white focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-red-800 border-t border-red-700 pb-4">
          <Link
            to="/"
            onClick={toggleMenu}
            className={`block px-4 py-3 ${isActive("/")}`}
          >
            <div className="flex items-center gap-3">
              <Home size={20} /> Home
            </div>
          </Link>
          <Link
            to="/pos"
            onClick={toggleMenu}
            className={`block px-4 py-3 ${isActive("/pos")}`}
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={20} /> POS / Billing
            </div>
          </Link>
          <Link
            to="/inventory"
            onClick={toggleMenu}
            className={`block px-4 py-3 ${isActive("/inventory")}`}
          >
            <div className="flex items-center gap-3">
              <Package size={20} /> Inventory
            </div>
          </Link>
          <Link
            to="/suppliers"
            onClick={toggleMenu}
            className={`block px-4 py-3 ${isActive("/suppliers")}`}
          >
            <div className="flex items-center gap-3">
              <Truck size={20} /> Suppliers
            </div>
          </Link>
          <Link
            to="/vehicles"
            onClick={toggleMenu}
            className={`block px-4 py-3 ${isActive("/vehicles")}`}
          >
            <div className="flex items-center gap-3">
              <Car size={20} /> Vehicles
            </div>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
