import React, { useEffect, useState } from "react";
import { fetchSuppliers, deleteSupplier } from "../services/api";
import AddSupplierForm from "../components/forms/AddSupplierForm";
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
} from "lucide-react";

const SupplierPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null); // Tracks the supplier being edited

  // 1. Load Suppliers from Backend
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error("Failed to load suppliers", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // 2. Handle Actions
  const handleEdit = (supplier) => {
    setEditingSupplier(supplier); // Pass this data to the form
    setShowForm(true); // Open the form
    window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top to see form
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this supplier? This cannot be undone."
      )
    ) {
      try {
        await deleteSupplier(id);
        // Refresh list after delete
        loadSuppliers();
      } catch (error) {
        alert(
          "Failed to delete supplier. Ensure they are not linked to existing parts."
        );
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null); // Clear editing state so next time it's "Add New"
  };

  const handleFormSuccess = () => {
    loadSuppliers();
    handleFormClose();
  };

  // 3. Filter Logic (Client-side search)
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Truck className="w-8 h-8" /> Supplier Directory
          </h1>
          <p className="text-gray-600 mt-1">
            Manage distributor contacts and details.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) handleFormClose();
            else setShowForm(true);
          }}
          className={`px-6 py-2 rounded-lg font-bold shadow transition flex items-center gap-2 text-white ${
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
          {showForm ? "Close Form" : "Add Supplier"}
        </button>
      </div>

      {/* --- Smart Form (Handles Add & Edit) --- */}
      {showForm && (
        <div className="animate-fade-in-down mb-8">
          <AddSupplierForm
            onSupplierAdded={handleFormSuccess}
            onCancel={handleFormClose}
            editingSupplier={editingSupplier} // Pass the supplier to edit
          />
        </div>
      )}

      {/* --- Search Bar --- */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search suppliers by name or contact person..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- Suppliers Grid --- */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading Suppliers...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 italic">
              No suppliers found.
            </p>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition border-t-4 border-red-600 p-6 relative group"
              >
                {/* Edit/Delete Buttons (Visible on Hover) */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Supplier Info */}
                <h2 className="text-xl font-bold text-gray-800 mb-2 pr-16">
                  {supplier.name}
                </h2>
                <hr className="border-gray-100 my-3" />

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-3">
                    <User className="text-red-500" size={18} />
                    <span className="font-medium text-gray-900">
                      {supplier.contact_person || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="text-red-500" size={18} />
                    <span>{supplier.phone || "No Phone"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="text-red-500" size={18} />
                    <a
                      href={`mailto:${supplier.email}`}
                      className="hover:text-red-700 underline"
                    >
                      {supplier.email || "No Email"}
                    </a>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="text-red-500 mt-1" size={18} />
                    <span className="leading-tight">
                      {supplier.address || "No Address"}
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
