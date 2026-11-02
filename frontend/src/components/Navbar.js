import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Truck,
  Users,
  Car,
  Home,
  Menu,
  X,
  FileText,
  ClipboardList,
  Power,
  PackagePlus,
  ClipboardCheck,
  FileBarChart,
  BarChart3,
  UserCog,
  Wrench,
  Layers,
  Settings,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import logoImg from "../assets/logo.png";
import { logoutUser } from "../services/api";

// Everyday pages get their own tab.
const NAV_ITEMS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/pos", label: "POS", icon: ShoppingCart },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/suppliers", label: "Suppliers", icon: Truck },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/vehicles", label: "Vehicles", icon: Car },
  { path: "/sales-history", label: "Sales", icon: FileText },
];

// Every other page lives in the "More" dropdown.
const MORE_ITEMS = [
  { path: "/estimates", label: "Estimates", icon: ClipboardList, desc: "Insurance repair estimates & quotes" },
  { path: "/purchase-orders", label: "Purchase Orders", icon: PackagePlus, desc: "Order parts from suppliers & receive stock" },
  { path: "/inspections", label: "Inspections", icon: ClipboardCheck, desc: "Vehicle condition checks & reports" },
  { path: "/daily-report", label: "Daily Report", icon: FileBarChart, desc: "End-of-day sales, profit & PDF" },
  { path: "/insights", label: "Business Insights", icon: BarChart3, desc: "Revenue trends, best sellers, suppliers" },
  { path: "/employees", label: "Employees & Payroll", icon: UserCog, desc: "Staff, attendance & salaries" },
  { path: "/repairs", label: "Repair Services", icon: Wrench, desc: "Standard repairs & their prices" },
  { path: "/vehicle-models", label: "Vehicle Models", icon: Layers, desc: "Make, model & year catalog" },
  { path: "/options", label: "Options", icon: Settings, desc: "Billing method & preferences" },
];

// A tab stays lit on its section's sub-routes too — /estimates/new and
// /estimates/:id belong to the Estimates tab. No nav path is a path-segment
// prefix of another, so this can't light two tabs at once.
const isActivePath = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

// Terminal-style chrome: dark bar, live clock and compact icon-over-label
// tabs. Kept at h-16 — POSPage sizes its panels with calc(100vh-64px).
const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const [now, setNow] = useState(new Date());

  const moreActive = MORE_ITEMS.some((item) => isActivePath(location.pathname, item.path));

  // Close menus whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  // Close the "More" panel on an outside click or Escape.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  // The clock only shows minutes, so tick every 30s rather than every second.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <nav className="bg-slate-950 border-b border-white/10 sticky top-0 z-50 print:hidden">
      <div className="px-3 sm:px-5">
        {/* The side groups share the leftover space equally (flex-1) so the tab
            group lands on the true centre of the bar — justify-between alone
            would push it right, the brand block being far wider than the
            single power button opposite it. */}
        <div className="flex items-center h-16 gap-4">
          {/* Brand + clock */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden">
                <img src={logoImg} alt="NSS" className="w-7 h-auto" />
              </span>
              <span className="text-white font-bold tracking-wide hidden sm:block group-hover:text-red-400 transition-colors">
                NSS Auto Spares
              </span>
            </Link>

            <span className="hidden xl:block h-6 w-px bg-white/10" />
            <span className="hidden xl:block text-[11px] text-slate-400 whitespace-nowrap">
              {dateLabel} <span className="text-slate-600">•</span> {timeLabel}
            </span>
          </div>

          {/* Tabs */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(location.pathname, item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[62px] transition-colors ${active
                      ? "bg-red-500/15 text-red-400"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                >
                  <item.icon size={17} />
                  <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
                </Link>
              );
            })}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[62px] transition-colors ${moreActive || moreOpen
                    ? "bg-red-500/15 text-red-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <LayoutGrid size={17} />
                <span className="text-[10px] font-semibold tracking-wide flex items-center gap-0.5">
                  More
                  <ChevronDown size={10} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </span>
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-full mt-2 w-[520px] bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 grid grid-cols-2 gap-1">
                  {MORE_ITEMS.map((item) => {
                    const active = isActivePath(location.pathname, item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${active ? "bg-red-500/15" : "hover:bg-white/5"
                          }`}
                      >
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-red-500/20 text-red-400" : "bg-white/5 text-slate-300"
                            }`}
                        >
                          <item.icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold ${active ? "text-red-400" : "text-white"}`}>
                            {item.label}
                          </span>
                          <span className="block text-[11px] text-slate-400 leading-snug">{item.desc}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={logoutUser}
              title="Logout"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:text-white hover:bg-red-600 transition-colors"
            >
              <Power size={18} />
            </button>

            <button
              onClick={() => setIsOpen((v) => !v)}
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[36rem] border-t border-white/10" : "max-h-0"
          }`}
      >
        <div className="grid grid-cols-4 gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg ${active ? "bg-red-500/15 text-red-400" : "text-slate-400 hover:bg-white/5"
                  }`}
              >
                <item.icon size={18} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <p className="px-4 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">More</p>
        <div className="grid grid-cols-4 gap-1 p-3 pt-2">
          {MORE_ITEMS.map((item) => {
            const active = isActivePath(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-center ${active ? "bg-red-500/15 text-red-400" : "text-slate-400 hover:bg-white/5"
                  }`}
              >
                <item.icon size={18} />
                <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
