import React, { useEffect } from "react";
import { CheckCircle, AlertCircle, X, Info } from "lucide-react";

const AlertComponent = ({ type = "info", message, onClose }) => {
  // 1. Auto-dismiss logic
  useEffect(() => {
    if (!message) return;

    // Auto-close after 3 seconds (standard for Toasts)
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  // 2. Toast Configuration
  const config = {
    success: {
      bg: "bg-white",
      border: "border-green-500",
      text: "text-gray-800",
      iconColor: "text-green-500",
      icon: <CheckCircle size={24} />,
    },
    error: {
      bg: "bg-white",
      border: "border-red-500",
      text: "text-gray-800",
      iconColor: "text-red-500",
      icon: <AlertCircle size={24} />,
    },
    info: {
      bg: "bg-white",
      border: "border-blue-500",
      text: "text-gray-800",
      iconColor: "text-blue-500",
      icon: <Info size={24} />,
    },
  };

  const style = config[type] || config.info;

  return (
    // Position: Fixed at bottom-right (standard toast location)
    <div
      className={`
            fixed bottom-6 right-6 z-[9999] 
            flex items-center gap-4 p-4 
            min-w-[300px] max-w-md 
            rounded-lg shadow-2xl border-l-8 
            transform transition-all duration-300 ease-out translate-y-0 opacity-100
            animate-slide-in-right
            ${style.bg} ${style.border}
        `}
    >
      {/* Icon */}
      <div className={`${style.iconColor} shrink-0`}>{style.icon}</div>

      {/* Message Content */}
      <div className="flex-1">
        <h4
          className={`font-bold text-sm uppercase tracking-wide ${style.iconColor}`}
        >
          {type === "error" ? "Error" : "Success"}
        </h4>
        <p
          className={`text-sm font-medium ${style.text} mt-0.5 whitespace-pre-line`}
        >
          {message}
        </p>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default AlertComponent;
