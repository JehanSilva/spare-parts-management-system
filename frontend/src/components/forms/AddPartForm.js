import React, { useState, useEffect, useRef } from "react";
import { fetchSuppliers, fetchVehicles } from "../../services/api";
import {
  X,
  Car,
  Save,
  Upload,
  Image as ImageIcon,
  Search,
  Check,
} from "lucide-react";

const AddPartForm = ({ onSubmit, onCancel, editingPart }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // --- CHANGED: Search State ---
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const dropdownRef = useRef(null); // To close dropdown when clicking outside

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
    image: null,
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

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowVehicleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Populate Edit Data
  useEffect(() => {
    if (editingPart) {
      setFormData({
        ...editingPart,
        supplier: editingPart.supplier || "",
        compatible_vehicles: editingPart.compatible_vehicles
          ? editingPart.compatible_vehicles.map((v) =>
              typeof v === "object" ? v.id : v,
            )
          : [],
        image: null,
      });
      setPreviewUrl(editingPart.image || null);
    }
  }, [editingPart]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // --- CHANGED: Add Vehicle Logic ---
  const addVehicleToPart = (vehicleId) => {
    if (!formData.compatible_vehicles.includes(vehicleId)) {
      setFormData({
        ...formData,
        compatible_vehicles: [...formData.compatible_vehicles, vehicleId],
      });
    }
    setVehicleSearch(""); // Clear search after adding
    setShowVehicleDropdown(false); // Close dropdown
  };

  const removeVehicle = (id) => {
    setFormData({
      ...formData,
      compatible_vehicles: formData.compatible_vehicles.filter(
        (vId) => vId !== id,
      ),
    });
  };

  const getVehicleName = (id) => {
    const v = vehicles.find((vh) => vh.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Unknown";
  };

  // --- CHANGED: Filter Vehicles based on search ---
  const filteredVehicles = vehicles.filter((v) => {
    const fullName = `${v.year} ${v.make} ${v.model}`.toLowerCase();
    return fullName.includes(vehicleSearch.toLowerCase());
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      if (key === "compatible_vehicles") {
        formData[key].forEach((id) =>
          dataToSend.append("compatible_vehicles", id),
        );
      } else if (key === "image") {
        if (formData.image instanceof File) {
          dataToSend.append("image", formData.image);
        }
      } else if (formData[key] !== null && formData[key] !== undefined) {
        dataToSend.append(key, formData[key]);
      }
    });

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
        {/* Image Upload */}
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

        {/* --- CHANGED: SEARCHABLE COMPATIBLE VEHICLES --- */}
        <div className="md:col-span-2 bg-gray-50 p-4 rounded border">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Car size={20} /> Fits Vehicles
          </h3>

          <div className="relative mb-3" ref={dropdownRef}>
            <div className="flex items-center border rounded bg-white overflow-hidden focus-within:ring-2 ring-blue-500">
              <div className="pl-3 text-gray-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => {
                  setVehicleSearch(e.target.value);
                  setShowVehicleDropdown(true);
                }}
                onFocus={() => setShowVehicleDropdown(true)}
                placeholder="Type to search (e.g. 'Toyota Axio', '2015')..."
                className="flex-1 p-2 outline-none"
              />
            </div>

            {/* Dropdown List */}
            {showVehicleDropdown && (
              <div className="absolute z-10 w-full bg-white border rounded mt-1 max-h-60 overflow-y-auto shadow-lg">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => {
                    const isSelected = formData.compatible_vehicles.includes(
                      v.id,
                    );
                    return (
                      <div
                        key={v.id}
                        onClick={() => !isSelected && addVehicleToPart(v.id)}
                        className={`p-2 cursor-pointer flex justify-between items-center border-b last:border-b-0 hover:bg-blue-50 transition ${
                          isSelected
                            ? "bg-blue-100 opacity-50 cursor-default"
                            : ""
                        }`}
                      >
                        <span>
                          {v.year} {v.make} {v.model}
                        </span>
                        {isSelected && (
                          <Check size={16} className="text-blue-600" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-gray-500 text-center">
                    No vehicles found matching "{vehicleSearch}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Tags */}
          <div className="flex flex-wrap gap-2">
            {formData.compatible_vehicles.map((id) => (
              <span
                key={id}
                className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm"
              >
                {getVehicleName(id)}
                <button
                  type="button"
                  onClick={() => removeVehicle(id)}
                  className="text-gray-400 hover:text-red-600 bg-gray-100 rounded-full p-0.5 hover:bg-gray-200"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {formData.compatible_vehicles.length === 0 && (
              <span className="text-sm text-gray-400 italic">
                No vehicles selected yet.
              </span>
            )}
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
