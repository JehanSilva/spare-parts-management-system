import React, { useEffect, useRef, useState } from "react";
import { Search, Check, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Searchable supplier picker — a <select> replacement for the three places a
 * supplier is chosen (Add Part, Quick Restock, and editing a purchase-history
 * record). The shop's supplier list is long enough that scanning a plain
 * dropdown is slow, so the panel leads with a filter box.
 *
 * `floating` renders the panel as an overlay (what the Add Part form has always
 * done). The default expands it in the document flow instead, because both
 * modals that use this sit inside clipping containers — the purchase-history
 * card is `overflow-hidden`, which would cut an overlay off at the card's edge.
 *
 * Selection is emitted as the raw supplier id, or "" for no supplier at all.
 * Comparisons are string-based so a caller holding "3" and a supplier with id 3
 * still match.
 */
const SupplierSelect = ({
  suppliers = [],
  value,
  onChange,
  placeholder = "Select a supplier...",
  noneLabel = "— Unknown / No Supplier —",
  floating = false,
  icon = null,
  triggerClassName = "w-full p-2 bg-white border border-gray-300 rounded-lg text-sm",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  const hasValue = value !== "" && value !== null && value !== undefined;
  const isSelected = (id) => hasValue && String(value) === String(id);
  const selected = suppliers.find((s) => isSelected(s.id));

  // Clicking away or pressing Escape closes the panel without changing anything.
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (id) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const filtered = suppliers.filter((s) =>
    (s.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const Row = ({ label, italic, chosen, onClick, last }) => (
    <div
      onClick={onClick}
      className={`px-3 py-2.5 cursor-pointer flex justify-between items-center gap-2 hover:bg-gray-50 transition-colors ${
        chosen ? "bg-gray-50" : ""
      } ${last ? "" : "border-b border-gray-50"}`}
    >
      <span className={`text-sm ${italic ? "text-gray-500 italic" : "text-gray-700"}`}>
        {label}
      </span>
      {chosen && <Check size={15} className="text-gray-900 shrink-0" />}
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {icon}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={`${triggerClassName} flex items-center justify-between gap-2 cursor-pointer`}
      >
        {/* A value with no match is a supplier that has since been deleted —
            say so rather than showing the placeholder, which would read as
            "nothing chosen". */}
        <span className={`truncate ${hasValue ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.name : hasValue ? "Unknown supplier" : placeholder}
        </span>
        {open ? (
          <ChevronUp size={15} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronDown size={15} className="text-gray-400 shrink-0" />
        )}
      </div>

      {open && (
        <div
          className={`bg-white border border-gray-200 rounded-xl max-h-60 flex flex-col overflow-hidden mt-1 ${
            floating ? "absolute z-20 w-full shadow-xl" : "shadow-sm"
          }`}
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search suppliers..."
                className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto">
            <Row
              label={noneLabel}
              italic
              chosen={!hasValue}
              onClick={() => choose("")}
            />
            {filtered.length > 0 ? (
              filtered.map((s, i) => (
                <Row
                  key={s.id}
                  label={s.name}
                  chosen={isSelected(s.id)}
                  onClick={() => choose(s.id)}
                  last={i === filtered.length - 1}
                />
              ))
            ) : (
              <div className="p-4 text-gray-400 text-center text-sm">No suppliers found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierSelect;
