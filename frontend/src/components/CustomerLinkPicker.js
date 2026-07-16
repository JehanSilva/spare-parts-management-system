import React, { useState, useEffect, useRef } from "react";
import { Search, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { fetchCustomers, createCustomer } from "../services/api";

// Pure "find-or-create a Customer" picker — has no knowledge of vehicles.
// The caller decides what to do with the selected/created Customer via
// onSelect (awaited, so a caller doing async work can show a loading state
// on the picker's own buttons via disabled).
const CustomerLinkPicker = ({ onSelect, onCancel }) => {
  const [mode, setMode] = useState("search"); // "search" | "new"
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkingId, setLinkingId] = useState(null);
  const [newForm, setNewForm] = useState({ name: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (mode !== "search") return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await fetchCustomers(searchTerm.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchTerm, mode]);

  const handleSelect = async (customer) => {
    setLinkingId(customer.id);
    try {
      await onSelect(customer);
    } finally {
      setLinkingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    setCreating(true);
    try {
      const newCustomer = await createCustomer({ name: newForm.name.trim(), phone: newForm.phone.trim() });
      await onSelect(newCustomer);
    } finally {
      setCreating(false);
    }
  };

  if (mode === "new") {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
          <UserPlus size={11} /> New Customer
        </p>
        <input
          type="text"
          placeholder="Customer Name *"
          value={newForm.name}
          onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full px-2.5 py-2 text-sm bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Phone (optional)"
          value={newForm.phone}
          onChange={(e) => setNewForm((p) => ({ ...p, phone: e.target.value }))}
          className="w-full px-2.5 py-2 text-sm bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setMode("search")}
            className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !newForm.name.trim()}
            className="flex-1 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? "Saving..." : "Save & Link"}
          </button>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="w-full py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
          <UserCheck size={11} /> Link Customer
        </p>
        <button
          onClick={() => setMode("new")}
          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
        >
          <UserPlus size={11} /> New Customer
        </button>
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
        <input
          type="text"
          autoFocus
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-7 pr-2.5 py-2 text-sm bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {searchLoading ? (
          <p className="text-[11px] text-gray-400 text-center py-2 flex items-center justify-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Searching...
          </p>
        ) : searchTerm.trim() && results.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-2">
            No customers found.{" "}
            <button onClick={() => setMode("new")} className="text-blue-600 font-bold underline">
              Create new
            </button>
          </p>
        ) : (
          results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              disabled={linkingId === c.id}
              className="w-full flex items-center justify-between gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/60 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-60 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{c.name}</p>
                {c.phone && <p className="text-[10px] text-gray-500">{c.phone}</p>}
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                {linkingId === c.id ? "Linking..." : "Select"}
              </span>
            </button>
          ))
        )}
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default CustomerLinkPicker;
