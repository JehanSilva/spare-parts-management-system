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
  Tag,
  Truck,
  MapPin,
} from "lucide-react";
import AvatarBadge from "../AvatarBadge";

// Small uppercase section heading, matching the muted meta line on the cards.
const SectionLabel = ({ children, action }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</span>
    {action}
  </div>
);

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
    if (!v) return "Unknown";
    return v.year ? `${v.year} ${v.make} ${v.model}` : `${v.make} ${v.model}`;
  };

  // --- Filter Vehicles based on search ---
  const filteredVehicles = vehicles.filter((v) => {
    const yearStr = v.year ? `${v.year} ` : "";
    const fullName = `${yearStr}${v.make} ${v.model}`.toLowerCase();
    return fullName.includes(vehicleSearch.trim().toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const dataToSend = new FormData();

    Object.keys(formData).forEach((key) => {
      let value = formData[key];
      
      // Default empty numerical fields to 0
      if ((key === "buy_price" || key === "sell_price" || key === "stock_qty") && value === "") {
        value = 0;
      }

      if (key === "compatible_vehicles") {
        formData[key].forEach((id) =>
          dataToSend.append("compatible_vehicles", id)
        );
      } else if (key === "image") {
        if (formData.image instanceof File) {
          dataToSend.append("image", formData.image);
        }
      } else if (value !== null && value !== undefined) {
        dataToSend.append(key, value);
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

  const inputClass =
    "w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors";
  const iconInputClass = `${inputClass} pl-9`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 mb-8 animate-fade-in-down">
      {/* Header — mirrors a card: avatar, muted meta line, bold title */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {formData.name.trim() ? (
            <AvatarBadge name={formData.name} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">
              {editingPart ? "Editing part" : "New part"}
            </p>
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {formData.name.trim() || (editingPart ? "Edit Part Details" : "Add New Part")}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Image & identifiers */}
          <div className="lg:col-span-1">
            <SectionLabel>Photo</SectionLabel>

            <div
              onPaste={handlePaste}
              tabIndex="0"
              className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:border-gray-400 focus:border-gray-900 focus:outline-none transition-colors cursor-pointer group"
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
                  <div className="relative w-full aspect-square bg-white p-2 rounded-xl border border-gray-100">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <p className="text-white text-xs font-bold flex items-center gap-1.5">
                        <Upload size={14} /> Change
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-28 w-28 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                      <ImageIcon size={44} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Upload size={13} /> Upload image
                      </span>
                      <span className="text-[10px] text-gray-400">Or paste (Ctrl+V)</span>
                    </div>
                  </>
                )}
              </label>
            </div>

            <div className="mt-5">
              <SectionLabel>Identity</SectionLabel>
              <div className="space-y-3">
                <div className="relative">
                  <Package className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Part name * — e.g. Brake Pad Set"
                    className={iconInputClass}
                  />
                </div>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input
                    name="part_number"
                    value={formData.part_number}
                    onChange={handleChange}
                    required
                    placeholder="Part number * — e.g. BP-12345-X"
                    className={`${iconInputClass} font-mono`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Details */}
          <div className="lg:col-span-2">
            <SectionLabel>Supply</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Tag className="absolute left-3 top-3 text-gray-400" size={16} />
                <input
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  placeholder="Brand — e.g. Toyota, Bosch"
                  className={iconInputClass}
                />
              </div>
              <div className="relative">
                <Truck className="absolute left-3 top-3 text-gray-400 z-10" size={16} />
                <select
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  className={`${iconInputClass} appearance-none`}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div className="h-4 w-4 absolute right-3 top-3.5 pointer-events-none text-gray-400 fill-current">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            {/* Pricing & stock */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 mt-5">
              <SectionLabel>Inventory &amp; Pricing</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Cost price (LKR)</label>
                  <input
                    type="number"
                    name="buy_price"
                    value={formData.buy_price}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Selling price (LKR)</label>
                  <input
                    type="number"
                    name="sell_price"
                    value={formData.sell_price}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Current stock</label>
                  <input
                    type="number"
                    name="stock_qty"
                    value={formData.stock_qty}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Rack / bin location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      name="rack_location"
                      value={formData.rack_location}
                      onChange={handleChange}
                      placeholder="e.g. A-12"
                      className="w-full pl-9 p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Compatible vehicles */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 mt-5">
              <SectionLabel
                action={
                  <button
                    type="button"
                    onClick={() => setIsCreatingVehicle(!isCreatingVehicle)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <Plus size={13} /> {isCreatingVehicle ? "Cancel" : "New model"}
                  </button>
                }
              >
                Fits Vehicles
              </SectionLabel>

              <div className="relative mb-3" ref={dropdownRef}>
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => {
                    setVehicleSearch(e.target.value);
                    setShowVehicleDropdown(true);
                  }}
                  onFocus={() => setShowVehicleDropdown(true)}
                  placeholder="Search vehicle models..."
                  className="w-full pl-9 p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                />

                {/* Inline vehicle creation */}
                {isCreatingVehicle && (
                  <div className="mt-3 p-4 bg-white border border-gray-200 rounded-2xl animate-fade-in-down">
                    <SectionLabel>New Vehicle Model</SectionLabel>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        placeholder="Make — e.g. Toyota"
                        value={newVehicle.make}
                        onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                        className="p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                      />
                      <input
                        placeholder="Model — e.g. Prius"
                        value={newVehicle.model}
                        onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                        className="p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                      />
                      <input
                        type="number"
                        placeholder="Year (optional)"
                        value={newVehicle.year}
                        onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                        className="p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="mt-3 flex md:justify-end">
                      <button
                        type="button"
                        onClick={handleCreateVehicle}
                        disabled={vehicleSaving || !newVehicle.make || !newVehicle.model}
                        className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors w-full md:w-auto"
                      >
                        {vehicleSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save &amp; add
                      </button>
                    </div>
                  </div>
                )}

                {/* Dropdown list */}
                {showVehicleDropdown && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-2xl mt-1 max-h-60 overflow-y-auto shadow-xl custom-scrollbar animate-fade-in-up">
                    {filteredVehicles.length > 0 ? (
                      filteredVehicles.map((v) => {
                        const isSelected = formData.compatible_vehicles.includes(v.id);
                        return (
                          <div
                            key={v.id}
                            onClick={() => !isSelected && addVehicleToPart(v.id)}
                            className={`px-3 py-2.5 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${isSelected ? "opacity-50 cursor-default" : ""
                              }`}
                          >
                            <span className="text-sm text-gray-700">
                              {v.year && <span className="text-gray-400 mr-1">{v.year}</span>} {v.make}{" "}
                              <span className="font-bold">{v.model}</span>
                            </span>
                            {isSelected && <Check size={15} className="text-gray-900" />}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-gray-400 text-center text-sm">
                        No vehicles found matching "{vehicleSearch}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected chips */}
              <div className="flex flex-wrap gap-2 min-h-[34px]">
                {formData.compatible_vehicles.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg animate-scale-in"
                  >
                    <Car size={12} className="shrink-0 text-gray-400" />
                    {getVehicleName(id)}
                    <button
                      type="button"
                      onClick={() => removeVehicle(id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {formData.compatible_vehicles.length === 0 && (
                  <span className="text-xs text-gray-400 italic self-center">
                    No vehicles selected yet.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — hint on the left, actions on the right */}
        <div className="border-t border-gray-100 mt-6 pt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            {formData.compatible_vehicles.length > 0
              ? `Fits ${formData.compatible_vehicles.length} vehicle model${formData.compatible_vehicles.length > 1 ? "s" : ""}`
              : "Link vehicle models so this part shows up in compatibility searches."}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-full transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> {editingPart ? "Update part" : "Save part"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
