import React, { useState, useEffect } from "react";
import { fetchSuppliers, createPart, fetchVehicles } from "../../services/api"; // <--- Import fetchVehicles
import { X, Plus, Car } from "lucide-react";

const AddPartForm = ({ onPartAdded }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]); // <--- All available vehicles

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    part_number: "",
    brand: "",
    supplier: "",
    buy_price: "",
    sell_price: "",
    stock_qty: "",
    min_stock_level: 5,
    rack_location: "",
    description: "",
    image_url: "",
    compatible_vehicles: [], // <--- Stores the IDs of selected vehicles
  });

  // Temporary state for the dropdown selection
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const suppData = await fetchSuppliers();
      const vehData = await fetchVehicles();
      setSuppliers(suppData);
      setVehicles(vehData);
    };
    loadData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- NEW: Handle Adding Vehicle to the List ---
  const addVehicleToPart = () => {
    if (!selectedVehicleId) return;

    // Prevent duplicates
    if (formData.compatible_vehicles.includes(selectedVehicleId)) {
      alert("This vehicle is already added!");
      return;
    }

    setFormData({
      ...formData,
      compatible_vehicles: [
        ...formData.compatible_vehicles,
        parseInt(selectedVehicleId),
      ],
    });
    setSelectedVehicleId(""); // Reset dropdown
  };

  // --- NEW: Handle Removing Vehicle from List ---
  const removeVehicle = (idToRemove) => {
    setFormData({
      ...formData,
      compatible_vehicles: formData.compatible_vehicles.filter(
        (id) => id !== idToRemove
      ),
    });
  };

  // Helper to get name from ID
  const getVehicleName = (id) => {
    const v = vehicles.find((v) => v.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Unknown";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createPart(formData);
      alert("Part added successfully!");
      if (onPartAdded) onPartAdded();
    } catch (error) {
      alert("Failed to add part.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-red-600">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Add New Spare Part
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* --- BASIC DETAILS --- */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-500 border-b pb-1">
            Basic Details
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Part Name *
            </label>
            <input
              name="name"
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
              placeholder="e.g. Brake Pad"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Part Number (OEM) *
            </label>
            <input
              name="part_number"
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Brand
              </label>
              <input
                name="brand"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="Toyota Genuine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Supplier *
              </label>
              <select
                name="supplier"
                onChange={handleChange}
                required
                className="w-full p-2 border rounded bg-white"
              >
                <option value="">Select...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* --- PRICING & STOCK --- */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-500 border-b pb-1">
            Inventory Data
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Buy Price
              </label>
              <input
                type="number"
                name="buy_price"
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sell Price
              </label>
              <input
                type="number"
                name="sell_price"
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Initial Stock
              </label>
              <input
                type="number"
                name="stock_qty"
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                name="rack_location"
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
                placeholder="Aisle 1"
              />
            </div>
          </div>
        </div>

        {/* --- COMPATIBILITY SECTION (NEW) --- */}
        <div className="md:col-span-2 bg-gray-50 p-4 rounded border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Car size={20} /> Compatible Vehicles
          </h3>

          {/* Selection Area */}
          <div className="flex gap-2 mb-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="flex-1 p-2 border rounded bg-white"
            >
              <option value="">-- Choose a Vehicle Model --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addVehicleToPart}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={18} /> Add
            </button>
          </div>

          {/* Selected List */}
          <div className="flex flex-wrap gap-2">
            {formData.compatible_vehicles.length === 0 && (
              <span className="text-gray-400 text-sm italic">
                No vehicles linked yet.
              </span>
            )}

            {formData.compatible_vehicles.map((id) => (
              <span
                key={id}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm"
              >
                {getVehicleName(id)}
                <button
                  type="button"
                  onClick={() => removeVehicle(id)}
                  className="text-blue-500 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* --- SUBMIT --- */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL
          </label>
          <input
            name="image_url"
            onChange={handleChange}
            className="w-full p-2 border rounded mb-4"
          />

          <button
            type="submit"
            className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition shadow-lg"
          >
            Save Part to Inventory
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
