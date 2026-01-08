import React, { useState, useEffect } from "react";
import {
  fetchSuppliers,
  fetchVehicles,
  createPart,
  updatePart,
} from "../../services/api";
import { X, Plus, Car, Save, AlertCircle } from "lucide-react";

const AddPartForm = ({ onPartAdded, onCancel, editingPart }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

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
    compatible_vehicles: [],
  });

  // 1. Load Dropdown Data (Suppliers & Vehicles)
  useEffect(() => {
    const loadDropdowns = async () => {
      const suppData = await fetchSuppliers();
      const vehData = await fetchVehicles();
      setSuppliers(suppData);
      setVehicles(vehData);
    };
    loadDropdowns();
  }, []);

  // 2. Populate Form if Editing
  useEffect(() => {
    if (editingPart) {
      setFormData({
        name: editingPart.name,
        part_number: editingPart.part_number,
        brand: editingPart.brand || "",
        supplier: editingPart.supplier || "", // Uses ID
        buy_price: editingPart.buy_price,
        sell_price: editingPart.sell_price,
        stock_qty: editingPart.stock_qty,
        min_stock_level: editingPart.min_stock_level,
        rack_location: editingPart.rack_location,
        description: editingPart.description || "",
        image_url: editingPart.image_url || "",
        compatible_vehicles: editingPart.compatible_vehicles || [], // Array of IDs
      });
    }
  }, [editingPart]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- Vehicle Compatibility Logic ---
  const addVehicleToPart = () => {
    if (!selectedVehicleId) return;
    const vehId = parseInt(selectedVehicleId);

    if (formData.compatible_vehicles.includes(vehId)) {
      alert("This vehicle is already added!");
      return;
    }
    setFormData({
      ...formData,
      compatible_vehicles: [...formData.compatible_vehicles, vehId],
    });
    setSelectedVehicleId("");
  };

  const removeVehicle = (idToRemove) => {
    setFormData({
      ...formData,
      compatible_vehicles: formData.compatible_vehicles.filter(
        (id) => id !== idToRemove
      ),
    });
  };

  const getVehicleName = (id) => {
    const v = vehicles.find((v) => v.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Unknown Vehicle";
  };

  // --- Submit Logic (Create or Update) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPart) {
        // Explicit Edit Mode (Clicked "Edit" button)
        await updatePart(editingPart.id, formData);
        alert("Part Updated Successfully!");
      } else {
        // Add New / Restock Mode
        // The backend now decides if it creates new or updates stock
        const response = await createPart(formData);

        // Check if we got a specific message from the Smart Update
        if (response.message) {
          alert(response.message); // e.g. "Part exists. Stock increased..."
        } else {
          alert("New Part Added Successfully!");
        }
      }
      if (onPartAdded) onPartAdded();

      // Optional: Clear form only if it was a new add,
      // or clear it always depending on your preference.
      setFormData({ ...formData, part_number: "", name: "", stock_qty: "" }); // Clear key fields
    } catch (error) {
      console.error(error);
      alert("Operation Failed. Check console for details.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-red-600 animate-fade-in-down">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {editingPart
            ? `Edit Part: ${editingPart.name}`
            : "Add New Spare Part"}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-red-600 transition"
          >
            <X size={28} />
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* --- BASIC DETAILS --- */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-500 border-b pb-1 text-sm uppercase">
            Basic Details
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Part Name *
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded focus:ring-red-500"
              placeholder="e.g. Brake Pad"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Part Number (OEM) *
            </label>
            <input
              name="part_number"
              value={formData.part_number}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded focus:ring-red-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Brand
              </label>
              <input
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full p-2 border rounded focus:ring-red-500"
                placeholder="Toyota Genuine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Supplier *
              </label>
              <select
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded bg-white focus:ring-red-500"
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
          <h3 className="font-bold text-gray-500 border-b pb-1 text-sm uppercase">
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
                value={formData.buy_price}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sell Price
              </label>
              <input
                type="number"
                name="sell_price"
                value={formData.sell_price}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded focus:ring-red-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Stock Qty
              </label>
              <input
                type="number"
                name="stock_qty"
                value={formData.stock_qty}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                name="rack_location"
                value={formData.rack_location}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded focus:ring-red-500"
                placeholder="Aisle 1"
              />
            </div>
          </div>
        </div>

        {/* --- COMPATIBILITY SECTION --- */}
        <div className="md:col-span-2 bg-gray-50 p-4 rounded border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Car size={20} /> Compatible Vehicles
          </h3>

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

          <div className="flex flex-wrap gap-2">
            {formData.compatible_vehicles.length === 0 && (
              <span className="text-gray-400 text-sm italic">
                No vehicles linked yet.
              </span>
            )}
            {formData.compatible_vehicles.map((id) => (
              <span
                key={id}
                className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm"
              >
                {getVehicleName(id)}
                <button
                  type="button"
                  onClick={() => removeVehicle(id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* --- SUBMIT --- */}
        <div className="md:col-span-2 border-t pt-4 flex gap-4">
          <button
            type="submit"
            className="flex-1 bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition shadow-lg flex justify-center items-center gap-2"
          >
            <Save size={20} /> {editingPart ? "Update Part" : "Save Part"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
