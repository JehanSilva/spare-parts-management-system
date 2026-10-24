import React, { useEffect, useRef, useState } from "react";
import {
  fetchRepairServices,
  createRepairService,
  updateRepairService,
  deleteRepairService,
  bulkAddRepairServices,
  fetchRepairChargeHistory,
} from "../services/api";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import { Wrench, Search, Plus, Edit2, Trash2, XCircle, EyeOff, ListPlus, History, Loader2 } from "lucide-react";

const formatLKR = (amount) =>
  `LKR ${Number(amount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// Bills shown before "Show all" — the latest few are usually what matters.
const BILLS_PREVIEW = 5;

// --- One repair's past charges: stats plus every bill, newest first ---
const ChargeHistoryCard = ({ group }) => {
  const [showAll, setShowAll] = useState(false);
  const bills = showAll ? group.bills : group.bills.slice(0, BILLS_PREVIEW);
  const catalog = group.catalog_price != null ? Number(group.catalog_price) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-gray-900">{group.description}</h3>
        {catalog != null && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-900 text-white">
            Saved · {formatLKR(catalog)}
          </span>
        )}
      </div>

      <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billed</p>
          <p className="font-bold text-gray-900">
            {group.times_billed} time{group.times_billed === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Last</p>
          <p className="font-bold text-gray-900">{formatLKR(group.last_price)}</p>
          <p className="text-xs text-gray-500">{formatDate(group.last_billed_at)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Range</p>
          <p className="font-bold text-gray-900">
            {Number(group.min_price) === Number(group.max_price)
              ? formatLKR(group.min_price)
              : `${formatLKR(group.min_price)} – ${Number(group.max_price).toLocaleString("en-LK")}`}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Average</p>
          <p className="font-bold text-gray-900">{formatLKR(group.average_price)}</p>
        </div>
      </div>

      <div className="px-5 pb-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[36rem]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left">
              <th className="py-2 font-bold">Date</th>
              <th className="py-2 font-bold">Vehicle</th>
              <th className="py-2 font-bold">Customer</th>
              <th className="py-2 font-bold text-right">Qty</th>
              <th className="py-2 font-bold text-right">Unit Price</th>
              <th className="py-2 font-bold text-right">Discount</th>
              <th className="py-2 font-bold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill, i) => {
              // Off the saved price: worth noticing when quoting the next one.
              const drifted = catalog != null && Number(bill.unit_price) !== catalog;
              return (
                <tr key={`${bill.sale_id}-${i}`} className="border-t border-gray-100">
                  <td className="py-2 text-gray-700 whitespace-nowrap">{formatDate(bill.date)}</td>
                  <td className="py-2 font-mono text-gray-800">{bill.vehicle_number || "—"}</td>
                  <td className="py-2 text-gray-700">{bill.customer_name || "—"}</td>
                  <td className="py-2 text-right text-gray-700">{bill.quantity}</td>
                  <td
                    className={`py-2 text-right font-semibold ${drifted ? "text-amber-600" : "text-gray-900"}`}
                    title={drifted ? `Saved price is ${formatLKR(catalog)}` : undefined}
                  >
                    {Number(bill.unit_price).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {Number(bill.discount) > 0 ? Number(bill.discount).toLocaleString("en-LK") : "—"}
                  </td>
                  <td className="py-2 text-right font-bold text-gray-900">
                    {Number(bill.total_price).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {group.bills.length > BILLS_PREVIEW && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-sm font-semibold text-red-700 hover:underline"
          >
            {showAll ? "Show fewer" : `Show all ${group.bills.length}`}
          </button>
        )}
      </div>
    </div>
  );
};

// --- Past Charges tab: search a repair and see what it was billed before ---
const PastChargesPanel = ({ query, onQueryChange }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (query.trim().replace(/\s/g, "").length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await fetchRepairChargeHistory(query);
        if (requestRef.current !== requestId) return; // a newer search took over
        setResults(data);
        setError("");
      } catch {
        if (requestRef.current === requestId) setError("Could not load past charges. Please try again.");
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searched = query.trim().length >= 2;

  return (
    <div>
      <div className="relative mb-6 w-full md:max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          autoFocus
          placeholder="Search a repair, e.g. brake pads"
          className="w-full pl-10 pr-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {loading && <Loader2 size={18} className="absolute right-3 top-3.5 text-gray-400 animate-spin" />}
      </div>

      {error ? (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      ) : !searched ? (
        <div className="text-center py-10 bg-white rounded-lg shadow border border-gray-100">
          <History size={44} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">Type a repair to see what it has been charged before.</p>
        </div>
      ) : !loading && results.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow border border-gray-100">
          <p className="text-gray-500">No past charges found for &ldquo;{query.trim()}&rdquo;.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {results.map((group) => (
            <ChargeHistoryCard key={group.description} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};

const emptyForm = { name: "", default_price: "", is_active: true };

// Inline add/edit form — page-scoped, so it lives here rather than in
// components/ (see the LaborItemModal convention in POSPage).
const ServiceForm = ({ initial, onSubmit, onCancel, isSaving }) => {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm(
      initial
        ? {
            name: initial.name,
            default_price: String(initial.default_price),
            is_active: initial.is_active,
          }
        : emptyForm
    );
  }, [initial]);

  const canSave = form.name.trim().length > 0 && parseFloat(form.default_price) >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-bold text-gray-800 mb-4">
        {initial ? "Edit Service" : "New Service"}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Bearing replacement"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Standard price (LKR) *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.default_price}
            onChange={(e) => setForm({ ...form, default_price: e.target.value })}
            placeholder="e.g. 400"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          className="rounded"
        />
        Suggest this service at the POS
      </label>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() =>
            onSubmit({
              name: form.name.trim(),
              default_price: parseFloat(form.default_price),
              is_active: form.is_active,
            })
          }
          disabled={!canSave || isSaving}
          className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {isSaving ? "Saving…" : initial ? "Save Changes" : "Add Service"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Pull "name" and "price" out of one pasted line. Handles the two things that
// actually get pasted: a spreadsheet column pair (tab-separated) and a
// hand-typed comma list. The price is always the trailing number, so names
// containing commas or spaces survive.
const parseServiceLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Non-greedy name + a fully-formed number anchored to the end, so the split
  // lands on the separator that leaves a valid price behind. A greedy split on
  // the last comma turns "Shock absorber L/R, 8,000" into a service called
  // "Shock absorber L/R, 8" priced at zero.
  const NUM = "-?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
  const match =
    trimmed.match(new RegExp(`^(.*?\\S)\\s*[,\\t]\\s*(${NUM})$`)) ||
    trimmed.match(new RegExp(`^(.*?\\S)\\s+(${NUM})$`));

  if (!match) return { name: trimmed, price: null, error: "No price on this line" };

  const price = parseFloat(match[2].replace(/,/g, ""));
  if (Number.isNaN(price)) return { name: match[1], price: null, error: "Price is not a number" };
  if (price < 0) return { name: match[1], price, error: "Price cannot be negative" };
  return { name: match[1].trim(), price, error: null };
};

// Paste a whole price list rather than filling the form once per service.
const BulkAddPanel = ({ onSubmit, onCancel, isSaving }) => {
  const [text, setText] = useState("");

  const parsed = text
    .split("\n")
    .map(parseServiceLine)
    .filter(Boolean);

  const valid = parsed.filter((p) => !p.error);
  const invalid = parsed.filter((p) => p.error);

  // Same normalisation the backend groups on, so the duplicate warning here
  // matches the one it would return.
  const duplicates = (() => {
    const seen = new Set();
    const dupes = new Set();
    valid.forEach((p) => {
      const key = p.name.trim().toLowerCase().split(/\s+/).join(" ");
      if (seen.has(key)) dupes.add(p.name);
      seen.add(key);
    });
    return [...dupes];
  })();

  const canSave = valid.length > 0 && invalid.length === 0 && duplicates.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-bold text-gray-800">Bulk add services</h2>
      <p className="text-sm text-gray-500 mt-1 mb-3">
        One per line, as <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">name, price</span>.
        You can paste two columns straight out of a spreadsheet. Services you already
        have are re-priced rather than duplicated.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={"Bearing replacement, 400\nBrake pad replacement, 4500\nWheel alignment, 1500\nOil change, 800"}
        className="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:bg-white outline-none focus:ring-1 focus:ring-red-400"
      />

      {parsed.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
              {valid.length} ready
            </span>
            {invalid.length > 0 && (
              <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1">
                {invalid.length} need fixing
              </span>
            )}
            {duplicates.length > 0 && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                {duplicates.length} listed twice
              </span>
            )}
          </div>

          {invalid.length > 0 && (
            <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 space-y-0.5 max-h-28 overflow-y-auto">
              {invalid.map((p, i) => (
                <div key={i}>
                  <span className="font-mono">{p.name.slice(0, 50)}</span> — {p.error}
                </div>
              ))}
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Listed more than once: {duplicates.join(", ")}
            </div>
          )}

          {valid.length > 0 && invalid.length === 0 && duplicates.length === 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {valid.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
                  <span className="text-gray-700 truncate pr-2">{p.name}</span>
                  <span className="font-bold text-gray-900 tabular-nums shrink-0">
                    {p.price.toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() =>
            onSubmit(valid.map((p) => ({ name: p.name, default_price: p.price })))
          }
          disabled={!canSave || isSaving}
          className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {isSaving
            ? "Saving…"
            : `Add ${valid.length || ""} service${valid.length === 1 ? "" : "s"}`.replace("  ", " ")}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const RepairServicesPage = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // "services" = the saved catalogue, "history" = Past Charges.
  const [tab, setTab] = useState("services");
  const [historyQuery, setHistoryQuery] = useState("");

  const openHistoryFor = (name) => {
    setHistoryQuery(name);
    setTab("history");
  };

  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [deleteId, setDeleteId] = useState(null);

  const loadServices = async () => {
    setLoading(true);
    try {
      // Retired services still have to be manageable from here, so the page
      // always asks for them even though the POS never sees them.
      setServices(await fetchRepairServices(true));
    } catch (error) {
      console.error("Failed to load repair services", error);
      setAlertInfo({ type: "error", message: "Failed to load the repair catalog." });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleFormClose = () => {
    setShowForm(false);
    setEditingService(null);
  };

  const handleBulkSubmit = async (entries) => {
    setSaveLoading(true);
    setAlertInfo({ type: "", message: "" });
    try {
      const result = await bulkAddRepairServices(entries);
      const parts = [];
      if (result.created) parts.push(`${result.created} added`);
      if (result.updated) parts.push(`${result.updated} re-priced`);
      setAlertInfo({ type: "success", message: parts.join(", ") + "." });
      loadServices();
      setShowBulk(false);
    } catch (error) {
      console.error("Bulk save error:", error);
      const data = error.response?.data;
      // The backend rejects the whole paste and says which rows are at fault,
      // so surface those rather than a generic failure.
      const rowErrors = (data?.rows || [])
        .map((r) => `Line ${r.row}${r.name ? ` (${r.name})` : ""}: ${r.error}`)
        .join("\n");
      setAlertInfo({
        type: "error",
        message: rowErrors
          ? `${data.error}\n${rowErrors}`
          : data?.error || "Network error. Please check your connection.",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRepairService(deleteId);
      setAlertInfo({ type: "success", message: "Service deleted." });
      loadServices();
    } catch (error) {
      setAlertInfo({ type: "error", message: "Failed to delete the service." });
    } finally {
      setDeleteId(null);
    }
  };

  const handleFormSubmit = async (formData) => {
    setSaveLoading(true);
    setAlertInfo({ type: "", message: "" });
    try {
      if (editingService) {
        await updateRepairService(editingService.id, formData);
        setAlertInfo({ type: "success", message: "Service updated." });
      } else {
        await createRepairService(formData);
        setAlertInfo({ type: "success", message: "Service added." });
      }
      loadServices();
      handleFormClose();
    } catch (error) {
      console.error("Save Error:", error);
      const data = error.response?.data;
      setAlertInfo({
        type: "error",
        message: data
          ? `Failed to save:\n${Object.values(data).flat().join("\n")}`
          : "Network error. Please check your connection.",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(term)
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Service?"
        message="This removes the standard price only — past bills that used it are untouched."
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
      />

      {alertInfo.message && (
        <AlertComponent
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 md:w-8 md:h-8" /> Repair Services
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Standard repairs and what they cost. These are suggested first at the POS.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setShowBulk((v) => !v);
              handleFormClose();
            }}
            className={`px-6 py-2.5 rounded-lg font-bold shadow transition flex items-center justify-center gap-2 ${
              showBulk
                ? "bg-gray-500 hover:bg-gray-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {showBulk ? <XCircle size={20} /> : <ListPlus size={20} />}
            {showBulk ? "Close" : "Bulk Add"}
          </button>
          <button
            onClick={() => {
              if (showForm) handleFormClose();
              else {
                setShowForm(true);
                setShowBulk(false);
              }
            }}
            className={`px-6 py-2.5 rounded-lg font-bold shadow transition flex items-center justify-center gap-2 text-white ${
              showForm ? "bg-gray-500 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {showForm ? <XCircle size={20} /> : <Plus size={20} />}
            {showForm ? "Close Form" : "Add Service"}
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="mb-8 animate-fade-in-down">
          <BulkAddPanel
            onSubmit={handleBulkSubmit}
            onCancel={() => setShowBulk(false)}
            isSaving={saveLoading}
          />
        </div>
      )}

      {showForm && (
        <div className="mb-8 animate-fade-in-down">
          <ServiceForm
            initial={editingService}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            isSaving={saveLoading}
          />
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {[
          { key: "services", label: "Saved Services", icon: Wrench },
          { key: "history", label: "Past Charges", icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors flex items-center gap-1.5 ${
              tab === key
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <PastChargesPanel query={historyQuery} onQueryChange={setHistoryQuery} />
      ) : (
      <>
      <div className="relative mb-6 w-full md:max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search services..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-2"></div>
          <p>Loading Services...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredServices.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded-lg shadow border border-gray-100">
              <Wrench size={48} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 italic">
                No services yet — add one here, or save a repair as a service from the POS.
              </p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-shadow duration-300 p-5 flex flex-col ${
                  service.is_active ? "border-gray-100" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-500">
                    <Wrench size={18} />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openHistoryFor(service.name)}
                      className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                      title="Past charges for this repair"
                    >
                      <History size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
                      title="Edit"
                    >
                      Edit <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteId(service.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 leading-snug mt-4 line-clamp-2">
                  {service.name}
                </h3>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center bg-gray-900 text-white text-sm font-bold px-3 py-1 rounded-lg tabular-nums">
                    LKR{" "}
                    {Number(service.default_price).toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  {!service.is_active && (
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-lg">
                      <EyeOff size={12} className="shrink-0 text-gray-400" />
                      Not suggested
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default RepairServicesPage;
