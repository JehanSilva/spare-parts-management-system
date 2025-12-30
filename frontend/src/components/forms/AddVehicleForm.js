import React, { useState } from "react";
import { createVehicle } from "../../services/api"; // Ensure correct import path
import { Car, Save, AlertCircle } from "lucide-react";

const AddVehicleForm = () => {
  const [data, setData] = useState({ make: "", model: "", year: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    try {
      await createVehicle(data);
      alert("Vehicle Added Successfully!");
      setData({ make: "", model: "", year: "" }); // Reset form
    } catch (err) {
      console.error(err);
      // Handle duplicate error specific to "unique_together" constraint
      if (err.response?.data?.non_field_errors) {
        setError("This vehicle (Make + Model + Year) already exists.");
      } else {
        setError("Failed to add vehicle. Please try again.");
      }
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen pt-10">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md max-w-md w-full border-t-4 border-red-600"
      >
        <div className="flex items-center gap-2 mb-6 text-red-900">
          <Car className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Add Vehicle Model</h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Make
            </label>
            <input
              placeholder="e.g. Toyota"
              value={data.make}
              onChange={(e) => setData({ ...data, make: e.target.value })}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              placeholder="e.g. Corolla"
              value={data.model}
              onChange={(e) => setData({ ...data, model: e.target.value })}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <input
              type="number"
              placeholder="e.g. 2024"
              value={data.year}
              onChange={(e) => setData({ ...data, year: e.target.value })}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>

          <button className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-md">
            <Save size={18} /> Save Vehicle
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddVehicleForm;
