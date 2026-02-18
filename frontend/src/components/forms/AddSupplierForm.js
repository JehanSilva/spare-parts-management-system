import React, { useState, useEffect } from "react";
import { Save, X, Truck, User, Phone, Mail, MapPin, Loader } from "lucide-react";

const AddSupplierForm = ({ onSubmit, onCancel, editingSupplier, isSaving }) => {
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  // Populate form if editing
  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name || "",
        contact_person: editingSupplier.contact_person || "",
        phone: editingSupplier.phone || "",
        email: editingSupplier.email || "",
        address: editingSupplier.address || "",
      });
    }
  }, [editingSupplier]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // CRITICAL CHANGE: We do NOT call the API here.
    // We pass the data up to SupplierPage.js via the onSubmit prop.
    onSubmit(formData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-600 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          {editingSupplier ? (
            <Truck className="text-blue-600" />
          ) : (
            <Truck className="text-red-600" />
          )}
          {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Supplier Name (Required) */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company / Supplier Name *
          </label>
          <div className="relative">
            <Truck className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              placeholder="e.g. Toyota Lanka (Pvt) Ltd"
            />
          </div>
        </div>

        {/* Contact Person */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Person
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              placeholder="e.g. Mr. Perera"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              placeholder="e.g. 0771234567"
            />
          </div>
        </div>

        {/* Email */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              placeholder="e.g. sales@toyota.lk (Leave empty if none)"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Leave empty if unknown. Do not type "null".
          </p>
        </div>

        {/* Address */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
            <textarea
              name="address"
              rows="2"
              value={formData.address}
              onChange={handleChange}
              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              placeholder="e.g. No 123, High Level Road, Colombo"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`px-6 py-2 text-white rounded-lg transition font-bold flex items-center gap-2 ${
              isSaving
                ? "bg-red-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSaving ? (
              <>
                <Loader size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {editingSupplier ? "Update Supplier" : "Save Supplier"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSupplierForm;
