import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Truck,
  Car,
  Home,
  Menu,
  X,
  FileText,
  LogOut,
} from "lucide-react";
import logoImg from "../assets/logo.png";
import { logoutUser } from "../services/api";

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false); // State for mobile menu

  const toggleMenu = () => setIsOpen(!isOpen);

  // Helper for active link styles
  const isActive = (path) =>
    location.pathname === path
      ? "bg-white/10 text-white font-bold shadow-sm backdrop-blur-sm border border-white/10"
      : "text-red-100 hover:bg-white/5 hover:text-white transition-all duration-200 border border-transparent";

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/pos", label: "POS", icon: ShoppingCart },
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/suppliers", label: "Suppliers", icon: Truck },
    { path: "/vehicles", label: "Vehicles", icon: Car },
    { path: "/sales-history", label: "Sales History", icon: FileText },
  ];


  return (
    <nav className="bg-gradient-to-r from-red-900 via-red-800 to-red-900 shadow-xl sticky top-0 z-50 transition-all duration-300 print:hidden">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <Link
            to="/"
            className="text-white text-xl font-bold flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:blur-lg transition-all"></div>
              <img
                src={logoImg}
                alt="NSS Logo"
                className="w-10 h-10 object-contain bg-white rounded-full p-1 relative z-10 shadow-lg"
              />
            </div>
            <div className="flex flex-col leading-none">
                <span className="tracking-wide text-lg">NSS Auto Spares</span>
                <span className="text-[10px] text-red-200 tracking-wider font-light uppercase">Management System</span>
            </div>
          </Link>

          {/* --- DESKTOP MENU --- */}
          <div className="hidden lg:flex space-x-1 items-center">
            {navItems.map((item) => (
               <Link
               key={item.path}
               to={item.path}
               className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive(item.path)}`}
             >
               <item.icon size={18} /> {item.label}
             </Link>
            ))}

            {/* Desktop Logout Button */}
            <div className="h-6 w-px bg-red-700 mx-2"></div>
            <button
              onClick={logoutUser}
              className="group flex items-center gap-2 text-red-100 hover:text-white hover:bg-red-950/50 px-4 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-red-700/50"
            >
              <LogOut size={18} className="group-hover:text-red-400 transition-colors"/> Logout
            </button>
          </div>

          {/* --- MOBILE HAMBURGER BUTTON --- */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-white bg-white/10 p-2 rounded-lg hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE MENU DROPDOWN --- */}
      <div 
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-red-900/95 backdrop-blur-xl border-t border-red-800 pb-4 shadow-inner px-4 pt-2">
            {navItems.map((item) => (
                 <Link
                 key={item.path}
                 to={item.path}
                 onClick={toggleMenu}
                 className={`block px-4 py-3 rounded-xl mb-1 ${
                    location.pathname === item.path 
                    ? "bg-white/15 text-white font-bold" 
                    : "text-red-100 hover:bg-white/5 hover:text-white"
                 }`}
               >
                 <div className="flex items-center gap-3">
                   <item.icon size={20} /> {item.label}
                 </div>
               </Link>
            ))}

          {/* Mobile Logout Button (Added Here) */}
          <div className="border-t border-red-800 mt-3 pt-3">
            <button
              onClick={() => {
                toggleMenu();
                logoutUser();
              }}
              className="block w-full text-left px-4 py-3 rounded-xl text-red-200 hover:bg-red-950 hover:text-white transition group"
            >
              <div className="flex items-center gap-3">
                <LogOut size={20} className="text-red-400 group-hover:text-red-300"/> Logout
              </div>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
