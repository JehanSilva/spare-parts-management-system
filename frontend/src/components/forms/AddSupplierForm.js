import React, { useState, useEffect } from "react";
import { createSupplier, updateSupplier } from "../../services/api";
import { Save, X, Truck } from "lucide-react";

const AddSupplierForm = ({ onSupplierAdded, onCancel, editingSupplier }) => {
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name,
        contact_person: editingSupplier.contact_person,
        phone: editingSupplier.phone,
        email: editingSupplier.email,
        address: editingSupplier.address,
      });
    }
  }, [editingSupplier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData);
        alert("Supplier Updated!");
      } else {
        await createSupplier(formData);
        alert("Supplier Added!");
      }
      onSupplierAdded();
    } catch (error) {
      alert("Operation failed.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-600 mb-6 animate-fade-in-down">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
          <Truck size={24} />{" "}
          {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-red-600">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Company Name"
            className="p-2 border rounded"
            required
          />
          <input
            name="contact_person"
            value={formData.contact_person}
            onChange={(e) =>
              setFormData({ ...formData, contact_person: e.target.value })
            }
            placeholder="Contact Person"
            className="p-2 border rounded"
          />
          <input
            name="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="Phone"
            className="p-2 border rounded"
          />
          <input
            name="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="Email"
            className="p-2 border rounded"
          />
        </div>
        <textarea
          name="address"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          placeholder="Address"
          className="w-full p-2 border rounded"
          rows="2"
        />
        <button
          type="submit"
          className="bg-red-600 text-white px-6 py-2 rounded font-bold hover:bg-red-700 w-full md:w-auto"
        >
          <Save size={18} className="inline mr-2" />{" "}
          {editingSupplier ? "Update" : "Save"}
        </button>
      </form>
    </div>
  );
};

export default AddSupplierForm;
