import React, { useState, useEffect } from "react";
import { Save, X, Truck, User, Phone, Mail, MapPin, Loader, Trash2, Plus } from "lucide-react";

const AddSupplierForm = ({ onSubmit, onCancel, editingSupplier, isSaving }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    contacts: [{ name: "", phones: [""] }],
  });

  // Populate form if editing
  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name || "",
        email: editingSupplier.email || "",
        address: editingSupplier.address || "",
        contacts: editingSupplier.contacts && editingSupplier.contacts.length > 0
          ? editingSupplier.contacts.map((c) => ({
              name: c.name || "",
              phones: c.phones && c.phones.length > 0 ? [...c.phones] : [""]
            }))
          : [{ name: "", phones: [""] }],
      });
    } else {
      setFormData({
        name: "",
        email: "",
        address: "",
        contacts: [{ name: "", phones: [""] }],
      });
    }
  }, [editingSupplier]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleContactNameChange = (index, value) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[index].name = value;
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const handlePhoneChange = (contactIndex, phoneIndex, value) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[contactIndex].phones[phoneIndex] = value;
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const addPhone = (contactIndex) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[contactIndex].phones.push("");
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const removePhone = (contactIndex, phoneIndex) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[contactIndex].phones.splice(phoneIndex, 1);
    if (updatedContacts[contactIndex].phones.length === 0) {
      updatedContacts[contactIndex].phones.push("");
    }
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...formData.contacts, { name: "", phones: [""] }]
    });
  };

  const removeContact = (index) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts.splice(index, 1);
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Clean up empty phone numbers and whitespaces
    const cleanedContacts = formData.contacts
      .map(c => ({
        name: c.name.trim(),
        phones: c.phones.map(p => p.trim()).filter(p => p !== "")
      }))
      .filter(c => c.name !== "");

    onSubmit({
      ...formData,
      contacts: cleanedContacts
    });
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

        {/* Contacts Section */}
        <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <User size={18} className="text-red-600" />
              Contact Persons
            </h3>
            <button
              type="button"
              onClick={addContact}
              className="text-xs font-bold text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 bg-red-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
            >
              <Plus size={14} /> Add Contact Person
            </button>
          </div>

          <div className="space-y-4">
            {formData.contacts.map((contact, contactIdx) => (
              <div key={contactIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                {formData.contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(contactIdx)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition"
                    title="Remove Contact"
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contact Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Contact Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      <input
                        type="text"
                        required
                        value={contact.name}
                        onChange={(e) => handleContactNameChange(contactIdx, e.target.value)}
                        className="w-full pl-9 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                        placeholder="e.g. Mr. Perera"
                      />
                    </div>
                  </div>

                  {/* Phone Numbers */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Phone Numbers *
                    </label>
                    <div className="space-y-2">
                      {contact.phones.map((phone, phoneIdx) => (
                        <div key={phoneIdx} className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                              type="text"
                              required
                              value={phone}
                              onChange={(e) => handlePhoneChange(contactIdx, phoneIdx, e.target.value)}
                              className="w-full pl-9 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                              placeholder="e.g. 0771234567"
                            />
                          </div>
                          {contact.phones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePhone(contactIdx, phoneIdx)}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition shrink-0"
                              title="Remove Number"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addPhone(contactIdx)}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-1 mt-1 pl-1"
                      >
                        <Plus size={12} /> Add Phone Number
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
