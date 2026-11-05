import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt,
  Plus,
  Search,
  Edit2,
  Trash2,
  XCircle,
  Loader2,
  CheckCircle2,
  Ban,
  Undo2,
  Wand2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Landmark,
  CalendarClock,
  Wallet,
  FileText,
  CalendarDays,
  Repeat,
  X,
} from "lucide-react";
import {
  fetchSuppliers,
  fetchSupplierBalances,
  fetchSupplierInvoices,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  fetchSupplierCheques,
  createSupplierCheque,
  createSupplierChequesBulk,
  updateSupplierCheque,
  setSupplierChequeStatus,
  deleteSupplierCheque,
} from "../services/api";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import { apiErrorMessage } from "../components/apiErrorMessage";
import SupplierSelect from "../components/forms/SupplierSelect";

// --- helpers ---

const formatLKR = (amount) =>
  `Rs ${new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(amount) || 0)}`;

const formatDate = (value) =>
  value
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (iso, days) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + (Number(days) || 0));
  return localISO(d);
};

// Money is compared in whole cents so 0.1 + 0.2 style float noise can't block a save.
const cents = (v) => Math.round((parseFloat(v) || 0) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

// The views answer with { error } or { field: message }; show just the words.
const errorText = (err, fallback) => {
  const data = err?.response?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const parts = Object.values(data).map((v) => (Array.isArray(v) ? v.join(" ") : String(v)));
    if (parts.length) return parts.join("\n");
  }
  return apiErrorMessage(err, fallback);
};

const INVOICE_BADGE = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
  UNPAID: "bg-gray-100 text-gray-700 border-gray-200",
};

const CHEQUE_BADGE = {
  PENDING: "bg-blue-100 text-blue-700 border-blue-200",
  CLEARED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-gray-200 text-gray-500 border-gray-300 line-through",
};

const CREDIT_PRESETS = [30, 45, 60, 90];

// --- cheque series & calendar helpers ---

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return localISO(new Date(y, m - 1 + n, 1)).slice(0, 7);
};

const dayLabel = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) : "";

// Compact amount for calendar cells: 25000 -> "25k", 1250000 -> "1.3M".
const shortAmount = (c) => {
  const v = c / 100;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

const REPEAT_OPTIONS = [
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
  { id: "days", label: "Every N days" },
];

// Date of the i-th cheque in a series (i = 0 is the first cheque).
const seriesDate = (start, repeat, everyDays, i) => {
  if (!start) return "";
  const d = new Date(`${start}T00:00:00`);
  if (repeat === "monthly") {
    // Same day each month, pulled back to the last day in shorter months.
    const target = new Date(d.getFullYear(), d.getMonth() + i, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), last));
    return localISO(target);
  }
  const step = repeat === "weekly" ? 7 : repeat === "biweekly" ? 14 : Math.max(1, Number(everyDays) || 1);
  d.setDate(d.getDate() + step * i);
  return localISO(d);
};

// "000245" -> "000246", "AB-0099" -> "AB-0100": counts up the trailing digits, keeping zeros and prefix.
const nthChequeNumber = (first, i) => {
  const base = String(first || "").trim();
  if (!base) return "";
  const m = base.match(/^(.*?)(\d+)$/);
  if (!m) return i === 0 ? base : `${base}-${i + 1}`;
  return m[1] + String(Number(m[2]) + i).padStart(m[2].length, "0");
};

// Equal split in cents; the last cheque takes the rounding.
const splitEqual = (totalCents, n) => {
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCents - base * (n - 1) : base));
};

// Cheques in date order pay the invoices oldest-due first. Returns { rowKey: [{ invoice, invoice_number, cents }] }.
const fifoAllocate = (rows, queue) => {
  const left = queue.map((q) => ({ ...q }));
  const ordered = rows
    .map((r, idx) => ({ ...r, idx }))
    .sort((a, b) => (a.date === b.date ? a.idx - b.idx : (a.date || "9999") < (b.date || "9999") ? -1 : 1));
  const out = {};
  let qi = 0;
  ordered.forEach((r) => {
    let need = r.cents;
    out[r.key] = [];
    while (need > 0 && qi < left.length) {
      const take = Math.min(need, left[qi].cents);
      if (take > 0) out[r.key].push({ invoice: left[qi].id, invoice_number: left[qi].invoice_number, cents: take });
      need -= take;
      left[qi].cents -= take;
      if (left[qi].cents <= 0) qi += 1;
    }
  });
  return out;
};

// Saved (not cancelled) cheques grouped by cheque date: { "2026-11-02": { count, total, items } }.
const chequesByDay = (cheques, excludeId) => {
  const map = {};
  cheques.forEach((c) => {
    if (c.status === "CANCELLED" || c.id === excludeId) return;
    const day = String(c.cheque_date);
    if (!map[day]) map[day] = { count: 0, total: 0, items: [] };
    map[day].count += 1;
    map[day].total += cents(c.amount);
    map[day].items.push(c);
  });
  return map;
};

// Saved cheques by lower-cased number, so a number can't be written twice.
const chequesByNumber = (cheques, excludeId) => {
  const map = {};
  cheques.forEach((c) => {
    if (c.id !== excludeId) map[String(c.cheque_number).trim().toLowerCase()] = c;
  });
  return map;
};

const usedNumberText = (c) => `Already used: ${c.supplier_name}, ${formatDate(c.cheque_date)}`;

const COUNT_SHADE = ["bg-white", "bg-amber-50", "bg-amber-100", "bg-amber-200", "bg-orange-200"];

