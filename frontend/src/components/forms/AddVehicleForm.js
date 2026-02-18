import React, { useState, useEffect } from "react";
import { Car, Save, X, Loader } from "lucide-react";

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

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-600 mb-8 animate-fade-in-down"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-red-900">
          <Car className="w-6 h-6" />
          <h2 className="text-xl font-bold">
            {editingVehicle
              ? `Edit ${editingVehicle.make} ${editingVehicle.model}`
              : "Add New Vehicle"}
          </h2>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Make */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Make <span className="text-red-500">*</span>
          </label>
          <input
            value={data.make}
            onChange={(e) => setData({ ...data, make: e.target.value })}
            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            required
            placeholder="e.g. Toyota"
          />
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model <span className="text-red-500">*</span>
          </label>
          <input
            value={data.model}
            onChange={(e) => setData({ ...data, model: e.target.value })}
            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            required
            placeholder="e.g. Prius"
          />
        </div>

        {/* Year - OPTIONAL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <input
            type="number"
            value={data.year}
            onChange={(e) => setData({ ...data, year: e.target.value })}
            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            placeholder="e.g. 2018"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          className={`py-2 px-4 rounded font-bold transition flex items-center justify-center gap-2 h-10 shadow-sm ${
            isSaving
              ? "bg-red-400 text-white cursor-not-allowed"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {isSaving ? (
            <>
              <Loader size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              {editingVehicle ? "Update" : "Add"}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default AddVehicleForm;
