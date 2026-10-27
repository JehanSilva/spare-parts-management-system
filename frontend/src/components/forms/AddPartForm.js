import React, { useState, useEffect, useRef } from "react";
import SupplierSelect from "./SupplierSelect";
import { fetchSuppliers, fetchVehicles, createVehicle, resolveVehicleList } from "../../services/api";
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
  ListPlus,
} from "lucide-react";
import AvatarBadge from "../AvatarBadge";
import { caseOnChange, titleCaseName } from "../titleCase";

// Small uppercase section heading, matching the muted meta line on the cards.
const SectionLabel = ({ children, action }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</span>
    {action}
  </div>
);

// Markup and supplier discount implied by a cost/selling price pair, as the
// strings the % boxes show ("" when there's nothing to work from). Discount off
// the selling price is the same figure as the margin.
const toPercentString = (n) => String(Number(n.toFixed(1)));
const pricesToPercents = (costValue, sellValue) => {
  const cost = parseFloat(costValue);
  const sell = parseFloat(sellValue);
  const valid = cost > 0 && sell > 0;
  return {
    markup: valid ? toPercentString(((sell - cost) / cost) * 100) : "",
    discount: valid ? toPercentString(((sell - cost) / sell) * 100) : "",
  };
};
const percentOnly = (value) => value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const formatLKR = (n) =>
  `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // "Add list": several compatible vehicles typed as one comma-separated line.
  const [isAddingList, setIsAddingList] = useState(false);
  const [vehicleListText, setVehicleListText] = useState("");
  const [vehicleListSaving, setVehicleListSaving] = useState(false);
  const [vehicleListError, setVehicleListError] = useState("");
  const [vehicleListSummary, setVehicleListSummary] = useState("");

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
    min_sell_price: "",
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
        // Null (no limit) would make the number input uncontrolled.
        min_sell_price: editingPart.min_sell_price ?? "",
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

  // --- Price calculator ---
  // Markup % (under cost) works out the selling price; supplier discount %
  // (under selling) works out the cost. Both boxes otherwise show the figure
  // implied by the two prices — except the one being typed in, which keeps
  // exactly what was typed. Neither is saved; they only fill in the prices.
  const [markupInput, setMarkupInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  // Max discount % a cashier may give: sets the minimum selling price.
  const [minDiscountInput, setMinDiscountInput] = useState("");
  const percentSource = useRef(null); // "markup" | "discount" | "minDiscount" | null (a price was typed)

  useEffect(() => {
    const { markup, discount } = pricesToPercents(formData.buy_price, formData.sell_price);
    if (percentSource.current !== "markup") setMarkupInput(markup);
    if (percentSource.current !== "discount") setDiscountInput(discount);
    if (percentSource.current !== "minDiscount") {
      const sell = parseFloat(formData.sell_price);
      const min = parseFloat(formData.min_sell_price);
      setMinDiscountInput(
        sell > 0 && formData.min_sell_price !== "" && !isNaN(min) && min <= sell
          ? toPercentString(((sell - min) / sell) * 100)
          : ""
      );
    }
  }, [formData.buy_price, formData.sell_price, formData.min_sell_price]);

  const handlePriceChange = (e) => {
    percentSource.current = null;
    handleChange(e);
  };

  const handleMarkupChange = (e) => {
    const value = percentOnly(e.target.value);
    percentSource.current = "markup";
    setMarkupInput(value);
    const cost = parseFloat(formData.buy_price);
    const markup = parseFloat(value);
    if (cost > 0 && !isNaN(markup)) {
      setFormData((prev) => ({ ...prev, sell_price: (cost * (1 + markup / 100)).toFixed(2) }));
    }
  };

  const handleDiscountChange = (e) => {
    const value = percentOnly(e.target.value);
    percentSource.current = "discount";
    setDiscountInput(value);
    const sell = parseFloat(formData.sell_price);
    const discount = parseFloat(value);
    if (sell > 0 && !isNaN(discount)) {
      setFormData((prev) => ({ ...prev, buy_price: (sell * (1 - discount / 100)).toFixed(2) }));
    }
  };

  const handleMinDiscountChange = (e) => {
    const value = percentOnly(e.target.value);
    percentSource.current = "minDiscount";
    setMinDiscountInput(value);
    const sell = parseFloat(formData.sell_price);
    const discount = parseFloat(value);
    if (sell > 0 && !isNaN(discount)) {
      setFormData((prev) => ({
        ...prev,
        min_sell_price: (sell * (1 - Math.min(discount, 100) / 100)).toFixed(2),
      }));
    } else if (value === "") {
      // Clearing the % clears the floor too — back to "no discount limit".
      setFormData((prev) => ({ ...prev, min_sell_price: "" }));
    }
  };

  const costNum = parseFloat(formData.buy_price);
  const sellNum = parseFloat(formData.sell_price);
  const pricesValid = costNum > 0 && sellNum > 0;
  const profit = pricesValid ? sellNum - costNum : 0;

  // Part names are title-cased as they're typed (the server applies the same
  // rule on save); caseOnChange keeps the caret in place while it does.
  const handleNameChange = caseOnChange(titleCaseName, (name) => setFormData({ ...formData, name }));

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

  const handleAddVehicleList = async () => {
    if (!vehicleListText.trim()) return;
    setVehicleListSaving(true);
    setVehicleListError("");
    try {
      const { vehicles: resolved, created, skipped } = await resolveVehicleList(vehicleListText);
      // Newly created models have to be known locally for their chips to name them.
      setVehicles((prev) => [...prev, ...resolved.filter((v) => !prev.some((p) => p.id === v.id))]);
      const added = resolved.map((v) => v.id).filter((id) => !formData.compatible_vehicles.includes(id));
      setFormData((prev) => ({
        ...prev,
        compatible_vehicles: [...prev.compatible_vehicles, ...added.filter((id) => !prev.compatible_vehicles.includes(id))],
      }));

      const parts = [];
      parts.push(`Added ${added.length} vehicle${added.length === 1 ? "" : "s"}`);
      if (created.length) parts[0] += ` (${created.length} new model${created.length === 1 ? "" : "s"} created)`;
      if (resolved.length > added.length) parts.push(`${resolved.length - added.length} already listed`);
      skipped.forEach((s) => parts.push(`Skipped \u201C${s.text}\u201D: ${s.reason}`));
      setVehicleListSummary(parts.join(". ") + ".");

      setVehicleListText("");
      setIsAddingList(false);
    } catch (error) {
      console.error("Failed to add vehicle list", error);
      setVehicleListError("Couldn\u2019t add those vehicles. Please try again.");
    } finally {
      setVehicleListSaving(false);
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

      // min_sell_price is optional — an empty value is sent as "" so the
      // serializer clears any existing limit (see BlankableDecimalField).
      if (key === "min_sell_price" && (value === null || value === undefined)) {
        value = "";
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

  // Discount-limit preview: min_sell_price is the floor the POS uses to work
  // out how much a cashier may knock off this part.
  const sellPriceNum = parseFloat(formData.sell_price);
  const minPriceNum = parseFloat(formData.min_sell_price);
  const hasMinPrice = formData.min_sell_price !== "" && !isNaN(minPriceNum);
  const minPriceInvalid =
    hasMinPrice && !isNaN(sellPriceNum) && minPriceNum > sellPriceNum;
  const maxDiscountHint =
    hasMinPrice && !isNaN(sellPriceNum) && !minPriceInvalid
      ? `Cashiers can discount up to LKR ${(sellPriceNum - minPriceNum).toLocaleString()} per unit.`
      : "The lowest price a cashier may sell this at. Blank means no discount limit.";

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
                    onChange={handleNameChange}
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
              <SupplierSelect
                suppliers={suppliers}
                value={formData.supplier}
                onChange={(id) => setFormData({ ...formData, supplier: id })}
                placeholder="Select a supplier..."
                noneLabel="None"
                floating
                icon={<Truck className="absolute left-3 top-3 text-gray-400 z-10" size={16} />}
                triggerClassName={iconInputClass}
              />
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
                    onChange={handlePriceChange}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-500 shrink-0">Markup</label>
                    <div className="relative w-24">
                      <input
                        value={markupInput}
                        onChange={handleMarkupChange}
                        inputMode="decimal"
                        placeholder="—"
                        title="Markup on cost — works out the selling price"
                        className="w-full py-1.5 pl-2.5 pr-6 bg-white border border-gray-200 rounded-lg text-xs font-mono text-right focus:border-gray-900 focus:ring-0 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">%</span>
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">
                      {markupInput && !(costNum > 0) ? "Enter the cost price first" : "\u2192 sets selling price"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Selling price (LKR)</label>
                  <input
                    type="number"
                    name="sell_price"
                    value={formData.sell_price}
                    onChange={handlePriceChange}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-500 shrink-0">Supplier discount</label>
                    <div className="relative w-24">
                      <input
                        value={discountInput}
                        onChange={handleDiscountChange}
                        inputMode="decimal"
                        placeholder="—"
                        title="Discount the supplier gave off the selling price — works out the cost price"
                        className="w-full py-1.5 pl-2.5 pr-6 bg-white border border-gray-200 rounded-lg text-xs font-mono text-right focus:border-gray-900 focus:ring-0 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">%</span>
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">
                      {discountInput && !(sellNum > 0) ? "Enter the selling price first" : "\u2192 sets cost price"}
                    </span>
                  </div>
                </div>
                {pricesValid && (
                  <p
                    className={`md:col-span-2 text-xs font-semibold ${
                      profit < 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {profit < 0
                      ? `Selling below cost \u2014 loss ${formatLKR(-profit)}`
                      : `Profit ${formatLKR(profit)} \u00b7 Markup ${toPercentString((profit / costNum) * 100)}% \u00b7 Margin ${toPercentString((profit / sellNum) * 100)}%`}
                  </p>
                )}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Minimum selling price (LKR){" "}
                    <span className="font-normal text-gray-400">— optional</span>
                  </label>
                  <input
                    type="number"
                    name="min_sell_price"
                    value={formData.min_sell_price}
                    onChange={handlePriceChange}
                    placeholder="Leave blank for no discount limit"
                    className={`w-full p-2.5 bg-white border rounded-xl text-sm font-mono focus:ring-0 focus:outline-none transition-colors ${
                      minPriceInvalid
                        ? "border-red-300 text-red-700 focus:border-red-500"
                        : "border-gray-200 focus:border-gray-900"
                    }`}
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-500 shrink-0">Max discount</label>
                    <div className="relative w-24">
                      <input
                        value={minDiscountInput}
                        onChange={handleMinDiscountChange}
                        inputMode="decimal"
                        placeholder="—"
                        title="Largest discount off the selling price a cashier may give — works out the minimum price"
                        className="w-full py-1.5 pl-2.5 pr-6 bg-white border border-gray-200 rounded-lg text-xs font-mono text-right focus:border-gray-900 focus:ring-0 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">%</span>
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">
                      {minDiscountInput && !(sellNum > 0) ? "Enter the selling price first" : "\u2192 sets minimum price"}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1 ${minPriceInvalid ? "text-red-500" : "text-gray-400"}`}>
                    {minPriceInvalid
                      ? "Minimum selling price can't be above the selling price."
                      : maxDiscountHint}
                  </p>
                  {/* What's still made if a cashier goes all the way down to the floor. */}
                  {hasMinPrice && !minPriceInvalid && costNum > 0 && minPriceNum > 0 && (
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        minPriceNum < costNum ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {minPriceNum < costNum
                        ? `At the minimum price: below cost \u2014 loss ${formatLKR(costNum - minPriceNum)} per unit`
                        : `At the minimum price: Profit ${formatLKR(minPriceNum - costNum)} \u00b7 Markup ${toPercentString(((minPriceNum - costNum) / costNum) * 100)}% \u00b7 Margin ${toPercentString(((minPriceNum - costNum) / minPriceNum) * 100)}%`}
                    </p>
                  )}
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
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingList(!isAddingList);
                        setIsCreatingVehicle(false);
                        setVehicleListError("");
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <ListPlus size={13} /> {isAddingList ? "Cancel" : "Add list"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingVehicle(!isCreatingVehicle);
                        setIsAddingList(false);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <Plus size={13} /> {isCreatingVehicle ? "Cancel" : "New model"}
                    </button>
                  </div>
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

                {/* Several vehicles at once, typed as a list */}
                {isAddingList && (
                  <div className="mt-3 p-4 bg-white border border-gray-200 rounded-2xl animate-fade-in-down">
                    <SectionLabel>Add a list of vehicles</SectionLabel>
                    <textarea
                      value={vehicleListText}
                      onChange={(e) => setVehicleListText(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="Toyota Aqua, Honda Vezel, Toyota Corolla 2018"
                      className="w-full p-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Make then model, separated by commas. A year is optional. Models not in the list yet are created.
                    </p>
                    {vehicleListError && <p className="mt-2 text-xs text-red-600 font-medium">{vehicleListError}</p>}
                    <div className="mt-3 flex md:justify-end">
                      <button
                        type="button"
                        onClick={handleAddVehicleList}
                        disabled={vehicleListSaving || !vehicleListText.trim()}
                        className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors w-full md:w-auto"
                      >
                        {vehicleListSaving ? <Loader2 size={13} className="animate-spin" /> : <ListPlus size={13} />}
                        Add all
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
              {vehicleListSummary && (
                <p className="mt-2 text-xs text-gray-500">{vehicleListSummary}</p>
              )}
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
