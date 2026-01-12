import React, { useState, useEffect } from "react";
import { fetchSuppliers, fetchVehicles } from "../../services/api";
import { X, Plus, Car, Save, Upload, Image as ImageIcon } from "lucide-react";

const AddPartForm = ({ onSubmit, onCancel, editingPart }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  // Image Preview State
  const [previewUrl, setPreviewUrl] = useState(null);

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
    image: null, // <--- Now stores the actual File object
    compatible_vehicles: [],
  });

  // Load Data
  useEffect(() => {
    const loadDropdowns = async () => {
      const s = await fetchSuppliers();
      const v = await fetchVehicles();
      setSuppliers(s);
      setVehicles(v);
    };
    loadDropdowns();
  }, []);

  // Populate Edit Data
  useEffect(() => {
    if (editingPart) {
      setFormData({
        ...editingPart,
        supplier: editingPart.supplier || "",
        compatible_vehicles: editingPart.compatible_vehicles
          ? editingPart.compatible_vehicles.map((v) =>
              typeof v === "object" ? v.id : v
            )
          : [],
        image: null, // Reset file input (we don't re-upload unless user picks new one)
      });
      // Set existing image as preview
      setPreviewUrl(editingPart.image || null);
    }
  }, [editingPart]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- NEW: Handle Image Selection ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      // Create local preview URL
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const addVehicleToPart = () => {
    if (!selectedVehicleId) return;
    const vehId = parseInt(selectedVehicleId);
    if (!formData.compatible_vehicles.includes(vehId)) {
      setFormData({
        ...formData,
        compatible_vehicles: [...formData.compatible_vehicles, vehId],
      });
    }
    setSelectedVehicleId("");
  };

  const removeVehicle = (id) => {
    setFormData({
      ...formData,
      compatible_vehicles: formData.compatible_vehicles.filter(
        (vId) => vId !== id
      ),
    });
  };

  const getVehicleName = (id) => {
    const v = vehicles.find((vh) => vh.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Unknown";
  };

  // --- NEW: Submit Logic with FormData ---
  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Create FormData object
    const dataToSend = new FormData();

    // 2. Append simple fields
    Object.keys(formData).forEach((key) => {
      if (key === "compatible_vehicles") {
        // Append each ID separately for arrays
        formData[key].forEach((id) =>
          dataToSend.append("compatible_vehicles", id)
        );
      } else if (key === "image") {
        // Only append image if a new file is selected
        if (formData.image instanceof File) {
          dataToSend.append("image", formData.image);
        }
      } else if (formData[key] !== null && formData[key] !== undefined) {
        dataToSend.append(key, formData[key]);
      }
    });

    // 3. Pass FormData up
    onSubmit(dataToSend);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-red-600 animate-fade-in-down">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {editingPart ? "Edit Part" : "Add New Part"}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-red-600"
          >
            <X size={28} />
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* --- IMAGE UPLOAD SECTION (NEW) --- */}
        <div className="md:col-span-2 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-48 object-contain rounded-md shadow-sm"
              />
            ) : (
              <div className="h-32 w-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                <ImageIcon size={48} />
              </div>
            )}
            <span className="text-blue-600 font-bold flex items-center gap-2 mt-2">
              <Upload size={18} />{" "}
              {previewUrl ? "Change Image" : "Upload Part Image"}
            </span>
          </label>
        </div>

        {/* Basic Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Part Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Part Number *</label>
            <input
              name="part_number"
              value={formData.part_number}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium">Brand</label>
              <input
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Supplier</label>
              <select
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
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

        {/* Inventory Data */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Buy Price</label>
              <input
                type="number"
                name="buy_price"
                value={formData.buy_price}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Sell Price</label>
              <input
                type="number"
                name="sell_price"
                value={formData.sell_price}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Stock Qty</label>
              <input
                type="number"
                name="stock_qty"
                value={formData.stock_qty}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Location</label>
              <input
                name="rack_location"
                value={formData.rack_location}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Compatible Vehicles */}
        <div className="md:col-span-2 bg-gray-50 p-4 rounded border">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Car size={20} /> Fits Vehicles
          </h3>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="flex-1 p-2 border rounded"
            >
              <option value="">-- Select Model --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addVehicleToPart}
              className="bg-blue-600 text-white px-4 rounded"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.compatible_vehicles.map((id) => (
              <span
                key={id}
                className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
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

        {/* Submit */}
        <div className="md:col-span-2 border-t pt-4">
          <button
            type="submit"
            className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 flex justify-center items-center gap-2"
          >
            <Save size={20} /> {editingPart ? "Update Part" : "Save Part"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
