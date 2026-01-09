import React, { useEffect, useState } from "react";
import {
  fetchSuppliers,
  deleteSupplier,
  createSupplier,
  updateSupplier,
} from "../services/api";
import AddSupplierForm from "../components/forms/AddSupplierForm";
import AlertComponent from "../components/AlertComponent";
import {
  Truck,
  Plus,
  Phone,
  Mail,
  MapPin,
  User,
  Search,
  Edit2,
  Trash2,
  XCircle,
} from "lucide-react";

const SupplierPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Alert State
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // --- 1. Load Data ---
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error("Failed to load suppliers", error);
      setAlertInfo({ type: "error", message: "Failed to load supplier list." });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // --- 2. Action Handlers ---

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    setAlertInfo({ type: "", message: "" });
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      try {
        await deleteSupplier(id);
        setAlertInfo({
          type: "success",
          message: "Supplier deleted successfully!",
        });
        loadSuppliers();
      } catch (error) {
        setAlertInfo({
          type: "error",
          message:
            "Failed to delete. Ensure they are not linked to existing parts.",
        });
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  // --- 3. SUBMIT HANDLER (This logic was missing/not connected) ---
  const handleFormSubmit = async (formData) => {
    setAlertInfo({ type: "", message: "" }); // Clear alerts

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        setAlertInfo({
          type: "success",
          message: "Supplier Updated Successfully!",
        });
      } else {
        await createSupplier(formData);
        setAlertInfo({
          type: "success",
          message: "Supplier Added Successfully!",
        });
      }

      loadSuppliers();
      handleFormClose();
    } catch (error) {
      console.error("Save Error:", error);

      // Error Parsing Logic
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
          message: "Network error. Please check your connection.",
        });
      }
    }
  };

  // --- 4. Client-side Search ---
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contact_person &&
        s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      {/* Alert Component */}
      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
            <Truck className="w-6 h-6 md:w-8 md:h-8" /> Supplier Directory
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage your parts distributors.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm) handleFormClose();
            else setShowForm(true);
          }}
          className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold shadow transition flex items-center justify-center gap-2 text-white ${
            showForm
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {showForm ? <XCircle size={20} /> : <Plus size={20} />}
          {showForm ? "Close Form" : "Add Supplier"}
        </button>
      </div>

      {/* --- FORM SECTION --- */}
      {showForm && (
        <div className="mb-8 animate-fade-in-down">
          {/* THIS IS THE FIX: Passing the 'onSubmit' prop */}
          <AddSupplierForm
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            editingSupplier={editingSupplier}
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-6 w-full md:max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by name or contact person..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-2"></div>
          <p>Loading Directory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded-lg shadow border border-gray-100">
              <Truck size={48} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 italic">No suppliers found.</p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 border-t-4 border-red-600 p-5 relative group"
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="p-2 bg-gray-100 text-blue-600 rounded-full hover:bg-blue-100"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 bg-gray-100 text-red-500 rounded-full hover:bg-red-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-1 pr-14 truncate">
                  {supplier.name}
                </h2>
                <div className="w-full h-px bg-gray-100 my-3"></div>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-3">
                    <User className="text-red-500 shrink-0" size={18} />
                    <span className="font-medium text-gray-900 truncate">
                      {supplier.contact_person || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="text-red-500 shrink-0" size={18} />
                    <span>{supplier.phone || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="text-red-500 shrink-0" size={18} />
                    <span className="truncate">{supplier.email || "N/A"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="text-red-500 shrink-0 mt-0.5"
                      size={18}
                    />
                    <span className="line-clamp-2">
                      {supplier.address || "N/A"}
                    </span>
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

export default SupplierPage;
