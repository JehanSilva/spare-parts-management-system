import React, { useState, useEffect } from "react";
import { Save, X, Truck, User, Phone, Mail, MapPin, Loader, Trash2, Plus } from "lucide-react";
import AvatarBadge from "../AvatarBadge";

// Small uppercase section heading, matching the muted meta line on the cards.
const SectionLabel = ({ children, action }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</span>
    {action}
  </div>
);

const AddSupplierForm = ({ onSubmit, onCancel, editingSupplier, isSaving }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    contacts: [{ name: "", phones: [""] }],
    primary_phone: "",
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
        primary_phone: editingSupplier.primary_phone || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        address: "",
        contacts: [{ name: "", phones: [""] }],
        primary_phone: "",
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
    const previous = updatedContacts[contactIndex].phones[phoneIndex];
    updatedContacts[contactIndex].phones[phoneIndex] = value;
    // The default is stored as the number itself, so editing the chosen number
    // has to carry the choice along with it.
    const primary =
      formData.primary_phone && formData.primary_phone === previous
        ? value
        : formData.primary_phone;
    setFormData({ ...formData, contacts: updatedContacts, primary_phone: primary });
  };

  const addPhone = (contactIndex) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[contactIndex].phones.push("");
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const removePhone = (contactIndex, phoneIndex) => {
    const updatedContacts = [...formData.contacts];
    const [removed] = updatedContacts[contactIndex].phones.splice(phoneIndex, 1);
    if (updatedContacts[contactIndex].phones.length === 0) {
      updatedContacts[contactIndex].phones.push("");
    }
    setFormData({
      ...formData,
      contacts: updatedContacts,
      primary_phone: formData.primary_phone === removed ? "" : formData.primary_phone,
    });
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [...formData.contacts, { name: "", phones: [""] }]
    });
  };

  const removeContact = (index) => {
    const updatedContacts = [...formData.contacts];
    const [removed] = updatedContacts.splice(index, 1);
    const lostPrimary = (removed.phones || []).includes(formData.primary_phone);
    setFormData({
      ...formData,
      contacts: updatedContacts,
      primary_phone: lostPrimary ? "" : formData.primary_phone,
    });
  };

  const enteredPhones = formData.contacts.flatMap((c) =>
    (c.phones || []).map((p) => p.trim()).filter(Boolean)
  );
  const showDefaultPicker = enteredPhones.length > 1;
  // Falls back to the first number, which is what the card does too.
  const effectivePrimary =
    formData.primary_phone && enteredPhones.includes(formData.primary_phone)
      ? formData.primary_phone
      : enteredPhones[0] || "";

  const handleSubmit = (e) => {
    e.preventDefault();
    // Clean up empty phone numbers and whitespaces
    const cleanedContacts = formData.contacts
      .map(c => ({
        name: c.name.trim(),
        phones: c.phones.map(p => p.trim()).filter(p => p !== "")
      }))
      .filter(c => c.name !== "");

    const remainingPhones = cleanedContacts.flatMap((c) => c.phones);
    onSubmit({
      ...formData,
      contacts: cleanedContacts,
      primary_phone: remainingPhones.includes(formData.primary_phone)
        ? formData.primary_phone
        : "",
    });
  };

  const inputClass =
    "w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      {/* Header — mirrors a supplier card: avatar, muted meta line, bold title */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {formData.name.trim() ? (
            <AvatarBadge name={formData.name} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">
              {editingSupplier ? "Editing supplier" : "New supplier"}
            </p>
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {formData.name.trim() || (editingSupplier ? "Edit Supplier" : "Add New Supplier")}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Company ─────────────────────────────────────────────────── */}
        <SectionLabel>Company</SectionLabel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 relative">
            <Truck className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Company / supplier name *"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="Email address (optional)"
            />
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={inputClass}
              placeholder="Address (optional)"
            />
          </div>
        </div>

        {/* ── Contacts ────────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel
            action={
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
              >
                <Plus size={13} /> Add contact
              </button>
            }
          >
            Contact Persons
            {showDefaultPicker && (
              <span className="normal-case tracking-normal font-medium text-gray-400">
                {" "}— pick the default number
              </span>
            )}
          </SectionLabel>

          <div className="space-y-3">
            {formData.contacts.map((contact, contactIdx) => (
              <div key={contactIdx} className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <AvatarBadge
                      name={contact.name || "?"}
                      size="w-9 h-9 text-[11px]"
                      className={contact.name.trim() ? "" : "bg-gray-200 text-gray-400"}
                    />
                    <div className="relative flex-1 min-w-0">
                      <User className="absolute left-3 top-2.5 text-gray-400" size={15} />
                      <input
                        type="text"
                        required
                        value={contact.name}
                        onChange={(e) => handleContactNameChange(contactIdx, e.target.value)}
                        className="w-full pl-9 p-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:border-gray-900 focus:ring-0 focus:outline-none transition-colors"
                        placeholder="Contact name *"
                      />
                    </div>
                  </div>

                  {formData.contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(contactIdx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors shrink-0"
                      title="Remove contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Phone numbers — indented to line up under the contact name */}
                <div className="space-y-2 sm:pl-[46px]">
                  {contact.phones.map((phone, phoneIdx) => {
                    const isDefault = phone.trim() !== "" && effectivePrimary === phone.trim();
                    return (
                      <div key={phoneIdx} className="flex gap-2 items-center">
                        {showDefaultPicker && (
                          <label
                            className="shrink-0 flex items-center cursor-pointer p-1"
                            title="Use this number as the default for calls"
                          >
                            <input
                              type="radio"
                              name="primaryPhone"
                              className="w-4 h-4 text-gray-900 focus:ring-gray-900 border-gray-300 cursor-pointer"
                              checked={isDefault}
                              onChange={() =>
                                setFormData({ ...formData, primary_phone: phone.trim() })
                              }
                              disabled={phone.trim() === ""}
                            />
                          </label>
                        )}

                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-2.5 text-gray-400" size={15} />
                          <input
                            type="text"
                            required
                            value={phone}
                            onChange={(e) => handlePhoneChange(contactIdx, phoneIdx, e.target.value)}
                            className={`w-full pl-9 pr-16 p-2 bg-white border rounded-xl text-sm focus:ring-0 focus:outline-none transition-colors ${isDefault && showDefaultPicker
                                ? "border-gray-900"
                                : "border-gray-200 focus:border-gray-900"
                              }`}
                            placeholder="e.g. 0771234567"
                          />
                          {isDefault && showDefaultPicker && (
                            <span className="absolute right-3 top-2.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                              Default
                            </span>
                          )}
                        </div>

                        {contact.phones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePhone(contactIdx, phoneIdx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors shrink-0"
                            title="Remove number"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addPhone(contactIdx)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors pt-0.5"
                  >
                    <Plus size={12} /> Add phone number
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer — count on the left, actions on the right ────────── */}
        <div className="border-t border-gray-100 mt-6 pt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">
            {formData.contacts.length} contact{formData.contacts.length > 1 ? "s" : ""}
            {enteredPhones.length > 0 &&
              ` · ${enteredPhones.length} number${enteredPhones.length > 1 ? "s" : ""}`}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader size={13} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> {editingSupplier ? "Update supplier" : "Save supplier"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddSupplierForm;
