import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings, BILLING_METHODS } from "../context/SettingsContext";
import { fetchChequeBanks, createChequeBank, updateChequeBank, deleteChequeBank } from "../services/api";
import { apiErrorMessage } from "../components/apiErrorMessage";
import ConfirmModal from "../components/ConfirmModal";
import {
  Settings,
  Landmark,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Receipt as ReceiptIcon,
  FileSpreadsheet,
  Check,
  ArrowLeft,
  Info,
} from "lucide-react";

// --- One selectable choice within a setting ---
const OptionChoice = ({ active, title, desc, icon: Icon, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`relative flex-1 text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
      active
        ? "border-red-600 bg-red-50/60 shadow-sm"
        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
    }`}
  >
    {active && (
      <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center">
        <Check size={14} strokeWidth={3} />
      </span>
    )}
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
        active ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500"
      }`}
    >
      <Icon size={22} />
    </div>
    <h4 className={`font-bold text-lg ${active ? "text-red-800" : "text-gray-800"}`}>{title}</h4>
    <p className="mt-1 text-sm text-gray-500 leading-relaxed pr-6">{desc}</p>
  </button>
);

// --- A titled group of related settings; future settings get their own ---
const SettingGroup = ({ title, desc, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
    <div className="mb-4">
      <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
    {children}
  </div>
);

// --- Bank accounts the business writes cheques from (shared by everyone, saved on the server) ---
const EMPTY_ACCOUNT = {
  name: "", bank_code: "", branch: "", branch_code: "", account_name: "", account_number: "", notes: "",
};

const fieldCls =
  "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none";
const fieldLabel = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

const AccountForm = ({ initial, busy, submitLabel, onSubmit, onCancel }) => {
  const [form, setForm] = useState({ ...EMPTY_ACCOUNT, ...initial });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const field = (key, label, placeholder) => (
    <div>
      <label className={fieldLabel}>{label}</label>
      <input className={fieldCls} value={form[key] ?? ""} onChange={set(key)} placeholder={placeholder} />
    </div>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (form.name.trim() && (await onSubmit(form))) setForm({ ...EMPTY_ACCOUNT });
      }}
      className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={fieldLabel}>Bank name <span className="text-red-600">*</span></label>
          <input className={fieldCls} value={form.name} onChange={set("name")} placeholder="e.g. Commercial Bank" />
        </div>
        {field("bank_code", "Bank code", "e.g. 7056")}
        {field("branch", "Branch", "e.g. Ja-Ela")}
        {field("branch_code", "Branch code", "e.g. 123")}
        {field("account_name", "Account name", "Name the account is held under")}
        {field("account_number", "Account number", "")}
        <div className="sm:col-span-2">
          <label className={fieldLabel}>Notes</label>
          <textarea rows={2} className={fieldCls} value={form.notes ?? ""} onChange={set("notes")} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {submitLabel}
        </button>
      </div>
    </form>
  );
};

const accountDetails = (b) =>
  [
    b.branch && `${b.branch} branch`,
    b.bank_code && `Bank ${b.bank_code}`,
    b.branch_code && `Branch ${b.branch_code}`,
    b.account_name,
    b.account_number && `A/C ${b.account_number}`,
  ].filter(Boolean).join(" · ");

const BankAccounts = () => {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setBanks(await fetchChequeBanks());
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the bank accounts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Returns true when saved, so the form knows to clear.
  const save = async (form, id) => {
    setBusy(true);
    setError("");
    try {
      if (id) await updateChequeBank(id, form);
      else await createChequeBank(form);
      setEditingId(null);
      setAdding(false);
      await load();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the bank account."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const bank = confirmDelete;
    setConfirmDelete(null);
    setError("");
    try {
      await deleteChequeBank(bank.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove the bank account."));
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={!!confirmDelete}
        title={`Remove ${confirmDelete?.label}?`}
        message="It won't be offered for new cheques. Cheques already written from it keep their bank."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
      {loading ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : (
        <div className="space-y-2">
          {banks.length === 0 && !adding && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">No bank accounts added yet.</p>
          )}
          {banks.map((b) =>
            editingId === b.id ? (
              <AccountForm
                key={b.id}
                initial={b}
                busy={busy}
                submitLabel="Save"
                onSubmit={(form) => save(form, b.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200">
                <Landmark size={18} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{b.name}</p>
                  {accountDetails(b) && <p className="text-xs text-gray-500 truncate">{accountDetails(b)}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {b.book_count} cheque book{b.book_count === 1 ? "" : "s"}
                    {b.book_count > 0 && ` · ${b.leaves_left} lea${b.leaves_left === 1 ? "f" : "ves"} left`}
                  </p>
                </div>
                <button onClick={() => setEditingId(b.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => setConfirmDelete(b)} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-4">
        {adding ? (
          <AccountForm busy={busy} submitLabel="Add bank account" onSubmit={(form) => save(form)} onCancel={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800"
          >
            <Plus size={16} /> Add bank account
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-red-600 whitespace-pre-line">{error}</p>}
    </>
  );
};

const OptionsPage = () => {
  const { billingMethod, setBillingMethod } = useSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-gray-200 rounded-xl text-gray-700">
            <Settings size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Options</h1>
            <p className="text-gray-500 mt-0.5">Configure how the system behaves.</p>
          </div>
        </div>

        {/* --- Billing --- */}
        <SettingGroup
          title="Billing Method"
          desc="Choose the document generated when a sale is completed — printed, shared to WhatsApp, and reprinted from Sales History."
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <OptionChoice
              active={billingMethod === BILLING_METHODS.RECEIPT}
              onSelect={() => setBillingMethod(BILLING_METHODS.RECEIPT)}
              title="Receipt"
              icon={ReceiptIcon}
              desc="Compact 80mm thermal slip. Best for walk-in counter sales."
            />
            <OptionChoice
              active={billingMethod === BILLING_METHODS.INVOICE}
              onSelect={() => setBillingMethod(BILLING_METHODS.INVOICE)}
              title="Invoice"
              icon={FileSpreadsheet}
              desc="Full A4 invoice with bill-to details, balance due and signature lines."
            />
          </div>
        </SettingGroup>

        {/* --- Bank accounts --- */}
        <SettingGroup
          title="Bank Accounts"
          desc="The accounts you write cheques from. They're the choices for a cheque's bank in Supplier Payments (with only one, it's picked automatically), and cheque books are tracked against them there. Saved for everyone using the system."
        >
          <BankAccounts />
        </SettingGroup>

        <div className="flex items-start gap-3 text-sm text-gray-500 bg-white border border-gray-100 rounded-2xl p-5">
          <Info size={18} className="shrink-0 mt-0.5 text-gray-400" />
          <p>
            The billing method saves instantly and applies to this device. Other tabs open on this device update
            automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OptionsPage;
