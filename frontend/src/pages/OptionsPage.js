import React from "react";
import { Link } from "react-router-dom";
import { useSettings, BILLING_METHODS } from "../context/SettingsContext";
import {
  Settings,
  Receipt as ReceiptIcon,
  FileSpreadsheet,
  Check,
  ArrowLeft,
  Info,
} from "lucide-react";

// --- One selectable choice within a setting ---
const OptionChoice = ({ active, title, desc, icon: Icon, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`relative flex-1 text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
      active
        ? "border-red-600 bg-red-50/60 shadow-sm"
        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
    }`}
  >
    {active && (
      <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center">
        <Check size={14} strokeWidth={3} />
      </span>
    )}
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
        active ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500"
      }`}
    >
      <Icon size={22} />
    </div>
    <h4 className={`font-bold text-lg ${active ? "text-red-800" : "text-gray-800"}`}>{title}</h4>
    <p className="mt-1 text-sm text-gray-500 leading-relaxed pr-6">{desc}</p>
  </button>
);

// --- A titled group of related settings; future settings get their own ---
const SettingGroup = ({ title, desc, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
    <div className="mb-4">
      <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
    {children}
  </div>
);

const OptionsPage = () => {
  const { billingMethod, setBillingMethod } = useSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-gray-200 rounded-xl text-gray-700">
            <Settings size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Options</h1>
            <p className="text-gray-500 mt-0.5">Configure how the system behaves.</p>
          </div>
        </div>

        {/* --- Billing --- */}
        <SettingGroup
          title="Billing Method"
          desc="Choose the document generated when a sale is completed — printed, shared to WhatsApp, and reprinted from Sales History."
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <OptionChoice
              active={billingMethod === BILLING_METHODS.RECEIPT}
              onSelect={() => setBillingMethod(BILLING_METHODS.RECEIPT)}
              title="Receipt"
              icon={ReceiptIcon}
              desc="Compact 80mm thermal slip. Best for walk-in counter sales."
            />
            <OptionChoice
              active={billingMethod === BILLING_METHODS.INVOICE}
              onSelect={() => setBillingMethod(BILLING_METHODS.INVOICE)}
              title="Invoice"
              icon={FileSpreadsheet}
              desc="Full A4 invoice with bill-to details, balance due and signature lines."
            />
          </div>
        </SettingGroup>

        <div className="flex items-start gap-3 text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl p-5">
          <Info size={18} className="shrink-0 mt-0.5 text-gray-400" />
          <p>
            Changes save instantly and apply to this device. Other tabs open on this device update
            automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OptionsPage;