// Month grid of the days cheques are written for. Saved cheques shade the day
// (darker = more cheques), cheques being entered right now get a red outline,
// and a blue dot marks days an unpaid invoice falls due.
const ChequeCalendar = ({
  month,
  onMonthChange,
  cheques,
  drafts = [],
  invoices = [],
  excludeId,
  selectedDate,
  onPickDay,
  large = false,
}) => {
  const saved = useMemo(() => chequesByDay(cheques, excludeId), [cheques, excludeId]);
  const draftDays = useMemo(() => {
    const map = {};
    drafts.forEach((d) => {
      if (!d.date) return;
      if (!map[d.date]) map[d.date] = { count: 0, total: 0 };
      map[d.date].count += 1;
      map[d.date].total += d.cents;
    });
    return map;
  }, [drafts]);
  const dueDays = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      if (inv.payment_status === "PAID") return;
      const day = String(inv.due_date);
      map[day] = (map[day] || 0) + 1;
    });
    return map;
  }, [invoices]);

  const [y, m] = month.split("-").map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const today = localISO();
  const monthTotal = Object.entries(saved)
    .filter(([d]) => d.startsWith(month))
    .reduce((acc, [, v]) => ({ count: acc.count + v.count, total: acc.total + v.total }), { count: 0, total: 0 });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onMonthChange(shiftMonth(month, -1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Previous month">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className={`font-bold text-gray-900 ${large ? "text-lg" : "text-sm"}`}>{monthLabel(month)}</p>
          <p className="text-[11px] text-gray-500">
            {monthTotal.count} cheque{monthTotal.count === 1 ? "" : "s"} · {formatLKR(fromCents(monthTotal.total))}
          </p>
        </div>
        <button onClick={() => onMonthChange(shiftMonth(month, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />;
          const s = saved[day];
          const dr = draftDays[day];
          const count = (s?.count || 0) + (dr?.count || 0);
          const total = (s?.total || 0) + (dr?.total || 0);
          const shade = COUNT_SHADE[Math.min(count, COUNT_SHADE.length - 1)];
          const selected = day === selectedDate;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPickDay && onPickDay(day)}
              title={
                count
                  ? `${count} cheque${count === 1 ? "" : "s"} · ${formatLKR(fromCents(total))}${dr ? ` (${dr.count} being added)` : ""}`
                  : "No cheques"
              }
              className={`relative rounded-lg border text-left transition-colors hover:border-gray-500 ${shade} ${dr ? "border-2 border-red-500" : "border-gray-200"
                } ${selected ? "ring-2 ring-gray-900 ring-offset-1" : ""} ${large ? "min-h-[76px] p-1.5" : "min-h-[46px] p-1"}`}
            >
              <span className={`block text-[11px] leading-none ${day === today ? "font-black text-red-700" : "font-semibold text-gray-600"}`}>
                {Number(day.slice(8))}
              </span>
              {count > 0 && (
                <span className="block mt-1 leading-tight">
                  <span className={`block font-black text-gray-900 ${large ? "text-sm" : "text-[11px]"}`}>
                    {count}{large ? ` cheque${count === 1 ? "" : "s"}` : "×"}
                  </span>
                  <span className={`block text-gray-700 ${large ? "text-xs" : "text-[10px]"}`}>
                    {large ? formatLKR(fromCents(total)) : shortAmount(total)}
                  </span>
                </span>
              )}
              {dueDays[day] > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" title={`${dueDays[day]} invoice${dueDays[day] === 1 ? "" : "s"} due`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-gray-200" /> Cheques written</span>
        {drafts.length > 0 && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-red-500" /> Being added now</span>}
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Invoice due</span>
      </div>
    </div>
  );
};

const inputCls =
  "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none";
const labelCls = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

const MODAL_WIDTH = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-6xl" };

const ModalShell = ({ title, icon: Icon, onClose, children, footer, size = "md" }) => (
  <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${MODAL_WIDTH[size]} max-h-[92vh] flex flex-col overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-gray-50">
        <Icon className="text-red-700" size={22} />
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600" title="Close">
          <XCircle size={22} />
        </button>
      </div>
      <div className="p-5 overflow-y-auto flex-1">{children}</div>
      <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">{footer}</div>
    </div>
  </div>
);

// --- Invoice modal ---

const InvoiceModal = ({ invoice, suppliers, defaultSupplier, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(() => ({
    supplier: invoice?.supplier ?? defaultSupplier ?? "",
    invoice_number: invoice?.invoice_number ?? "",
    invoice_date: invoice?.invoice_date ?? localISO(),
    amount: invoice?.amount ?? "",
    notes: invoice?.notes ?? "",
  }));
  const [onCredit, setOnCredit] = useState(invoice ? invoice.credit_days != null : true);
  const [creditDays, setCreditDays] = useState(invoice?.credit_days ?? 30);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dueDate = onCredit ? addDays(form.invoice_date, creditDays) : form.invoice_date;
  const valid =
    form.supplier && form.invoice_number.trim() && form.invoice_date && cents(form.amount) > 0 &&
    (!onCredit || Number(creditDays) > 0);
  const hasPayments = invoice && cents(invoice.paid_amount) > 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const payload = { ...form, credit_days: onCredit ? Number(creditDays) : null };
    try {
      const saved = invoice ? await updateSupplierInvoice(invoice.id, payload) : await createSupplierInvoice(payload);
      onSaved(saved, invoice ? "Invoice updated." : "Invoice added.");
    } catch (err) {
      onError(errorText(err, "Could not save the invoice."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={invoice ? `Edit invoice ${invoice.invoice_number}` : "New supplier invoice"}
      icon={FileText}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="px-5 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Save invoice
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Supplier</label>
          <SupplierSelect
            floating
            allowNone={false}
            disabled={hasPayments}
            suppliers={suppliers}
            value={form.supplier}
            onChange={(id) => setForm((f) => ({ ...f, supplier: String(id) }))}
            placeholder="Select supplier…"
            triggerClassName={inputCls}
          />
          {hasPayments && <p className="text-xs text-gray-500 mt-1">Cheques are assigned to this invoice, so its supplier is fixed.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Invoice no.</label>
            <input className={inputCls} value={form.invoice_number} onChange={set("invoice_number")} placeholder="e.g. INV-10234" />
          </div>
          <div>
            <label className={labelCls}>Invoice date</label>
            <input type="date" className={inputCls} value={form.invoice_date} onChange={set("invoice_date")} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Amount (Rs)</label>
          <input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={set("amount")} placeholder="0.00" />
          {hasPayments && (
            <p className="text-xs text-gray-500 mt-1">Already paid {formatLKR(invoice.paid_amount)}; the amount can't go below that.</p>
          )}
        </div>

        {/* Credit period */}
        <div className="rounded-xl border-2 border-gray-200 p-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="block font-bold text-gray-800">Bought on credit?</span>
              <span className="block text-xs text-gray-500">Turn off if the invoice must be paid right away.</span>
            </span>
            <input
              type="checkbox"
              className="w-5 h-5 accent-red-700"
              checked={onCredit}
              onChange={(e) => setOnCredit(e.target.checked)}
            />
          </label>
          {onCredit && (
            <div className="mt-3 space-y-2">
              <label className={labelCls}>Credit period (days)</label>
              <div className="flex flex-wrap items-center gap-2">
                {CREDIT_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCreditDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${Number(creditDays) === d ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
                  >
                    {d}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  value={creditDays}
                  onChange={(e) => setCreditDays(e.target.value)}
                />
              </div>
            </div>
          )}
          <p className="mt-3 text-sm text-gray-700 flex items-center gap-2">
            <CalendarClock size={16} className="text-gray-400" />
            Payment due: <span className="font-bold">{formatDate(dueDate)}</span>
          </p>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea rows={2} className={inputCls} value={form.notes} onChange={set("notes")} />
        </div>
      </div>
    </ModalShell>
  );
};

// --- Cheque modal (one cheque split across the supplier's open invoices) ---

const ChequeModal = ({ cheque, suppliers, invoices, allCheques, defaultSupplier, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(() => ({
    supplier: cheque?.supplier ?? defaultSupplier ?? "",
    cheque_number: cheque?.cheque_number ?? "",
    bank: cheque?.bank ?? "",
    cheque_date: cheque?.cheque_date ?? localISO(),
    issued_date: cheque?.issued_date ?? localISO(),
    amount: cheque?.amount ?? "",
    notes: cheque?.notes ?? "",
  }));
  // invoice id -> amount string
  const [alloc, setAlloc] = useState(() => {
    const map = {};
    (cheque?.allocations || []).forEach((a) => { map[a.invoice] = a.amount; });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // What this cheque already pays on each invoice — still "available" to it when editing.
  const ownAlloc = useMemo(() => {
    const map = {};
    (cheque?.allocations || []).forEach((a) => { map[a.invoice] = cents(a.amount); });
    return map;
  }, [cheque]);

  // The supplier's invoices with something left to pay (or already on this cheque), oldest due first.
  const rows = useMemo(
    () =>
      invoices
        .filter((inv) => String(inv.supplier) === String(form.supplier))
        .map((inv) => ({ ...inv, available: cents(inv.outstanding) + (ownAlloc[inv.id] || 0) }))
        .filter((inv) => inv.available > 0)
        .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id - b.id)),
    [invoices, form.supplier, ownAlloc]
  );

  const changeSupplier = (id) => {
    if (String(id) === String(form.supplier)) return;
    setForm((f) => ({ ...f, supplier: String(id) }));
    setAlloc({});
  };

  const total = cents(form.amount);
  const allocated = rows.reduce((sum, r) => sum + cents(alloc[r.id]), 0);
  const remaining = total - allocated;
  const overRow = rows.find((r) => cents(alloc[r.id]) > r.available);

  const autoFill = () => {
    let left = total;
    const next = {};
    rows.forEach((r) => {
      const take = Math.min(left, r.available);
      if (take > 0) next[r.id] = fromCents(take);
      left -= take;
    });
    setAlloc(next);
  };

  const usedNumbers = useMemo(() => chequesByNumber(allCheques, cheque?.id), [allCheques, cheque]);
  const numberClash = usedNumbers[form.cheque_number.trim().toLowerCase()];

  const valid =
    form.supplier && form.cheque_number.trim() && !numberClash && form.cheque_date && total > 0 &&
    allocated === total && !overRow;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const payload = {
      ...form,
      allocations: rows
        .filter((r) => cents(alloc[r.id]) > 0)
        .map((r) => ({ invoice: r.id, amount: fromCents(cents(alloc[r.id])) })),
    };
    try {
      const saved = cheque ? await updateSupplierCheque(cheque.id, payload) : await createSupplierCheque(payload);
      onSaved(saved, cheque ? "Cheque updated." : "Cheque recorded.");
    } catch (err) {
      onError(errorText(err, "Could not save the cheque."));
    } finally {
      setSaving(false);
    }
  };

  const [calMonth, setCalMonth] = useState(form.cheque_date.slice(0, 7));
  useEffect(() => {
    if (form.cheque_date) setCalMonth(form.cheque_date.slice(0, 7));
  }, [form.cheque_date]);

  return (
    <ModalShell
      size="xl"
      title={cheque ? `Edit cheque ${cheque.cheque_number}` : "New cheque payment"}
      icon={Landmark}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="px-5 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Save cheque
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelCls}>Supplier</label>
          <SupplierSelect
            floating
            allowNone={false}
            suppliers={suppliers}
            value={form.supplier}
            onChange={changeSupplier}
            placeholder="Select supplier…"
            triggerClassName={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Cheque no.</label>
          <input
            className={`${inputCls} ${numberClash ? "border-red-500 bg-red-50" : ""}`}
            value={form.cheque_number}
            onChange={set("cheque_number")}
          />
          {numberClash && <p className="text-xs font-semibold text-red-600 mt-1">{usedNumberText(numberClash)}</p>}
        </div>
        <div>
          <label className={labelCls}>Bank</label>
          <input className={inputCls} value={form.bank} onChange={set("bank")} placeholder="e.g. BOC Gampaha" />
        </div>
        <div>
          <label className={labelCls}>Cheque date</label>
          <input type="date" className={inputCls} value={form.cheque_date} onChange={set("cheque_date")} />
          <p className="text-[11px] text-gray-500 mt-1">The date written on the cheque. It counts in that month's report.</p>
        </div>
        <div>
          <label className={labelCls}>Issued on</label>
          <input type="date" className={inputCls} value={form.issued_date} onChange={set("issued_date")} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Cheque amount (Rs)</label>
          <input type="number" min="0" step="0.01" className={inputCls} value={form.amount} onChange={set("amount")} placeholder="0.00" />
        </div>
      </div>

      {/* Allocation */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-gray-800">Pays which invoices?</h4>
          <button
            type="button"
            onClick={autoFill}
            disabled={!total || !rows.length}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800 disabled:opacity-40"
            title="Spread the cheque amount over the invoices, oldest due first"
          >
            <Wand2 size={15} /> Auto-fill
          </button>
        </div>

        {!form.supplier ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">Choose a supplier to see their unpaid invoices.</p>
        ) : !rows.length ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">This supplier has no unpaid invoices. Add the invoice first.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-2 text-left">Invoice</th>
                  <th className="p-2 text-left">Due</th>
                  <th className="p-2 text-right">Left to pay</th>
                  <th className="p-2 text-right w-40">From this cheque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const over = cents(alloc[r.id]) > r.available;
                  return (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-semibold text-gray-800">{r.invoice_number}</td>
                      <td className={`p-2 ${r.is_overdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>{formatDate(r.due_date)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatLKR(fromCents(r.available))}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={alloc[r.id] ?? ""}
                          onChange={(e) => setAlloc((a) => ({ ...a, [r.id]: e.target.value }))}
                          className={`w-full border rounded-lg px-2 py-1 text-right ${over ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={`mt-3 flex flex-wrap justify-between gap-2 text-sm font-semibold rounded-xl px-3 py-2 ${remaining === 0 && total > 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
          <span>Assigned {formatLKR(fromCents(allocated))} of {formatLKR(fromCents(total))}</span>
          <span>
            {overRow
              ? `${overRow.invoice_number} only has ${formatLKR(fromCents(overRow.available))} left`
              : remaining > 0
                ? `${formatLKR(fromCents(remaining))} still to assign`
                : remaining < 0
                  ? `${formatLKR(fromCents(-remaining))} more than the cheque`
                  : total > 0 ? "Fully assigned" : ""}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls}>Notes</label>
        <textarea rows={2} className={inputCls} value={form.notes} onChange={set("notes")} />
      </div>
      </div>

      <div className="lg:border-l lg:pl-6 border-gray-100">
        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-1"><CalendarDays size={16} /> Cheque calendar</h4>
        <p className="text-xs text-gray-500 mb-3">Click a day to move this cheque to it.</p>
        <ChequeCalendar
          month={calMonth}
          onMonthChange={setCalMonth}
          cheques={allCheques}
          invoices={invoices}
          excludeId={cheque?.id}
          drafts={form.cheque_date ? [{ date: form.cheque_date, cents: total }] : []}
          selectedDate={form.cheque_date}
          onPickDay={(day) => setForm((f) => ({ ...f, cheque_date: day }))}
        />
      </div>
      </div>
    </ModalShell>
  );
};

// --- New cheques modal: one or more cheques (e.g. four weekly cheques) for a supplier's invoices ---

let rowSeq = 0;
const newRow = (date = localISO(), cheque_number = "", amount = "") => ({
  key: `row-${(rowSeq += 1)}`,
  cheque_number,
  cheque_date: date,
  amount,
});

const ChequeBatchModal = ({ suppliers, invoices, allCheques, defaultSupplier, invoiceId, initialDate, onClose, onSaved, onError }) => {
  const startInvoice = invoiceId ? invoices.find((i) => i.id === invoiceId) : null;
  const [form, setForm] = useState(() => ({
    supplier: startInvoice ? String(startInvoice.supplier) : defaultSupplier ?? "",
    bank: "",
    issued_date: localISO(),
    notes: "",
  }));
  // invoice id -> amount string (how much of each invoice this batch pays)
  const [alloc, setAlloc] = useState(() => (startInvoice ? { [startInvoice.id]: startInvoice.outstanding } : {}));
  const [rows, setRows] = useState(() => [newRow(initialDate || localISO())]);
  const [activeKey, setActiveKey] = useState(() => rows[0].key);
  const [showSeries, setShowSeries] = useState(false);
  const [series, setSeries] = useState(() => ({
    count: 4,
    start: initialDate || localISO(),
    repeat: "weekly",
    everyDays: 7,
    firstNumber: "",
    total: "",
  }));
  const [calMonth, setCalMonth] = useState((initialDate || localISO()).slice(0, 7));
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setRow = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const activeRow = rows.find((r) => r.key === activeKey) || rows[0];
  const activeDate = activeRow?.cheque_date;
  useEffect(() => {
    if (activeDate) setCalMonth(activeDate.slice(0, 7));
  }, [activeDate]);

  // The supplier's invoices with something left to pay, oldest due first.
  const invoiceRows = useMemo(
    () =>
      invoices
        .filter((inv) => String(inv.supplier) === String(form.supplier) && cents(inv.outstanding) > 0)
        .map((inv) => ({ ...inv, available: cents(inv.outstanding) }))
        .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.id - b.id)),
    [invoices, form.supplier]
  );

  const changeSupplier = (id) => {
    if (String(id) === String(form.supplier)) return;
    setForm((f) => ({ ...f, supplier: String(id) }));
    setAlloc({});
  };

  const toPay = invoiceRows.reduce((sum, r) => sum + cents(alloc[r.id]), 0);
  const overRow = invoiceRows.find((r) => cents(alloc[r.id]) > r.available);
  const chequeTotal = rows.reduce((sum, r) => sum + cents(r.amount), 0);
  const diff = toPay - chequeTotal;

  // Each cheque's split over the invoices (cheques by date pay oldest-due invoices first).
  const queue = invoiceRows
    .filter((r) => cents(alloc[r.id]) > 0)
    .map((r) => ({ id: r.id, invoice_number: r.invoice_number, cents: cents(alloc[r.id]) }));
  const split = fifoAllocate(
    rows.map((r) => ({ key: r.key, date: r.cheque_date, cents: cents(r.amount) })),
    queue
  );

  const savedByDay = useMemo(() => chequesByDay(allCheques), [allCheques]);
  const numberCounts = rows.reduce((acc, r) => {
    const n = r.cheque_number.trim().toLowerCase();
    if (n) acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});

  const usedNumbers = useMemo(() => chequesByNumber(allCheques), [allCheques]);
  const rowsValid = rows.every((r) => {
    const n = r.cheque_number.trim().toLowerCase();
    return n && r.cheque_date && cents(r.amount) > 0 && numberCounts[n] === 1 && !usedNumbers[n];
  });
  const valid = form.supplier && toPay > 0 && !overRow && rowsValid && diff === 0;

  const autoFill = () => {
    // Fill invoices oldest due first up to the cheques entered, or pay them all if no amounts yet.
    let left = chequeTotal > 0 ? chequeTotal : Infinity;
    const next = {};
    invoiceRows.forEach((r) => {
      const take = Math.min(left, r.available);
      if (take > 0) next[r.id] = fromCents(take);
      left -= take;
    });
    setAlloc(next);
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    const row = newRow(
      last ? seriesDate(last.cheque_date, "weekly", 7, 1) : localISO(),
      last ? nthChequeNumber(last.cheque_number, 1) : "",
      diff > 0 ? fromCents(diff) : ""
    );
    setRows((rs) => [...rs, row]);
    setActiveKey(row.key);
  };

  const removeRow = (key) => {
    setRows((rs) => {
      const next = rs.filter((r) => r.key !== key);
      return next.length ? next : [newRow()];
    });
  };

  const seriesTotal = cents(series.total) || toPay;
  const seriesCount = Math.max(1, Math.min(52, Number(series.count) || 1));
  const makeSeries = () => {
    const amounts = splitEqual(seriesTotal, seriesCount);
    const next = amounts.map((c, i) =>
      newRow(seriesDate(series.start, series.repeat, series.everyDays, i), nthChequeNumber(series.firstNumber, i), c > 0 ? fromCents(c) : "")
    );
    setRows(next);
    setActiveKey(next[0].key);
    setShowSeries(false);
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const ordered = [...rows].sort((a, b) => (a.cheque_date < b.cheque_date ? -1 : a.cheque_date > b.cheque_date ? 1 : 0));
    const payload = {
      ...form,
      cheques: ordered.map((r) => ({
        cheque_number: r.cheque_number.trim(),
        cheque_date: r.cheque_date,
        amount: fromCents(cents(r.amount)),
        allocations: (split[r.key] || []).map((a) => ({ invoice: a.invoice, amount: fromCents(a.cents) })),
      })),
    };
    try {
      const saved = await createSupplierChequesBulk(payload);
      onSaved(saved, saved.length === 1 ? "Cheque recorded." : `${saved.length} cheques recorded.`);
    } catch (err) {
      onError(errorText(err, "Could not save the cheques."));
    } finally {
      setSaving(false);
    }
  };

  const drafts = rows.map((r) => ({ date: r.cheque_date, cents: cents(r.amount) }));

  return (
    <ModalShell
      size="xl"
      title="New cheque payment"
      icon={Landmark}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="px-5 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save {rows.length === 1 ? "cheque" : `${rows.length} cheques`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="min-w-0">
          {/* Shared details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className={labelCls}>Supplier</label>
              <SupplierSelect
            floating
            allowNone={false}
            suppliers={suppliers}
            value={form.supplier}
            onChange={changeSupplier}
            placeholder="Select supplier…"
            triggerClassName={inputCls}
          />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Bank</label>
              <input className={inputCls} value={form.bank} onChange={set("bank")} placeholder="e.g. BOC Gampaha" />
            </div>
            <div>
              <label className={labelCls}>Issued on</label>
              <input type="date" className={inputCls} value={form.issued_date} onChange={set("issued_date")} />
            </div>
          </div>

          {/* 1. Invoices */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-800">1. Which invoices are you paying?</h4>
              <button
                type="button"
                onClick={autoFill}
                disabled={!invoiceRows.length}
                className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800 disabled:opacity-40"
                title="Fill amounts oldest due first"
              >
                <Wand2 size={15} /> Auto-fill
              </button>
            </div>
            {!form.supplier ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">Choose a supplier to see their unpaid invoices.</p>
            ) : !invoiceRows.length ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">This supplier has no unpaid invoices. Add the invoice first.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="p-2 text-left">Invoice</th>
                      <th className="p-2 text-left">Due</th>
                      <th className="p-2 text-right">Left to pay</th>
                      <th className="p-2 text-right w-40">Paying now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceRows.map((r) => {
                      const over = cents(alloc[r.id]) > r.available;
                      return (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="p-2 font-semibold text-gray-800">{r.invoice_number}</td>
                          <td className={`p-2 ${r.is_overdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>{formatDate(r.due_date)}</td>
                          <td className="p-2 text-right whitespace-nowrap">{formatLKR(fromCents(r.available))}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={alloc[r.id] ?? ""}
                                onChange={(e) => setAlloc((a) => ({ ...a, [r.id]: e.target.value }))}
                                className={`w-full border rounded-lg px-2 py-1 text-right ${over ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                                placeholder="0.00"
                              />
                              <button
                                type="button"
                                onClick={() => setAlloc((a) => ({ ...a, [r.id]: fromCents(r.available) }))}
                                className="text-[10px] font-bold uppercase text-gray-500 hover:text-red-700"
                                title="Pay all of it"
                              >
                                All
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {overRow && (
              <p className="mt-2 text-sm font-semibold text-red-600">
                {overRow.invoice_number} only has {formatLKR(fromCents(overRow.available))} left to pay.
              </p>
            )}
          </div>

          {/* 2. Cheques */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="font-bold text-gray-800">2. Cheques</h4>
              <button
                type="button"
                onClick={() => {
                  setSeries((sr) => ({ ...sr, start: activeDate || sr.start }));
                  setShowSeries((v) => !v);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${showSeries ? "bg-red-700 text-white border-red-700" : "text-red-700 border-red-200 hover:bg-red-50"}`}
              >
                <Repeat size={15} /> Make a series
              </button>
            </div>

            {showSeries && (
              <div className="mb-3 rounded-xl border-2 border-red-100 bg-red-50/40 p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>No. of cheques</label>
                    <input type="number" min="1" max="52" className={inputCls} value={series.count}
                      onChange={(e) => setSeries((sr) => ({ ...sr, count: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>First cheque date</label>
                    <input type="date" className={inputCls} value={series.start}
                      onChange={(e) => setSeries((sr) => ({ ...sr, start: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Repeat</label>
                    <select className={inputCls} value={series.repeat}
                      onChange={(e) => setSeries((sr) => ({ ...sr, repeat: e.target.value }))}>
                      {REPEAT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  {series.repeat === "days" && (
                    <div>
                      <label className={labelCls}>Every (days)</label>
                      <input type="number" min="1" className={inputCls} value={series.everyDays}
                        onChange={(e) => setSeries((sr) => ({ ...sr, everyDays: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>First cheque no.</label>
                    <input className={inputCls} value={series.firstNumber} placeholder="e.g. 000245"
                      onChange={(e) => setSeries((sr) => ({ ...sr, firstNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Total of series</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={series.total}
                      placeholder={toPay ? fromCents(toPay) : "0.00"}
                      onChange={(e) => setSeries((sr) => ({ ...sr, total: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {(() => {
                    const hits = Array.from({ length: seriesCount }, (_, i) => nthChequeNumber(series.firstNumber, i))
                      .filter((n) => n && usedNumbers[n.toLowerCase()]);
                    return hits.length > 0 ? (
                      <p className="w-full text-xs font-semibold text-red-600">
                        Already used: {hits.join(", ")}. Start from a different number.
                      </p>
                    ) : null;
                  })()}
                  <p className="text-xs text-gray-600">
                    {seriesCount} cheque{seriesCount === 1 ? "" : "s"} of about {formatLKR(fromCents(Math.floor(seriesTotal / seriesCount)))}
                    {series.start && `, ${dayLabel(series.start)} → ${dayLabel(seriesDate(series.start, series.repeat, series.everyDays, seriesCount - 1))}`}
                  </p>
                  <button
                    type="button"
                    onClick={makeSeries}
                    disabled={!series.start || seriesTotal <= 0}
                    className="px-4 py-1.5 rounded-lg bg-red-700 text-white text-sm font-bold hover:bg-red-800 disabled:opacity-50"
                  >
                    Fill cheques
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {rows.map((r, i) => {
                const daySaved = savedByDay[r.cheque_date];
                const sameDayDrafts = rows.filter((o) => o.key !== r.key && o.cheque_date && o.cheque_date === r.cheque_date);
                const others = (daySaved?.count || 0) + sameDayDrafts.length;
                const othersTotal = (daySaved?.total || 0) + sameDayDrafts.reduce((n, o) => n + cents(o.amount), 0);
                const numKey = r.cheque_number.trim().toLowerCase();
                const dupNumber = numKey && numberCounts[numKey] > 1;
                const usedBefore = numKey ? usedNumbers[numKey] : null;
                const active = r.key === activeRow?.key;
                return (
                  <div
                    key={r.key}
                    onFocusCapture={() => setActiveKey(r.key)}
                    onClick={() => setActiveKey(r.key)}
                    className={`rounded-xl border p-2 ${active ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                      <input
                        className={`flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm ${dupNumber || usedBefore ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                        placeholder="Cheque no."
                        value={r.cheque_number}
                        onChange={(e) => setRow(r.key, "cheque_number", e.target.value)}
                      />
                      <input
                        type="date"
                        className="w-[150px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        value={r.cheque_date}
                        onChange={(e) => setRow(r.key, "cheque_date", e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-[130px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right"
                        placeholder="Amount"
                        value={r.amount}
                        onChange={(e) => setRow(r.key, "amount", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeRow(r.key); }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Remove cheque"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="pl-8 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                      {r.cheque_date && <span className="text-gray-500">{dayLabel(r.cheque_date)}</span>}
                      {(split[r.key] || []).map((a) => (
                        <span key={a.invoice} className="text-gray-600">
                          {a.invoice_number}: <span className="font-semibold">{formatLKR(fromCents(a.cents))}</span>
                        </span>
                      ))}
                      {dupNumber && <span className="text-red-600 font-semibold">Same number as another cheque here</span>}
                      {usedBefore && <span className="text-red-600 font-semibold">{usedNumberText(usedBefore)}</span>}
                      {others > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 font-semibold">
                          <AlertTriangle size={11} />
                          {others} other cheque{others === 1 ? "" : "s"} this day · {formatLKR(fromCents(othersTotal))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-red-700"
            >
              <Plus size={15} /> Add cheque
            </button>

            <div className={`mt-3 flex flex-wrap justify-between gap-2 text-sm font-semibold rounded-xl px-3 py-2 ${diff === 0 && toPay > 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
              <span>
                {rows.length} cheque{rows.length === 1 ? "" : "s"}: {formatLKR(fromCents(chequeTotal))} of {formatLKR(fromCents(toPay))} being paid
              </span>
              <span>
                {toPay === 0
                  ? "Enter how much of each invoice you're paying"
                  : diff > 0
                    ? `${formatLKR(fromCents(diff))} still to cover`
                    : diff < 0
                      ? `Cheques are ${formatLKR(fromCents(-diff))} more than the invoices`
                      : "Matches"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={inputCls} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        {/* Calendar */}
        <div className="lg:border-l lg:pl-6 border-gray-100">
          <div className="lg:sticky lg:top-0">
            <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-1"><CalendarDays size={16} /> Cheque calendar</h4>
            <p className="text-xs text-gray-500 mb-3">
              All suppliers' cheques. Click a day to set the date of cheque {rows.findIndex((r) => r.key === activeRow?.key) + 1}.
            </p>
            <ChequeCalendar
              month={calMonth}
              onMonthChange={setCalMonth}
              cheques={allCheques}
              invoices={invoices}
              drafts={drafts}
              selectedDate={activeDate}
              onPickDay={(day) => activeRow && setRow(activeRow.key, "cheque_date", day)}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

// --- Page ---

const Tile = ({ label, value, sub, tone, icon: Icon }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80">
      <Icon size={14} /> {label}
    </div>
    <p className="text-xl md:text-2xl font-black mt-1">{value}</p>
    {sub && <p className="text-xs mt-1 opacity-80">{sub}</p>}
  </div>
);

const TABS = [
  { id: "owed", label: "Owed by supplier" },
  { id: "invoices", label: "Invoices" },
  { id: "cheques", label: "Cheques" },
  { id: "calendar", label: "Calendar" },
];

const SupplierPaymentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "owed";
  const supplierFilter = searchParams.get("supplier") || "";

  const [suppliers, setSuppliers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("open");
  const [chequeStatus, setChequeStatus] = useState("");
  const [expanded, setExpanded] = useState({});
  const [invoiceModal, setInvoiceModal] = useState(null); // { invoice } | null
  const [chequeModal, setChequeModal] = useState(null); // { cheque } to edit, or { invoiceId, supplier, date } for new
  const [calMonth, setCalMonth] = useState(() => localISO().slice(0, 7));
  const [calDay, setCalDay] = useState(() => localISO());
  const [confirm, setConfirm] = useState(null); // { title, message, action, label }

  const setParam = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  const showError = useCallback((message) => setAlertInfo({ type: "error", message }), []);
  const closeAlert = useCallback(() => setAlertInfo({ type: "", message: "" }), []);

  const load = useCallback(async () => {
    try {
      const [s, b, i, c] = await Promise.all([
        fetchSuppliers(),
        fetchSupplierBalances(),
        fetchSupplierInvoices(),
        fetchSupplierCheques(),
      ]);
      setSuppliers([...s].sort((a, z) => a.name.localeCompare(z.name)));
      setBalances(b);
      setInvoices(i);
      setCheques(c);
    } catch (err) {
      showError(errorText(err, "Could not load supplier payments."));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const afterSave = (message) => {
    setInvoiceModal(null);
    setChequeModal(null);
    setAlertInfo({ type: "success", message });
    load();
  };

  const runConfirmed = async () => {
    const { action, success } = confirm;
    setConfirm(null);
    try {
      await action();
      setAlertInfo({ type: "success", message: success });
      load();
    } catch (err) {
      showError(errorText(err, "That didn't work."));
    }
  };

  // --- summaries ---
  const thisMonth = localISO().slice(0, 7);
  const totals = useMemo(() => {
    const sum = (list, key) => list.reduce((n, r) => n + cents(r[key]), 0);
    const live = cheques.filter((c) => c.status !== "CANCELLED");
    const dueThisMonth = live.filter((c) => c.cheque_date.slice(0, 7) === thisMonth);
    const pending = cheques.filter((c) => c.status === "PENDING");
    return {
      owed: sum(balances, "outstanding"),
      overdue: sum(balances, "overdue_amount"),
      overdueSuppliers: balances.filter((b) => cents(b.overdue_amount) > 0).length,
      dueThisMonth: sum(dueThisMonth, "amount"),
      dueThisMonthCount: dueThisMonth.length,
      pending: sum(pending, "amount"),
      pendingCount: pending.length,
    };
  }, [balances, cheques, thisMonth]);

  const term = search.trim().toLowerCase();
  const bySupplier = (row) => !supplierFilter || String(row.supplier) === supplierFilter;

  const visibleBalances = balances
    .filter((b) => b.invoice_count > 0 || cents(b.pending_cheques_amount) > 0)
    .filter((b) => !term || b.supplier_name.toLowerCase().includes(term))
    .sort((a, b) => cents(b.outstanding) - cents(a.outstanding));

  const visibleInvoices = invoices
    .filter(bySupplier)
    .filter((inv) => {
      if (invoiceStatus === "open") return inv.payment_status !== "PAID";
      if (invoiceStatus === "overdue") return inv.is_overdue;
      if (invoiceStatus) return inv.payment_status === invoiceStatus;
      return true;
    })
    .filter((inv) => !term || inv.invoice_number.toLowerCase().includes(term) || inv.supplier_name.toLowerCase().includes(term))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));

  const visibleCheques = cheques
    .filter(bySupplier)
    .filter((c) => !chequeStatus || c.status === chequeStatus)
    .filter((c) => !term || c.cheque_number.toLowerCase().includes(term) || c.supplier_name.toLowerCase().includes(term));

  const filterSupplierName = supplierFilter && suppliers.find((s) => String(s.id) === supplierFilter)?.name;

  const chequeAction = (c, status, label) =>
    setConfirm({
      title: `${label} cheque ${c.cheque_number}?`,
      message:
        status === "CANCELLED"
          ? "The invoices it paid will show as unpaid again, and it drops out of the monthly report. Use this for bounced or voided cheques."
          : status === "CLEARED"
            ? "Mark this cheque as cleared by the bank."
            : "Set this cheque back to pending.",
      label,
      tone: status === "CANCELLED" ? "danger" : "info",
      action: () => setSupplierChequeStatus(c.id, status),
      success: `Cheque ${c.cheque_number} updated.`,
    });

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      <AlertComponent type={alertInfo.type} message={alertInfo.message} onClose={closeAlert} />
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        tone={confirm?.tone}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      {invoiceModal && (
        <InvoiceModal
          invoice={invoiceModal.invoice}
          suppliers={suppliers}
          defaultSupplier={supplierFilter}
          onClose={() => setInvoiceModal(null)}
          onSaved={(_, msg) => afterSave(msg)}
          onError={showError}
        />
      )}
      {chequeModal?.cheque && (
        <ChequeModal
          cheque={chequeModal.cheque}
          suppliers={suppliers}
          invoices={invoices}
          allCheques={cheques}
          onClose={() => setChequeModal(null)}
          onSaved={(_, msg) => afterSave(msg)}
          onError={showError}
        />
      )}
      {chequeModal && !chequeModal.cheque && (
        <ChequeBatchModal
          suppliers={suppliers}
          invoices={invoices}
          allCheques={cheques}
          defaultSupplier={chequeModal.supplier ?? supplierFilter}
          invoiceId={chequeModal.invoiceId}
          initialDate={chequeModal.date}
          onClose={() => setChequeModal(null)}
          onSaved={(_, msg) => afterSave(msg)}
          onError={showError}
        />
      )}

      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-red-900 flex items-center gap-2">
              <Receipt /> Supplier Payments
            </h1>
            <p className="text-gray-500 text-sm">Invoices bought on credit, cheques given, and what we still owe.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setInvoiceModal({ invoice: null })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-red-700 text-red-700 font-bold hover:bg-red-50"
            >
              <Plus size={18} /> Invoice
            </button>
            <button
              onClick={() => setChequeModal({})}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 shadow"
            >
              <Plus size={18} /> Cheque
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Tile icon={Wallet} label="Total owed" value={formatLKR(fromCents(totals.owed))} tone="bg-white border-gray-200 text-gray-900" />
          <Tile
            icon={AlertTriangle}
            label="Overdue"
            value={formatLKR(fromCents(totals.overdue))}
            sub={totals.overdueSuppliers ? `${totals.overdueSuppliers} supplier${totals.overdueSuppliers === 1 ? "" : "s"}` : "Nothing overdue"}
            tone={totals.overdue > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-gray-200 text-gray-900"}
          />
          <Tile
            icon={CalendarClock}
            label="Cheques due this month"
            value={formatLKR(fromCents(totals.dueThisMonth))}
            sub={`${totals.dueThisMonthCount} cheque${totals.dueThisMonthCount === 1 ? "" : "s"}`}
            tone="bg-amber-50 border-amber-200 text-amber-900"
          />
          <Tile
            icon={Landmark}
            label="Pending cheques"
            value={formatLKR(fromCents(totals.pending))}
            sub={`${totals.pendingCount} not yet cleared`}
            tone="bg-blue-50 border-blue-200 text-blue-900"
          />
        </div>

        {/* Tabs & filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setParam({ tab: t.id === "owed" ? "" : t.id })}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === t.id ? "bg-red-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 lg:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm"
            />
          </div>
          {tab !== "owed" && (
            <SupplierSelect
              floating
              className="w-full lg:w-64"
              suppliers={suppliers}
              value={supplierFilter}
              onChange={(id) => setParam({ supplier: id ? String(id) : "" })}
              placeholder="All suppliers"
              noneLabel="All suppliers"
              triggerClassName="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
            />
          )}
          {tab === "invoices" && (
            <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white">
              <option value="open">Unpaid & part paid</option>
              <option value="overdue">Overdue</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Part paid</option>
              <option value="PAID">Paid</option>
              <option value="">All</option>
            </select>
          )}
          {tab === "cheques" && (
            <select value={chequeStatus} onChange={(e) => setChequeStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CLEARED">Cleared</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}
        </div>

        {filterSupplierName && tab !== "owed" && (
          <p className="mb-3 text-sm text-gray-600">
            Showing <span className="font-bold">{filterSupplierName}</span> only ·{" "}
            <button className="text-red-700 font-semibold underline" onClick={() => setParam({ supplier: "" })}>show all</button>
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="animate-spin" size={32} /></div>
        ) : tab === "owed" ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-right">Invoiced</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Owed</th>
                  <th className="p-3 text-right">Overdue</th>
                  <th className="p-3 text-left">Next due</th>
                  <th className="p-3 text-right">Pending cheques</th>
                </tr>
              </thead>
              <tbody>
                {visibleBalances.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-gray-400">No supplier invoices yet.</td></tr>
                )}
                {visibleBalances.map((b) => (
                  <tr
                    key={b.supplier}
                    onClick={() => setParam({ tab: "invoices", supplier: String(b.supplier) })}
                    className="border-t border-gray-100 hover:bg-red-50/40 cursor-pointer"
                    title="Show this supplier's invoices"
                  >
                    <td className="p-3 font-semibold text-gray-900">
                      {b.supplier_name}
                      <span className="block text-xs font-normal text-gray-500">{b.open_invoices} open invoice{b.open_invoices === 1 ? "" : "s"}</span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">{formatLKR(b.total_invoiced)}</td>
                    <td className="p-3 text-right whitespace-nowrap text-gray-600">{formatLKR(b.total_paid)}</td>
                    <td className="p-3 text-right whitespace-nowrap font-black text-gray-900">{formatLKR(b.outstanding)}</td>
                    <td className={`p-3 text-right whitespace-nowrap ${cents(b.overdue_amount) > 0 ? "text-red-600 font-bold" : "text-gray-400"}`}>
                      {cents(b.overdue_amount) > 0 ? formatLKR(b.overdue_amount) : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">{b.next_due_date ? formatDate(b.next_due_date) : "—"}</td>
                    <td className="p-3 text-right whitespace-nowrap text-blue-700">
                      {cents(b.pending_cheques_amount) > 0 ? formatLKR(b.pending_cheques_amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "calendar" ? (
          (() => {
            const calCheques = cheques.filter(bySupplier);
            const calInvoices = invoices.filter(bySupplier);
            const dayCheques = calCheques.filter((c) => String(c.cheque_date) === calDay);
            const dayLive = dayCheques.filter((c) => c.status !== "CANCELLED");
            const dayDue = calInvoices.filter((inv) => String(inv.due_date) === calDay && inv.payment_status !== "PAID");
            return (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <ChequeCalendar
                    large
                    month={calMonth}
                    onMonthChange={setCalMonth}
                    cheques={calCheques}
                    invoices={calInvoices}
                    selectedDate={calDay}
                    onPickDay={setCalDay}
                  />
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-4 h-fit">
                  <h3 className="font-bold text-gray-900 text-lg">{formatDate(calDay)}</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    {dayLive.length
                      ? `${dayLive.length} cheque${dayLive.length === 1 ? "" : "s"} · ${formatLKR(fromCents(dayLive.reduce((n, c) => n + cents(c.amount), 0)))}`
                      : "No cheques on this day"}
                  </p>
                  <div className="space-y-2">
                    {dayCheques.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => c.status !== "CANCELLED" && setChequeModal({ cheque: c })}
                        className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 text-sm ${c.status === "CANCELLED" ? "opacity-60" : ""}`}
                        title={c.status === "CANCELLED" ? "Cancelled" : "Edit cheque"}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-gray-800 truncate">{c.supplier_name}</span>
                          <span className="block text-[11px] text-gray-500 truncate">
                            #{c.cheque_number}{c.allocations.length > 0 && ` · ${c.allocations.map((a) => a.invoice_number).join(", ")}`}
                          </span>
                        </span>
                        <span className="text-right whitespace-nowrap">
                          <span className="block font-bold text-gray-900">{formatLKR(c.amount)}</span>
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${CHEQUE_BADGE[c.status]}`}>
                            {c.status.toLowerCase()}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {dayDue.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">Invoices due</p>
                      {dayDue.map((inv) => (
                        <div key={inv.id} className="flex justify-between gap-2 text-sm px-3 py-1.5 rounded-lg bg-blue-50 mb-1">
                          <span className="truncate">{inv.invoice_number} · {inv.supplier_name}</span>
                          <span className="font-semibold whitespace-nowrap">{formatLKR(inv.outstanding)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setChequeModal({ date: calDay })}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800"
                  >
                    <Plus size={16} /> Add cheque on this day
                  </button>
                </div>
              </div>
            );
          })()
        ) : tab === "invoices" ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-3 w-8" />
                  <th className="p-3 text-left">Invoice</th>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Due</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Owed</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length === 0 && (
                  <tr><td colSpan={9} className="p-10 text-center text-gray-400">No invoices match.</td></tr>
                )}
                {visibleInvoices.map((inv) => {
                  const open = expanded[inv.id];
                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          {inv.payments.length > 0 && (
                            <button onClick={() => setExpanded((e) => ({ ...e, [inv.id]: !open }))} className="text-gray-400 hover:text-gray-700" title="Show cheques">
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{inv.invoice_number}</td>
                        <td className="p-3 text-gray-700">{inv.supplier_name}</td>
                        <td className="p-3 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                        <td className={`p-3 whitespace-nowrap ${inv.is_overdue ? "text-red-600 font-bold" : ""}`}>
                          {formatDate(inv.due_date)}
                          <span className="block text-[11px] font-normal text-gray-500">
                            {inv.credit_days ? `${inv.credit_days}-day credit` : "No credit"}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{formatLKR(inv.amount)}</td>
                        <td className="p-3 text-right whitespace-nowrap font-bold">{cents(inv.outstanding) > 0 ? formatLKR(inv.outstanding) : "—"}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${INVOICE_BADGE[inv.payment_status]}`}>
                              {inv.payment_status === "PARTIAL" ? "Part paid" : inv.payment_status.toLowerCase()}
                            </span>
                            {inv.is_overdue && (
                              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase bg-red-100 text-red-700 border-red-200">Overdue</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            {inv.payment_status !== "PAID" && (
                              <button
                                onClick={() => setChequeModal({ supplier: String(inv.supplier), invoiceId: inv.id })}
                                className="px-2 py-1 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50 whitespace-nowrap"
                                title="Pay with a cheque"
                              >
                                Pay
                              </button>
                            )}
                            <button onClick={() => setInvoiceModal({ invoice: inv })} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit">
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() =>
                                setConfirm({
                                  title: `Delete invoice ${inv.invoice_number}?`,
                                  message: "This removes the invoice permanently.",
                                  label: "Delete",
                                  action: () => deleteSupplierInvoice(inv.id),
                                  success: "Invoice deleted.",
                                })
                              }
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/60">
                          <td />
                          <td colSpan={8} className="px-3 pb-3">
                            <div className="flex flex-wrap gap-2">
                              {inv.payments.map((p) => (
                                <span key={p.cheque} className={`px-3 py-1.5 rounded-lg border text-xs ${CHEQUE_BADGE[p.cheque_status]}`}>
                                  Cheque {p.cheque_number} · {formatDate(p.cheque_date)} · <span className="font-bold">{formatLKR(p.amount)}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-3 text-left">Cheque date</th>
                  <th className="p-3 text-left">Cheque</th>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-left">Pays invoices</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {visibleCheques.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-gray-400">No cheques match.</td></tr>
                )}
                {visibleCheques.map((c) => (
                  <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50 ${c.status === "CANCELLED" ? "opacity-60" : ""}`}>
                    <td className="p-3 whitespace-nowrap font-semibold">
                      {formatDate(c.cheque_date)}
                      <span className="block text-[11px] font-normal text-gray-500">Issued {formatDate(c.issued_date)}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-gray-900">{c.cheque_number}</span>
                      {c.bank && <span className="block text-xs text-gray-500">{c.bank}</span>}
                    </td>
                    <td className="p-3 text-gray-700">{c.supplier_name}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {c.allocations.map((a) => (
                          <span key={a.id} className="px-2 py-0.5 rounded-md bg-gray-100 text-xs text-gray-700 whitespace-nowrap">
                            {a.invoice_number}: {formatLKR(a.amount)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap font-bold">{formatLKR(c.amount)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${CHEQUE_BADGE[c.status]}`}>
                        {c.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {c.status === "PENDING" && (
                          <button onClick={() => chequeAction(c, "CLEARED", "Mark cleared")} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Mark cleared">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {c.status !== "CANCELLED" ? (
                          <>
                            <button onClick={() => setChequeModal({ cheque: c })} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => chequeAction(c, "CANCELLED", "Cancel")} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="Cancel / bounced">
                              <Ban size={15} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => chequeAction(c, "PENDING", "Restore")} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Restore to pending">
                            <Undo2 size={15} />
                          </button>
                        )}
                        {c.status === "CLEARED" && (
                          <button onClick={() => chequeAction(c, "PENDING", "Set pending")} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Back to pending">
                            <Undo2 size={15} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setConfirm({
                              title: `Delete cheque ${c.cheque_number}?`,
                              message: "This removes the cheque and un-pays the invoices it was assigned to.",
                              label: "Delete",
                              action: () => deleteSupplierCheque(c.id),
                              success: "Cheque deleted.",
                            })
                          }
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierPaymentsPage;
