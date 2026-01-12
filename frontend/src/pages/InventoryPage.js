import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Filter,
  AlertTriangle,
  Package,
  MapPin,
  Edit2,
  Trash2,
  Car,
} from "lucide-react";
import {
  fetchParts,
  deletePart,
  createPart,
  updatePart,
} from "../services/api";
import AddPartForm from "../components/forms/AddPartForm";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";

const InventoryPage = () => {
  const [parts, setParts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPart, setEditingPart] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");

  // Alert & Modal States
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [deleteId, setDeleteId] = useState(null);

  // --- 1. Load Data ---
  const loadData = async () => {
    setLoading(true);
    try {
      const partsData = await fetchParts({
        search: searchTerm,
        brand: selectedBrand,
      });
      setParts(partsData);
    } catch (error) {
      console.error("Failed to load parts", error);
      setAlertInfo({
        type: "error",
        message: "Failed to load inventory data.",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- 2. Action Handlers ---

  const handleSearch = async (e) => {
    e.preventDefault();
    loadData();
  };

  const handleEdit = (part) => {
    setEditingPart(part);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step A: Trigger Delete Modal
  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  // Step B: Execute Delete
  const executeDelete = async () => {
    if (!deleteId) return;

    try {
      await deletePart(deleteId);
      setAlertInfo({ type: "success", message: "Part deleted successfully!" });
      loadData();
    } catch (error) {
      setAlertInfo({
        type: "error",
        message: "Failed to delete part. It may be linked to past sales.",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPart(null);
  };

  // --- 3. Form Submit Handler (Handles Images via FormData) ---
  const handleFormSubmit = async (formData) => {
    setAlertInfo({ type: "", message: "" });

    try {
      if (editingPart) {
        // Update Part
        await updatePart(editingPart.id, formData);
        setAlertInfo({
          type: "success",
          message: "Part Updated Successfully!",
        });
      } else {
        // Create Part
        const response = await createPart(formData);

        // Handle "Smart Update" messages
        if (response.message) {
          setAlertInfo({ type: "success", message: response.message });
        } else {
          setAlertInfo({
            type: "success",
            message: "New Part Added Successfully!",
          });
        }
      }

      loadData();
      handleFormClose();
    } catch (error) {
      console.error("Save Error:", error);

      if (error.response && error.response.data) {
        const errorData = error.response.data;
        const errorMessages = Object.values(errorData).flat().join("\n");
        setAlertInfo({
          type: "error",
          message: `Failed to save:\n${errorMessages}`,
        });
      } else {
        setAlertInfo({
          type: "error",
          message: "Network error. Please check connection.",
        });
      }
    }
  };

  // Helper to render vehicle name safely from Object or ID
  const renderVehicleName = (v) => {
    if (typeof v === "object" && v !== null) {
      return `${v.make} ${v.model}`;
    }
    return "Vehicle";
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      {/* --- CONFIRM MODAL --- */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Part?"
        message="Are you sure you want to delete this part? This cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* --- TOAST ALERT --- */}
      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Package className="w-8 h-8" /> Inventory Management
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage spare parts, stock levels, and prices.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) handleFormClose();
            else setShowForm(true);
          }}
          className={`w-full md:w-auto px-6 py-2 rounded-lg shadow transition flex items-center justify-center gap-2 font-bold text-white ${
            showForm
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <Plus
            size={20}
            className={
              showForm
                ? "rotate-45 transition-transform"
                : "transition-transform"
            }
          />
          {showForm ? "Close Form" : "Add New Part"}
        </button>
      </div>

      {/* Add/Edit Part Form */}
      {showForm && (
        <AddPartForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormClose}
          editingPart={editingPart}
        />
      )}

      {/* Search & Filter Bar */}
      <form
        onSubmit={handleSearch}
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by Name or Part Number..."
            className="w-full pl-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <input
          type="text"
          placeholder="Filter by Brand"
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        />
        <button
          type="submit"
          className="bg-gray-800 text-white p-2 rounded hover:bg-gray-900 flex items-center justify-center gap-2"
        >
          <Filter size={18} /> Apply Filters
        </button>
      </form>

      {/* Parts Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-2"></div>
          <p>Loading Inventory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {parts.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded shadow">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                No parts found matching your criteria.
              </p>
            </div>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col relative group"
              >
                {/* --- Action Buttons --- */}
                <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(part)}
                    className="bg-white p-1.5 rounded-full shadow text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    title="Edit Part"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => confirmDelete(part.id)}
                    className="bg-white p-1.5 rounded-full shadow text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Delete Part"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Image Section */}
                <div className="h-48 bg-gray-100 relative group-hover:opacity-95 transition-opacity">
                  {part.image ? (
                    <img
                      src={part.image}
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                      <Package size={48} opacity={0.2} />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className="absolute bottom-2 left-2">
                    {part.stock_qty <= part.min_stock_level ? (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow">
                        <AlertTriangle size={12} /> Low Stock
                      </span>
                    ) : (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                        In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-2">
                    <h2 className="text-lg font-bold text-gray-800 leading-tight">
                      {part.name}
                    </h2>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      {part.part_number}
                    </p>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <span className="bg-red-50 text-red-800 text-xs font-semibold px-2 py-0.5 rounded border border-red-100">
                      {part.brand || "No Brand"}
                    </span>
                  </div>

                  {/* Compatible Vehicles */}
                  <div className="mb-4">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <Car size={10} /> Fits:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {part.compatible_vehicles &&
                      part.compatible_vehicles.length > 0 ? (
                        part.compatible_vehicles.slice(0, 3).map((v, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200"
                          >
                            {renderVehicleName(v)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">
                          Universal / Unspecified
                        </span>
                      )}
                      {/* +More Tag */}
                      {part.compatible_vehicles &&
                        part.compatible_vehicles.length > 3 && (
                          <span className="text-[10px] text-gray-400 pl-1 pt-0.5">
                            +{part.compatible_vehicles.length - 3} more
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="space-y-1 mb-4 flex-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {part.rack_location}
                    </p>
                    <p
                      className="text-xs text-gray-500 truncate"
                      title={part.supplier_details?.name}
                    >
                      Sup: {part.supplier_details?.name || "Unknown"}
                    </p>
                  </div>

                  {/* Price Footer */}
                  <div className="flex justify-between items-end border-t border-gray-100 pt-3 mt-auto">
                    <div>
                      <p className="text-xs text-gray-400">
                        Buying: LKR {part.buy_price}
                      </p>
                      <p className="text-xl font-bold text-red-700">
                        LKR {part.sell_price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Qty</p>
                      <span
                        className={`font-bold text-lg ${
                          part.stock_qty <= part.min_stock_level
                            ? "text-red-600"
                            : "text-gray-800"
                        }`}
                      >
                        {part.stock_qty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
