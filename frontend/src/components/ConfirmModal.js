import React from "react";
import { AlertTriangle, X } from "lucide-react";

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    // 1. Overlay (Dark background)
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity">
      {/* 2. Modal Box */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all scale-100 animate-fade-in-down">
        {/* Header (Red Warning Strip) */}
        <div className="bg-red-50 p-4 rounded-t-lg border-b border-red-100 flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-full text-red-600">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-red-900">{title}</h3>
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
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition shadow-md flex items-center gap-2"
          >
            Yes, Delete It
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
