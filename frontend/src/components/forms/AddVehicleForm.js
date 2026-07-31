import React, { useState, useEffect } from "react";
import { Car, Save, X, Loader, Calendar, Tag } from "lucide-react";
import AvatarBadge from "../AvatarBadge";

// Small uppercase section heading, matching the muted meta line on the cards.
const SectionLabel = ({ children }) => (
  <div className="mb-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</span>
  </div>
);

const AddVehicleForm = ({ onSubmit, onCancel, editingVehicle, isSaving }) => {
  // Initialize state
  const [data, setData] = useState({
    make: "",
    model: "",
    year: "",
  });

  // Load data if we are editing an existing vehicle
  useEffect(() => {
    if (editingVehicle) {
      setData({
        make: editingVehicle.make || "",
        model: editingVehicle.model || "",
        year: editingVehicle.year || "",
      });
    }
  }, [editingVehicle]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare payload: Convert empty year string to null for the API
    const payload = {
      ...data,
      year: data.year ? data.year : null,
    };

    // Send data to Parent Page (VehiclePage.js)
    onSubmit(payload);
  };

  const inputClass =
    "w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors";

  const title = [data.make.trim(), data.model.trim()].filter(Boolean).join(" ");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      {/* Header — mirrors a model card: avatar, muted meta line, bold title */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {data.make.trim() ? (
            <AvatarBadge name={data.make} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
              <Car size={20} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">
              {editingVehicle ? "Editing model" : "New vehicle model"}
            </p>
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {title || (editingVehicle ? "Edit Vehicle" : "Add New Vehicle")}
            </h2>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <SectionLabel>Model Details</SectionLabel>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Car className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              value={data.make}
              onChange={(e) => setData({ ...data, make: e.target.value })}
              className={inputClass}
              required
              placeholder="Make * — e.g. Toyota"
            />
          </div>

          <div className="relative">
            <Tag className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              value={data.model}
              onChange={(e) => setData({ ...data, model: e.target.value })}
              className={inputClass}
              required
              placeholder="Model * — e.g. Prius"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="number"
              value={data.year}
              onChange={(e) => setData({ ...data, year: e.target.value })}
              className={inputClass}
              placeholder="Year (optional)"
            />
          </div>
        </div>

        {/* Footer — hint on the left, actions on the right */}
        <div className="border-t border-gray-100 mt-6 pt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            Used for parts compatibility. Year is optional.
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-full transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader size={13} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> {editingVehicle ? "Update model" : "Save model"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddVehicleForm;
