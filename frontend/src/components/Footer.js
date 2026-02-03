import React from "react";
import logo from "../assets/logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 px-6 bg-transparent">
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
           {/* Decorative Background Element */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>

          {/* Brand Section */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-white rounded-xl backdrop-blur-sm border border-white/10">
              <img src={logo} alt="NSS Auto Spares" className="w-12 h-12 object-contain" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-lg tracking-tight">NSS Auto Spares</h3>
            </div>
          </div>

          {/* Copyright Section */}
          <div className="text-center md:text-right relative z-10 opacity-80">
            <p className="text-sm font-medium">
              &copy; {currentYear} All rights reserved.
            </p>
          </div>
          
        </div>
      </div>
    </footer>
  );
};

export default Footer;
