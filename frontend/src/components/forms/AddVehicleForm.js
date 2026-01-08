import React, { useState, useEffect } from "react";
import { createVehicle, updateVehicle } from "../../services/api";
import { Car, Save, AlertCircle, X } from "lucide-react";

const AddVehicleForm = ({ onVehicleSaved, onCancel, editingVehicle }) => {
  // Initialize state. If editingVehicle exists, use its data.
  const [data, setData] = useState({
    make: "",
    model: "",
    year: "",
  });

  useEffect(() => {
    if (editingVehicle) {
      setData({
        make: editingVehicle.make,
        model: editingVehicle.model,
        year: editingVehicle.year,
      });
    }
  }, [editingVehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        // UPDATE Mode
        await updateVehicle(editingVehicle.id, data);
        alert("Vehicle Updated!");
      } else {
        // CREATE Mode
        await createVehicle(data);
        alert("Vehicle Added!");
      }
      onVehicleSaved(); // Refresh parent list
    } catch (err) {
      alert("Operation failed. Check if vehicle already exists.");
    }
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
            className="text-gray-400 hover:text-red-600"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Make
          </label>
          <input
            value={data.make}
            onChange={(e) => setData({ ...data, make: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model
          </label>
          <input
            value={data.model}
            onChange={(e) => setData({ ...data, model: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <input
            type="number"
            value={data.year}
            onChange={(e) => setData({ ...data, year: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <button className="bg-red-600 text-white py-2 px-4 rounded font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 h-10">
          <Save size={18} /> {editingVehicle ? "Update" : "Add"}
        </button>
      </div>
    </form>
  );
};

export default AddVehicleForm;
