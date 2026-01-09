import React, { useEffect } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";

const AlertComponent = ({ type = "error", message, onClose }) => {
  // 1. Hooks must be called FIRST (before any return statement)
  useEffect(() => {
    // If there is no message, do nothing inside the hook
    if (!message) return;

    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    // Cleanup the timer if the component unmounts or message changes
    return () => clearTimeout(timer);
  }, [message, onClose]);

  // 2. Early return comes AFTER the hooks
  if (!message) return null;

  const isSuccess = type === "success";

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded shadow-lg border-l-4 transition-all transform animate-slide-in
            ${
              isSuccess
                ? "bg-green-50 border-green-500 text-green-800"
                : "bg-red-50 border-red-500 text-red-800"
            }
        `}
    >
      {isSuccess ? <CheckCircle size={20} /> : <AlertCircle size={20} />}

      <div className="flex-1">
        <h4 className="font-bold text-sm">{isSuccess ? "Success" : "Error"}</h4>
        <p className="text-sm whitespace-pre-line">{message}</p>
      </div>

      <button onClick={onClose} className="opacity-50 hover:opacity-100">
        <X size={18} />
      </button>
    </div>
  );
};

export default AlertComponent;
