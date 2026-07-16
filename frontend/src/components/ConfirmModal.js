import React from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Yes, Delete It",
  tone = "danger", // "danger" (default, red — for destructive actions) | "info" (blue — for neutral confirmations)
}) => {
  if (!isOpen) return null;

  const isDanger = tone !== "info";

  return (
    // 1. Overlay (Dark background)
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity">
      {/* 2. Modal Box */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all scale-100 animate-fade-in-down">
        {/* Header (Warning/Info Strip) */}
        <div className={`p-4 rounded-t-lg border-b flex items-center gap-3 ${isDanger ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"}`}>
          <div className={`p-2 rounded-full ${isDanger ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
            {isDanger ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
          </div>
          <h3 className={`text-lg font-bold ${isDanger ? "text-red-900" : "text-blue-900"}`}>{title}</h3>
          <button
            onClick={onCancel}
            className="ml-auto text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          <p className="text-gray-600 text-base leading-relaxed">{message}</p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg font-bold transition shadow-md flex items-center gap-2 ${isDanger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
