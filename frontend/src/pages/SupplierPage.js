import React, { useEffect, useState } from "react";
import {
  fetchSuppliers,
  deleteSupplier,
  createSupplier,
  updateSupplier,
} from "../services/api";
import AddSupplierForm from "../components/forms/AddSupplierForm";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal"; // <--- 1. Import Modal
import AvatarBadge from "../components/AvatarBadge";
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
  Landmark,
  Copy,
  Check,
} from "lucide-react";

// Payment details, shown only once something is on file — suppliers paid in cash
// keep the card exactly as it was.
const BankDetails = ({ supplier }) => {
  const [copied, setCopied] = useState(false);
  const account = supplier.bank_account_number || "";
  const bankLine = [supplier.bank_name, supplier.bank_branch].filter(Boolean).join(" · ");

  if (!bankLine && !account && !supplier.bank_account_name) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin or denied) — the number is on screen anyway.
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2 mt-2">
      <div className="flex items-center gap-2">
        <Landmark size={13} className="text-gray-400 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Bank Details
        </span>
      </div>

      <div className="pl-5 mt-1">
        {bankLine && (
          <p title={bankLine} className="text-xs text-gray-500 truncate">{bankLine}</p>
        )}

        {account && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-semibold text-gray-800 truncate">{account}</span>
            <button
              onClick={handleCopy}
              title={copied ? "Copied" : "Copy account number"}
              className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors shrink-0"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {supplier.bank_account_name && (
          <p title={supplier.bank_account_name} className="text-xs text-gray-500 truncate">
            {supplier.bank_account_name}
          </p>
        )}
      </div>
    </div>
  );
};

