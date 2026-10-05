import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

// Small icon button that copies `text` to the clipboard and briefly shows a tick.
const CopyButton = ({ text, label = "text", size = 14 }) => {
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      // Clipboard blocked (insecure origin or denied) — the text is on screen anyway.
      console.error("Copy failed:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      // Keep presses on the button from reaching parent click/long-press handlers
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      title={copied ? "Copied" : `Copy ${label}`}
      className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors shrink-0"
    >
      {copied ? <Check size={size} className="text-green-600" /> : <Copy size={size} />}
    </button>
  );
};

export default CopyButton;
