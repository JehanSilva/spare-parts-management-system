import React, { useState } from "react";
import { createSupplier } from "../../services/api";
import { Save, X } from "lucide-react";

const AddSupplierForm = ({ onSupplierAdded, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSupplier(formData);
      alert("Supplier added successfully!");
      setFormData({
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
      });
      if (onSupplierAdded) onSupplierAdded();
    } catch (error) {
      alert("Failed to add supplier. Check console.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-red-100 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-red-900">
          Register New Supplier
        </h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-red-600">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Name *
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
              placeholder="e.g. AutoParts LK"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contact Person
            </label>
            <input
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
              placeholder="e.g. Mr. Perera"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
              placeholder="e.g. 077-1234567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
              placeholder="sales@autopartslk.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows="2"
            className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
            placeholder="No. 123, Main Street, Colombo"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-red-700 text-white px-6 py-2 rounded shadow hover:bg-red-800 flex items-center gap-2"
          >
            <Save size={18} /> Save Supplier
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSupplierForm;