// --- Supplier card ---
const SupplierCard = ({ supplier, onEdit, onDelete }) => {
  const contacts = supplier.contacts || [];
  const phoneCount = contacts.reduce((n, c) => n + (c.phones ? c.phones.length : 0), 0);

  // The Call button uses the number marked as default in the edit form, falling
  // back to the first one on file if none is set (or if it was since removed).
  const chosen = supplier.primary_phone;
  const defaultOwner = chosen
    ? contacts.find((c) => (c.phones || []).includes(chosen))
    : null;
  const primaryContact = defaultOwner
    || contacts.find((c) => c.phones && c.phones.length > 0)
    || contacts[0];
  const primaryPhone = defaultOwner ? chosen : primaryContact?.phones?.[0] || "";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-shadow duration-300 p-5 flex flex-col">
      {/* Header: avatar + actions */}
      <div className="flex items-start justify-between gap-3">
        <AvatarBadge name={supplier.name} />

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(supplier)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
            title="Edit Details"
          >
            Edit <Edit2 size={12} />
          </button>
          <button
            onClick={() => onDelete(supplier.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Delete Supplier"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Identity */}
      <p className="text-xs text-gray-400 font-medium mt-4">
        {contacts.length > 0
          ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""}`
          : "No contacts"}
        {phoneCount > 0 && ` · ${phoneCount} number${phoneCount > 1 ? "s" : ""}`}
      </p>
      <h2 className="text-lg font-bold text-gray-900 leading-snug mt-0.5 line-clamp-2">
        {supplier.name}
      </h2>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mt-3">
        {supplier.email ? (
          <a
            href={`mailto:${supplier.email}`}
            title={supplier.email}
            className="inline-flex items-center gap-1.5 max-w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
          >
            <Mail size={12} className="shrink-0 text-gray-400" />
            <span className="truncate">{supplier.email}</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-400 text-xs font-medium px-2.5 py-1 rounded-lg italic">
            <Mail size={12} className="shrink-0" /> No email
          </span>
        )}

        {supplier.address && (
          <span
            title={supplier.address}
            className="inline-flex items-center gap-1.5 max-w-full bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg"
          >
            <MapPin size={12} className="shrink-0 text-gray-400" />
            <span className="truncate">{supplier.address}</span>
          </span>
        )}
      </div>

      {/* Contacts */}
      <div className="mt-4 space-y-2 flex-1">
        {contacts.length > 0 ? (
          contacts.map((contact, cIdx) => (
            <div key={cIdx} className="bg-gray-50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <User size={13} className="text-gray-400 shrink-0" />
                <span className="text-sm font-semibold text-gray-800 truncate">
                  {contact.name || "Unnamed Contact"}
                </span>
              </div>
              {contact.phones && contact.phones.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 mt-1">
                  {contact.phones.map((ph, pIdx) => (
                    <a
                      key={pIdx}
                      href={`tel:${ph}`}
                      className={`text-xs hover:text-red-600 hover:underline ${ph === primaryPhone ? "text-gray-800 font-semibold" : "text-gray-500"
                        }`}
                    >
                      {ph}
                      {ph === primaryPhone && phoneCount > 1 && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400 no-underline">
                          Default
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="pl-5 mt-1 text-xs text-gray-400 italic">No phone numbers</div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-400 italic">
            No contact persons
          </div>
        )}
      </div>

      <BankDetails supplier={supplier} />

      {/* Footer: primary number + call action */}
      <div className="border-t border-gray-100 mt-4 pt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {primaryPhone ? (
            <>
              <p className="text-lg font-bold text-gray-900 leading-none truncate">{primaryPhone}</p>
              <p className="text-[11px] text-gray-400 mt-1 truncate">
                {primaryContact?.name || "Primary contact"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-400 leading-none">No number on file</p>
              <p className="text-[11px] text-gray-400 mt-1">Add one via Edit</p>
            </>
          )}
        </div>

        {primaryPhone ? (
          <a
            href={`tel:${primaryPhone}`}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-full transition-colors shrink-0"
          >
            <Phone size={13} /> Call
          </a>
        ) : (
          <button
            onClick={() => onEdit(supplier)}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-full transition-colors shrink-0"
          >
            <Plus size={13} /> Contact
          </button>
        )}
      </div>
    </div>
  );
};

const SupplierPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Alert State
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // Delete Modal State
  const [deleteId, setDeleteId] = useState(null); // <--- 2. New State for Delete ID

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

  // Step 3a: Open the Modal
  const confirmDelete = (id) => {
    setDeleteId(id); // Set the ID to trigger the modal opening
  };

  // Step 3b: Actually Execute Delete (Called by Modal)
  const executeDelete = async () => {
    if (!deleteId) return;

    // Close modal immediately or wait for success (your choice)
    const idToDelete = deleteId;
    setDeleteId(null); // Close modal

    try {
      await deleteSupplier(idToDelete);
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
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleFormSubmit = async (formData) => {
    setSaveLoading(true);
    setAlertInfo({ type: "", message: "" });
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
    } finally {
      setSaveLoading(false);
    }
  };

  // --- 4. Client-side Search ---
  const filteredSuppliers = suppliers.filter((s) => {
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesName = s.name.toLowerCase().includes(searchLower);
    const matchesContacts = s.contacts && s.contacts.some(
      (c) =>
        (c.name && c.name.toLowerCase().includes(searchLower)) ||
        (c.phones && c.phones.some((p) => p.includes(searchTerm.trim())))
    );
    // Also findable by bank/account, so a payment can be traced back to a supplier.
    const matchesBank =
      (s.bank_name && s.bank_name.toLowerCase().includes(searchLower)) ||
      (s.bank_account_number && s.bank_account_number.toLowerCase().includes(searchLower));
    return matchesName || matchesContacts || matchesBank;
  });

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      {/* --- CONFIRMATION MODAL --- */}
      <ConfirmModal
        isOpen={!!deleteId} // Open if deleteId is not null
        title="Delete Supplier?"
        message="Are you sure you want to remove this supplier? This action cannot be undone."
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

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
            <Truck className="w-6 h-6 md:w-8 md:h-8" /> Supplier Directory
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage your parts distributors and contacts.
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
          <AddSupplierForm
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            editingSupplier={editingSupplier}
            isSaving={saveLoading}
          />
        </div>
      )}

      {/* --- SEARCH BAR --- */}
      <div className="relative mb-6 w-full md:max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search by name, contact person or bank account..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- SUPPLIERS GRID --- */}
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
              <p className="text-gray-500 italic">
                No suppliers found matching "{searchTerm}".
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={handleEdit}
                onDelete={confirmDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierPage;
