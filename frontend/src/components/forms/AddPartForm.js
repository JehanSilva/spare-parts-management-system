import React, { useState, useEffect, useRef } from "react";
import { fetchSuppliers, fetchVehicles, createVehicle } from "../../services/api";
import {
  X,
  Car,
  Save,
  Upload,
  Image as ImageIcon,
  Search,
  Check,
  Loader2,
  Package,
  Plus,
} from "lucide-react";

const AddPartForm = ({ onSubmit, onCancel, editingPart }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // --- Search State ---
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const dropdownRef = useRef(null); // To close dropdown when clicking outside

  // Image Preview State
  const [previewUrl, setPreviewUrl] = useState(null);

  // Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);
  const [vehicleSaving, setVehicleSaving] = useState(false);

  // New Vehicle State
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: "",
  });

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
              typeof v === "object" ? v.id : v
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

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setFormData((prev) => ({ ...prev, image: file }));
          setPreviewUrl(URL.createObjectURL(file));
        }
        break;
      }
    }
  };

  // --- Add Vehicle Logic ---
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
        (vId) => vId !== id
      ),
    });
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.make || !newVehicle.model) return;

    setVehicleSaving(true);
    try {
      const createdVehicle = await createVehicle({
        ...newVehicle,
        year: newVehicle.year || null,
      });

      // Update local vehicles list
      setVehicles([...vehicles, createdVehicle]);

      // Automatically add to current part
      addVehicleToPart(createdVehicle.id);

      // Reset new vehicle form
      setNewVehicle({ make: "", model: "", year: "" });
      setIsCreatingVehicle(false);
    } catch (error) {
      console.error("Failed to create vehicle", error);
      alert("Failed to create vehicle. Please try again.");
    } finally {
      setVehicleSaving(false);
    }
  };

  const getVehicleName = (id) => {
    const v = vehicles.find((vh) => vh.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Unknown";
  };

  // --- Filter Vehicles based on search ---
  const filteredVehicles = vehicles.filter((v) => {
    const fullName = `${v.year} ${v.make} ${v.model}`.toLowerCase();
    return fullName.includes(vehicleSearch.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const dataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      if (key === "compatible_vehicles") {
        formData[key].forEach((id) =>
          dataToSend.append("compatible_vehicles", id)
        );
      } else if (key === "image") {
        if (formData.image instanceof File) {
          dataToSend.append("image", formData.image);
        }
      } else if (formData[key] !== null && formData[key] !== undefined) {
        dataToSend.append(key, formData[key]);
      }
    });

    try {
      await onSubmit(dataToSend);
      // NOTE: Parent component handles success alerts and closing, but we ensure state is reset if needed
    } catch (error) {
      console.error("Submission failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-down mb-8">
      {/* Header */}
      <div className="bg-red-700 p-6 flex justify-between items-center text-white">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Package className="w-7 h-7" />
          {editingPart ? "Edit Part Details" : "Add New Part"}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white hover:bg-red-600 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Image & Critical Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Image Upload */}
            <div 
              onPaste={handlePaste}
              tabIndex="0"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all cursor-pointer group bg-gray-50/50"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-3 w-full"
              >
                {previewUrl ? (
                  <div className="relative w-full aspect-square bg-white p-2 rounded-lg shadow-sm">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain rounded"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                      <p className="text-white font-bold flex items-center gap-2">
                         <Upload size={18} /> Change
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 w-40 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 group-hover:text-red-500 transition-colors">
                    <ImageIcon size={64} />
                  </div>
                )}
                {!previewUrl && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-gray-500 font-medium group-hover:text-red-600 transition-colors flex items-center gap-2">
                         <Upload size={18} /> Upload Image
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Or Paste Image (Ctrl+V)</span>
                    </div>
                )}
              </label>
            </div>

             {/* Basic Identifiers */}
             <div className="space-y-4">
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Part Name <span className="text-red-500">*</span></label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Brake Pad Set"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  />
               </div>
               <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-1">Part Number <span className="text-red-500">*</span></label>
                 <input
                   name="part_number"
                   value={formData.part_number}
                   onChange={handleChange}
                   required
                   placeholder="e.g. BP-12345-X"
                   className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono text-base"
                 />
               </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Details & Specifics */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Row 1: Brand & Supplier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Brand</label>
                <input
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="e.g. Toyota, Bosch"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
              <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-1">Supplier</label>
                 <div className="relative">
                   <select
                     name="supplier"
                     value={formData.supplier}
                     onChange={handleChange}
                     className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none appearance-none bg-white"
                   >
                     <option value="">Select a Supplier...</option>
                     {suppliers.map((s) => (
                       <option key={s.id} value={s.id}>
                         {s.name}
                       </option>
                     ))}
                   </select>
                   <div className="fill-current h-4 w-4 absolute right-3 top-3.5 pointer-events-none text-gray-400">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                   </div>
                 </div>
              </div>
            </div>

            {/* Row 2: Pricing & Stock (Card) */}
            <div className="bg-gray-50/80 p-5 rounded-xl border border-gray-100">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-bold mb-4 border-b pb-2">Inventory & Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Cost Price (LKR)</label>
                    <input
                      type="number"
                      name="buy_price"
                      value={formData.buy_price}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                 </div>
                 <div>
                    <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Selling Price (LKR)</label>
                    <input
                      type="number"
                      name="sell_price"
                      value={formData.sell_price}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-800 font-mono"
                    />
                 </div>
                 <div>
                    <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Current Stock</label>
                    <input
                      type="number"
                      name="stock_qty"
                      value={formData.stock_qty}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Rack / Bin Location</label>
                    <input
                      name="rack_location"
                      value={formData.rack_location}
                      onChange={handleChange}
                      required
                      placeholder="e.g. A-12"
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
                    />
                 </div>
              </div>
            </div>

            {/* Row 3: Compatible Vehicles */}
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Car size={20} /> Fits Vehicles
              </h3>

              <div className="relative mb-4" ref={dropdownRef}>
                <div className="flex items-center border border-blue-200 rounded-lg bg-white overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <div className="pl-3 text-blue-300">
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
                    placeholder="Search Vehicle (e.g. 'Toyota Axio')..."
                    className="flex-1 p-2.5 outline-none text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCreatingVehicle(!isCreatingVehicle)}
                    className="mr-2 p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 text-sm font-bold"
                  >
                    <Plus size={16} /> {isCreatingVehicle ? "Cancel" : "New"}
                  </button>
                </div>

                {/* Inline Vehicle Creation Form */}
                {isCreatingVehicle && (
                  <div className="mt-3 p-4 bg-white border border-blue-200 rounded-lg shadow-inner animate-fade-in-down">
                    <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                       <Plus size={14} /> Add New Vehicle
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        placeholder="Make (e.g. Toyota)"
                        value={newVehicle.make}
                        onChange={(e) => setNewVehicle({...newVehicle, make: e.target.value})}
                        className="p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input
                        placeholder="Model (e.g. Prius)"
                        value={newVehicle.model}
                        onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                        className="p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Year (Optional)"
                        value={newVehicle.year}
                        onChange={(e) => setNewVehicle({...newVehicle, year: e.target.value})}
                        className="p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCreateVehicle}
                        disabled={vehicleSaving || !newVehicle.make || !newVehicle.model}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                      >
                        {vehicleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save & Add Vehicle
                      </button>
                    </div>
                  </div>
                )}

                {/* Dropdown List */}
                {showVehicleDropdown && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl custom-scrollbar animate-fade-in-up">
                    {filteredVehicles.length > 0 ? (
                      filteredVehicles.map((v) => {
                        const isSelected = formData.compatible_vehicles.includes(
                          v.id
                        );
                        return (
                          <div
                            key={v.id}
                            onClick={() => !isSelected && addVehicleToPart(v.id)}
                            className={`p-3 cursor-pointer flex justify-between items-center border-b last:border-b-0 hover:bg-blue-50 transition-colors ${
                              isSelected
                                ? "bg-blue-50/80 opacity-60 cursor-default"
                                : ""
                            }`}
                          >
                            <span className="text-sm font-medium text-gray-700">
                              <span className="text-gray-400 mr-1">{v.year}</span> {v.make} <span className="font-bold">{v.model}</span>
                            </span>
                            {isSelected && (
                              <Check size={16} className="text-blue-600" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-gray-500 text-center text-sm">
                        No vehicles found matching "{vehicleSearch}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {formData.compatible_vehicles.map((id) => (
                  <span
                    key={id}
                    className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in"
                  >
                    {getVehicleName(id)}
                    <button
                      type="button"
                      onClick={() => removeVehicle(id)}
                      className="text-blue-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {formData.compatible_vehicles.length === 0 && (
                  <div className="text-sm text-blue-300 italic flex items-center gap-2">
                     <span className="w-1.5 h-1.5 bg-blue-300 rounded-full"></span>
                     No vehicles selected yet.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer / Submit */}
        <div className="border-t border-gray-100 mt-8 pt-6 flex justify-end gap-3">
            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
            )}
            <button
                type="submit"
                disabled={isSubmitting}
                className={`px-8 py-2.5 rounded-lg text-white font-bold flex items-center gap-2 shadow-md transition-all ${
                    isSubmitting 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-red-600 hover:bg-red-700 hover:shadow-lg active:scale-95"
                }`}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 size={20} className="animate-spin" /> Saving...
                    </>
                ) : (
                    <>
                        <Save size={20} /> {editingPart ? "Update Part" : "Save Part"}
                    </>
                )}
            </button>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
