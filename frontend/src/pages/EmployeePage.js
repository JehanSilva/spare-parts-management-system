import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  fetchAttendanceSheet,
  markAttendanceSheet,
  fetchAttendanceMonth,
  fetchPayroll,
  generatePayrollDrafts,
  updatePayroll,
  payPayroll,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from "../services/api";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  Printer,
  Check,
  Phone,
  Mail,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
  PartyPopper,
  Moon,
  CheckCheck,
  X,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";

// ─── Constants ────────────────────────────────────────────────────────────────
// Attendance statuses. "worked" mirrors inventory/payroll.py.
const STATUSES = [
  { value: "PRESENT", label: "Present", short: "P", worked: 1, on: "bg-green-600 text-white border-green-600", cell: "bg-green-100 text-green-800" },
  { value: "HALF_DAY", label: "Half day", short: "H", worked: 0.5, on: "bg-amber-500 text-white border-amber-500", cell: "bg-amber-100 text-amber-800" },
  { value: "SHORT_LEAVE", label: "Short leave", short: "S", worked: 0.75, on: "bg-sky-500 text-white border-sky-500", cell: "bg-sky-100 text-sky-800" },
  { value: "ABSENT", label: "Absent", short: "A", worked: 0, on: "bg-red-600 text-white border-red-600", cell: "bg-red-100 text-red-800" },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

const REASONS = [
  ["SICK", "Sick"],
  ["MEDICAL", "Medical appt."],
  ["PERSONAL", "Personal"],
  ["FAMILY", "Family matter"],
  ["FUNERAL", "Funeral"],
  ["WEDDING", "Wedding"],
  ["RELIGIOUS", "Religious"],
  ["TRANSPORT", "Transport"],
  ["WEATHER", "Bad weather"],
  ["ANNUAL", "Annual leave"],
  ["CASUAL", "Casual leave"],
  ["NO_REASON", "No reason"],
  ["OTHER", "Other"],
];
const REASON_LABEL = Object.fromEntries(REASONS);

const HOLIDAY_TYPES = [
  ["POYA", "Poya Day"],
  ["PUBLIC", "Public Holiday"],
  ["MERCANTILE", "Mercantile Holiday"],
  ["SHOP_CLOSED", "Shop Closed"],
  ["OTHER", "Other"],
];
const HOLIDAY_LABEL = Object.fromEntries(HOLIDAY_TYPES);

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toLocalISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shiftDate = (iso, days) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};
const num = (v) => parseFloat(v || 0) || 0;
const formatLKR = (v) =>
  `LKR ${num(v).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDays = (v) => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
};
const shiftMonth = ({ month, year }, delta) => {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
};
const apiError = (err, fallback) => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return fallback;
  if (data.error) return data.error;
  return Object.values(data).flat().join(" ") || fallback;
};

// The fields a mark carries to the server.
const markPayload = (att) => ({
  status: att.status,
  leave_reason: att.leave_reason || "",
  informed: att.informed ?? null,
  is_paid: !!att.is_paid,
  notes: att.notes || "",
});

const MonthNav = ({ value, onChange }) => (
  <div className="flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
    <button onClick={() => onChange(shiftMonth(value, -1))} className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-r border-gray-200" title="Previous month">
      <ChevronLeft size={18} />
    </button>
    <span className="px-4 py-2.5 font-bold text-gray-800 min-w-[150px] text-center">
      {MONTHS[value.month - 1]} {value.year}
    </span>
    <button onClick={() => onChange(shiftMonth(value, 1))} className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-l border-gray-200" title="Next month">
      <ChevronRight size={18} />
    </button>
  </div>
);

const YesNo = ({ label, value, onChange, yesTone = "bg-green-600 border-green-600", noTone = "bg-red-600 border-red-600" }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-gray-500 w-16">{label}</span>
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 text-xs font-bold border-r border-gray-200 ${value === true ? `${yesTone} text-white` : "bg-white text-gray-600 hover:bg-gray-50"}`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 text-xs font-bold ${value === false ? `${noTone} text-white` : "bg-white text-gray-600 hover:bg-gray-50"}`}
      >
        No
      </button>
    </div>
  </div>
);

// ─── Attendance editor (used by the daily sheet and the calendar) ─────────────
// Status buttons, plus reason / informed / paid / note for anything but
// Present. Every change is handed to onSave straight away. hideStatus drops
// the status buttons for places that already show them (the daily sheet row).
const AttendanceEditor = ({ attendance, onSave, onClear, disabled, hideStatus = false }) => {
  const [note, setNote] = useState(attendance?.notes || "");
  useEffect(() => setNote(attendance?.notes || ""), [attendance?.notes]);

  const current = attendance?.status;
  const isLeave = current && current !== "PRESENT";

  const pickStatus = (status) => {
    if (status === current) return;
    if (status === "PRESENT") {
      onSave({ status: "PRESENT", leave_reason: "", informed: null, is_paid: false, notes: attendance?.notes || "" });
    } else {
      // Keep leave details when switching between leave types.
      onSave({
        status,
        leave_reason: isLeave ? attendance.leave_reason : "",
        informed: isLeave ? attendance.informed : null,
        is_paid: isLeave ? attendance.is_paid : false,
        notes: attendance?.notes || "",
      });
    }
  };
  const patch = (fields) => onSave({ ...markPayload(attendance), ...fields });

  return (
    <div className="space-y-3">
      {!hideStatus && (
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={disabled}
            onClick={() => pickStatus(s.value)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-colors disabled:opacity-50 ${current === s.value ? s.on : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
          >
            {s.label}
          </button>
        ))}
        {attendance && onClear && (
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            title="Remove this mark"
          >
            Clear
          </button>
        )}
      </div>
      )}

      {isLeave && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Reason</p>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ leave_reason: attendance.leave_reason === value ? "" : value })}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${attendance.leave_reason === value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <YesNo label="Informed?" value={attendance.informed} onChange={(v) => patch({ informed: v })} />
            <YesNo label="Paid?" value={attendance.is_paid} onChange={(v) => patch({ is_paid: v })} />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (attendance.notes || "") && patch({ notes: note })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="Note (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 bg-white"
          />
          {hideStatus && onClear && (
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="text-xs font-semibold text-gray-400 hover:text-gray-700"
            >
              Clear this mark (back to not marked)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Short summary of a leave mark, e.g. "Sick · informed · unpaid".
const leaveSummary = (att) => {
  if (!att || att.status === "PRESENT") return "";
  const bits = [att.leave_reason ? REASON_LABEL[att.leave_reason] : "No reason set"];
  if (att.informed === true) bits.push("informed");
  if (att.informed === false) bits.push("not informed");
  bits.push(att.is_paid ? "paid" : "unpaid");
  return bits.join(" · ");
};

// ─── Tab 1: Daily attendance ──────────────────────────────────────────────────
const DailyAttendanceTab = ({ notify }) => {
  const today = toLocalISO(new Date());
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // employee id -> "saving" | "saved"
  const [expanded, setExpanded] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      setSheet(await fetchAttendanceSheet(d));
    } catch (err) {
      notify("error", apiError(err, "Could not load attendance."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    setExpanded(null);
    load(date);
  }, [date, load]);

  const setRowAttendance = (employeeId, attendance) =>
    setSheet((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.employee === employeeId ? { ...r, attendance } : r)),
    }));

  const flash = (id, state) => {
    setBusy((b) => ({ ...b, [id]: state }));
    if (state === "saved") setTimeout(() => setBusy((b) => (b[id] === "saved" ? { ...b, [id]: undefined } : b)), 1500);
  };

  const save = async (row, mark) => {
    const before = row.attendance;
    setRowAttendance(row.employee, { ...(before || {}), ...mark });
    flash(row.employee, "saving");
    try {
      const res = await markAttendanceSheet({ date, attendances: [{ employee: row.employee, ...mark }] });
      setRowAttendance(row.employee, res.saved[0]);
      flash(row.employee, "saved");
      if (mark.status !== "PRESENT" && (!before || before.status === "PRESENT")) setExpanded(row.employee);
    } catch (err) {
      setRowAttendance(row.employee, before);
      flash(row.employee, undefined);
      notify("error", apiError(err, "Could not save attendance."));
    }
  };

  const clear = async (row) => {
    const before = row.attendance;
    setRowAttendance(row.employee, null);
    try {
      await markAttendanceSheet({ date, attendances: [{ employee: row.employee, clear: true }] });
      setExpanded(null);
    } catch (err) {
      setRowAttendance(row.employee, before);
      notify("error", apiError(err, "Could not clear attendance."));
    }
  };

  const unmarkedWorking = sheet ? sheet.rows.filter((r) => !r.attendance && r.is_working_day) : [];

  const markAllPresent = async () => {
    if (!unmarkedWorking.length) return;
    setBulkSaving(true);
    try {
      const res = await markAttendanceSheet({
        date,
        attendances: unmarkedWorking.map((r) => ({ employee: r.employee, status: "PRESENT" })),
      });
      const byEmp = Object.fromEntries(res.saved.map((a) => [a.employee, a]));
      setSheet((s) => ({ ...s, rows: s.rows.map((r) => (byEmp[r.employee] ? { ...r, attendance: byEmp[r.employee] } : r)) }));
      notify("success", `Marked ${res.saved.length} present.`);
    } catch (err) {
      notify("error", apiError(err, "Could not mark everyone present."));
    } finally {
      setBulkSaving(false);
    }
  };

  const counts = useMemo(() => {
    const c = { present: 0, leave: 0, unmarked: 0 };
    (sheet?.rows || []).forEach((r) => {
      if (!r.attendance) {
        if (r.is_working_day) c.unmarked += 1;
      } else if (r.attendance.status === "PRESENT") c.present += 1;
      else c.leave += 1;
    });
    return c;
  }, [sheet]);

  const dateLabel = fromISO(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const holiday = sheet?.holiday;

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button onClick={() => setDate(shiftDate(date, -1))} className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-r border-gray-200" title="Previous day">
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value > today ? today : e.target.value)}
              className="px-3 py-2.5 outline-none font-semibold text-gray-700 bg-transparent"
            />
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={date >= today}
              className="px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-l border-gray-200 disabled:opacity-30"
              title="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {date !== today && (
            <button onClick={() => setDate(today)} className="px-4 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">
              Today
            </button>
          )}
          <span className="text-sm font-semibold text-gray-500">{dateLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-100">{counts.present} present</span>
          <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100">{counts.leave} on leave</span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${counts.unmarked ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
            {counts.unmarked} not marked
          </span>
          <button
            onClick={markAllPresent}
            disabled={!unmarkedWorking.length || bulkSaving || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {bulkSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Mark everyone else present
          </button>
        </div>
      </div>

      {holiday && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
          <PartyPopper size={22} className="shrink-0" />
          <div>
            <p className="font-bold">
              {HOLIDAY_LABEL[holiday.holiday_type] || "Holiday"}
              {holiday.name ? ` — ${holiday.name}` : ""}
            </p>
            <p className="text-sm">
              No attendance needed; nobody is counted absent today. Mark someone present only if they came in (paid as an extra day).
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="mx-auto animate-spin mb-3" /> Loading attendance…
        </div>
      ) : !sheet?.rows.length ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">
          No active employees on this date. Add employees in the Employees tab.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {sheet.rows.map((row) => {
            const att = row.attendance;
            const status = att && STATUS_BY_VALUE[att.status];
            const open = expanded === row.employee;
            const offDay = !row.is_working_day || holiday;
            return (
              <div key={row.employee} className={`p-4 ${offDay && !att ? "bg-gray-50/60" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 md:w-64 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0">
                      {row.employee_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{row.employee_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {row.employee_role}
                        {!row.is_working_day && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-gray-400"><Moon size={10} /> day off</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() =>
                          att?.status === s.value
                            ? s.value !== "PRESENT" && setExpanded(open ? null : row.employee)
                            : save(row, s.value === "PRESENT"
                              ? { status: "PRESENT", leave_reason: "", informed: null, is_paid: false, notes: att?.notes || "" }
                              : {
                                status: s.value,
                                leave_reason: att && att.status !== "PRESENT" ? att.leave_reason : "",
                                informed: att && att.status !== "PRESENT" ? att.informed : null,
                                is_paid: att && att.status !== "PRESENT" ? att.is_paid : false,
                                notes: att?.notes || "",
                              })
                        }
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-colors ${att?.status === s.value ? s.on : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                      >
                        {s.label}
                      </button>
                    ))}
                    <span className="ml-1 w-5 flex justify-center">
                      {busy[row.employee] === "saving" && <Loader2 size={15} className="animate-spin text-gray-400" />}
                      {busy[row.employee] === "saved" && <Check size={16} className="text-green-600" />}
                    </span>
                  </div>

                  {att && att.status !== "PRESENT" && (
                    <button
                      onClick={() => setExpanded(open ? null : row.employee)}
                      className={`text-left md:text-right text-xs font-semibold px-3 py-1.5 rounded-lg border ${att.leave_reason ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-amber-300 bg-amber-50 text-amber-800"
                        }`}
                    >
                      {leaveSummary(att)}
                      <span className="ml-1 text-gray-400">{open ? "▲" : "▼"}</span>
                    </button>
                  )}
                  {!att && row.is_working_day && !holiday && (
                    <span className="text-xs font-semibold text-amber-600">Not marked</span>
                  )}
                </div>

                {open && att && att.status !== "PRESENT" && (
                  <div className="mt-3 md:pl-[268px]">
                    <AttendanceEditor attendance={att} onSave={(mark) => save(row, mark)} onClear={() => clear(row)} hideStatus />
                  </div>
                )}
                {status && att.status === "PRESENT" && att.notes && (
                  <p className="mt-2 md:pl-[268px] text-xs text-gray-500 italic">{att.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Tab 2: Monthly calendar (attendance + holidays) ──────────────────────────
const HolidayModal = ({ date, holiday, onClose, onSaved, notify }) => {
  const [form, setForm] = useState({
    name: holiday?.name || "",
    holiday_type: holiday?.holiday_type || "POYA",
    is_paid: holiday ? holiday.is_paid : true,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (holiday) await updateHoliday(holiday.id, form);
      else await createHoliday({ ...form, date });
      onSaved();
    } catch (err) {
      notify("error", apiError(err, "Could not save the holiday."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteHoliday(holiday.id);
      onSaved();
    } catch (err) {
      notify("error", apiError(err, "Could not remove the holiday."));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">{holiday ? "Edit holiday" : "Mark as holiday"}</p>
            <h3 className="text-lg font-bold text-gray-900">
              {fromISO(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {HOLIDAY_TYPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, holiday_type: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${form.holiday_type === value ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={form.holiday_type === "POYA" ? "e.g. Il Full Moon Poya" : "Name (optional)"}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-200"
        />
        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
          <input type="checkbox" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} className="mt-0.5 w-4 h-4 accent-amber-500" />
          <span>
            <span className="block text-sm font-bold text-gray-800">Paid for daily-paid staff</span>
            <span className="block text-xs text-gray-500">
              Daily-paid staff get their day rate for this holiday. Monthly salaries are never cut for a holiday, and nobody is counted absent.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between pt-2">
          {holiday ? (
            <button type="button" onClick={remove} disabled={saving} className="text-sm font-semibold text-red-600 hover:text-red-800">
              Remove holiday
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const CellEditorModal = ({ employee, date, attendance, holiday, isWorkingDay, onClose, onChange, notify }) => {
  const [saving, setSaving] = useState(false);

  const save = async (mark) => {
    setSaving(true);
    try {
      const res = await markAttendanceSheet({ date, attendances: [{ employee: employee.id, ...mark }] });
      onChange(res.saved[0]);
    } catch (err) {
      notify("error", apiError(err, "Could not save attendance."));
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    setSaving(true);
    try {
      await markAttendanceSheet({ date, attendances: [{ employee: employee.id, clear: true }] });
      onChange(null);
    } catch (err) {
      notify("error", apiError(err, "Could not clear attendance."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{employee.name}</h3>
            <p className="text-sm text-gray-500">
              {fromISO(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin text-gray-400" />}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
          </div>
        </div>
        {(holiday || !isWorkingDay) && (
          <p className="text-xs p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            {holiday ? `${HOLIDAY_LABEL[holiday.holiday_type]}${holiday.name ? ` — ${holiday.name}` : ""}.` : "Their day off."} Marking present here counts as an extra paid day.
          </p>
        )}
        <AttendanceEditor attendance={attendance} onSave={save} onClear={clear} disabled={saving} />
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-sm">Done</button>
        </div>
      </div>
    </div>
  );
};

const MonthCalendarTab = ({ period, setPeriod, notify }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cell, setCell] = useState(null); // { employee, date }
  const [holidayDate, setHolidayDate] = useState(null);
  const today = toLocalISO(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAttendanceMonth(period.month, period.year));
    } catch (err) {
      notify("error", apiError(err, "Could not load the month."));
    } finally {
      setLoading(false);
    }
  }, [period, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const holidaysByDate = useMemo(() => Object.fromEntries((data?.holidays || []).map((h) => [h.date, h])), [data]);

  const updateRecord = (employeeId, date, attendance) =>
    setData((d) => ({
      ...d,
      employees: d.employees.map((e) => {
        if (e.id !== employeeId) return e;
        const records = { ...e.records };
        if (attendance) records[date] = attendance;
        else delete records[date];
        return { ...e, records };
      }),
    }));

  const totals = (emp) => {
    const t = { worked: 0, paid: 0, unpaid: 0, uninformed: 0, unmarked: 0 };
    (data?.days || []).forEach(({ date, weekday }) => {
      if (emp.date_joined && date < emp.date_joined) return;
      const rec = emp.records[date];
      const scheduled = emp.working_days.includes(weekday) && !holidaysByDate[date];
      if (!rec) {
        if (scheduled && date <= today) t.unmarked += 1;
        return;
      }
      const worked = STATUS_BY_VALUE[rec.status]?.worked ?? 0;
      t.worked += worked;
      if (!scheduled) return;
      const leave = 1 - worked;
      if (leave > 0) {
        if (rec.is_paid) t.paid += leave;
        else t.unpaid += leave;
        if (rec.informed === false) t.uninformed += leave;
      }
    });
    return t;
  };

  const cellEmployee = cell && data?.employees.find((e) => e.id === cell.employeeId);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <MonthNav value={period} onChange={setPeriod} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {STATUSES.map((s) => (
            <span key={s.value} className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold ${s.cell}`}>{s.short}</span>
              {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-md bg-amber-200" /> Holiday</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-md bg-gray-200" /> Day off</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600" /> Not informed</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 px-1">
        Click a <strong>date</strong> to mark it as a holiday (Poya, public, shop closed…). Click any <strong>box</strong> to mark or change attendance.
      </p>

      {loading || !data ? (
        <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="mx-auto animate-spin mb-3" /> Loading month…
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white p-2 text-left font-bold text-gray-600 min-w-[160px] border-b border-gray-200">Employee</th>
                {data.days.map(({ date, weekday }) => {
                  const h = holidaysByDate[date];
                  const day = Number(date.slice(8));
                  return (
                    <th key={date} className="p-0.5 border-b border-gray-200">
                      <button
                        onClick={() => setHolidayDate(date)}
                        title={h ? `${HOLIDAY_LABEL[h.holiday_type]}${h.name ? ` — ${h.name}` : ""}${h.is_paid ? "" : " (unpaid for daily staff)"}` : "Mark as holiday"}
                        className={`w-8 rounded-md py-1 flex flex-col items-center leading-tight hover:ring-2 hover:ring-amber-300 ${h ? "bg-amber-200 text-amber-900" : date === today ? "bg-red-600 text-white" : "text-gray-600"
                          }`}
                      >
                        <span className="text-[9px] font-semibold opacity-70">{weekday.slice(0, 2)}</span>
                        <span className="font-bold">{day}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="p-2 border-b border-gray-200 text-gray-600 font-bold whitespace-nowrap" title="Days worked">Worked</th>
                <th className="p-2 border-b border-gray-200 text-gray-600 font-bold whitespace-nowrap" title="Paid leave days">Paid lv</th>
                <th className="p-2 border-b border-gray-200 text-gray-600 font-bold whitespace-nowrap" title="Unpaid leave days">Unpaid</th>
                <th className="p-2 border-b border-gray-200 text-gray-600 font-bold whitespace-nowrap" title="Leave not informed">Not inf.</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => {
                const t = totals(emp);
                return (
                  <tr key={emp.id} className="border-b border-gray-100 last:border-0">
                    <td className="sticky left-0 z-10 bg-white p-2">
                      <p className="font-bold text-gray-800 truncate max-w-[150px]">{emp.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {emp.role}
                        {t.unmarked > 0 && <span className="text-amber-600 font-semibold"> · {t.unmarked} unmarked</span>}
                      </p>
                    </td>
                    {data.days.map(({ date, weekday }) => {
                      const rec = emp.records[date];
                      const h = holidaysByDate[date];
                      const working = emp.working_days.includes(weekday);
                      const notEmployed = emp.date_joined && date < emp.date_joined;
                      const s = rec && STATUS_BY_VALUE[rec.status];
                      let cls = "bg-white border border-dashed border-gray-200 text-gray-300";
                      if (s) cls = s.cell;
                      else if (h) cls = "bg-amber-100";
                      else if (!working) cls = "bg-gray-100";
                      else if (date > today) cls = "bg-white border border-gray-100";
                      return (
                        <td key={date} className="p-0.5">
                          <button
                            disabled={notEmployed}
                            onClick={() => setCell({ employeeId: emp.id, date })}
                            title={rec ? `${s?.label}${rec.status !== "PRESENT" ? ` — ${leaveSummary(rec)}` : ""}${rec.notes ? ` — ${rec.notes}` : ""}` : h ? HOLIDAY_LABEL[h.holiday_type] : working ? "Not marked" : "Day off"}
                            className={`relative w-8 h-8 rounded-md font-bold flex items-center justify-center hover:ring-2 hover:ring-red-300 disabled:opacity-30 disabled:hover:ring-0 ${cls}`}
                          >
                            {notEmployed ? "–" : s ? s.short : ""}
                            {rec && rec.status !== "PRESENT" && rec.informed === false && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-600" />
                            )}
                            {rec && rec.status !== "PRESENT" && rec.is_paid && (
                              <span className="absolute bottom-0 right-0.5 text-[8px] leading-none">₨</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-bold text-gray-800">{fmtDays(t.worked)}</td>
                    <td className="p-2 text-center font-semibold text-blue-700">{fmtDays(t.paid)}</td>
                    <td className="p-2 text-center font-semibold text-red-700">{fmtDays(t.unpaid)}</td>
                    <td className="p-2 text-center font-semibold text-red-700">{fmtDays(t.uninformed)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">₨ = paid leave. Empty dashed box = working day not marked yet (counted as present in payroll).</p>
        </div>
      )}

      {cell && cellEmployee && (
        <CellEditorModal
          employee={cellEmployee}
          date={cell.date}
          attendance={cellEmployee.records[cell.date] || null}
          holiday={holidaysByDate[cell.date]}
          isWorkingDay={cellEmployee.working_days.includes(fromISO(cell.date).toLocaleDateString("en-US", { weekday: "long" }))}
          onClose={() => setCell(null)}
          onChange={(att) => updateRecord(cellEmployee.id, cell.date, att)}
          notify={notify}
        />
      )}
      {holidayDate && (
        <HolidayModal
          date={holidayDate}
          holiday={holidaysByDate[holidayDate]}
          onClose={() => setHolidayDate(null)}
          onSaved={() => {
            setHolidayDate(null);
            load();
          }}
          notify={notify}
        />
      )}
    </div>
  );
};

// ─── Tab 3: Payroll ───────────────────────────────────────────────────────────
const AdjustPayrollModal = ({ record, onClose, onSaved, notify }) => {
  const [form, setForm] = useState({
    allowances: num(record.allowances) || "",
    advances: num(record.advances) || "",
    deductions: num(record.deductions) || "",
    notes: record.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const preview =
    num(record.earnings) + num(form.allowances) - num(form.advances) - num(form.deductions) - num(record.epf_employee);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(await updatePayroll(record.id, {
        allowances: num(form.allowances),
        advances: num(form.advances),
        deductions: num(form.deductions),
        notes: form.notes,
      }));
    } catch (err) {
      notify("error", apiError(err, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, hint) => (
    <label className="block">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder="0"
        className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 font-semibold"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Adjust salary</p>
            <h3 className="text-lg font-bold text-gray-900">
              {record.employee_details?.first_name} {record.employee_details?.last_name}
            </h3>
            <p className="text-sm text-gray-500">Attendance pay {formatLKR(record.earnings)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {field("allowances", "Allowances / bonus (+)", "Overtime, incentives, festival bonus…")}
        {field("advances", "Salary advances already given (−)")}
        {field("deductions", "Other deductions (−)", "Loans, damages, meals…")}
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes (shown on the salary slip)"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 text-sm"
        />
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
          <span className="text-sm font-semibold text-gray-600">Net pay</span>
          <span className="text-lg font-black text-gray-900">{formatLKR(preview)}</span>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-gray-700">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
};

const SalarySlip = React.forwardRef(({ record, period }, ref) => {
  const emp = record.employee_details || {};
  const row = (label, value, cls = "") => (
    <div className={`flex justify-between py-1.5 text-sm ${cls}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
  return (
    <div ref={ref} className="p-10 text-gray-800 font-sans bg-white relative max-w-3xl mx-auto">
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black uppercase">NSS Auto Spares</h1>
          <p className="text-xs text-gray-600 mt-1">No. 272 Thudella, Ja-ela · +94 71 618 8187</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold uppercase">Salary Slip</h2>
          <p className="text-xs text-gray-600">{MONTHS[period.month - 1]} {period.year}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 my-5 text-sm">
        <div>
          <p className="font-bold text-base">{emp.first_name} {emp.last_name}</p>
          <p className="text-gray-600">{emp.role}</p>
          {emp.epf_registered && emp.epf_number && <p className="text-gray-600">EPF No: {emp.epf_number}</p>}
        </div>
        <div className="text-right text-gray-600">
          <p>{emp.salary_type === "MONTHLY" ? "Monthly salary" : "Daily rate"}: <strong>{formatLKR(emp.salary_rate)}</strong></p>
          <p>Day value: <strong>{formatLKR(record.day_value)}</strong></p>
        </div>
      </div>

      <table className="w-full text-xs border border-gray-300 mb-5">
        <thead className="bg-gray-100">
          <tr>
            {["Working days", "Worked", "Paid leave", "Unpaid leave", "Holidays", "Extra days"].map((h) => (
              <th key={h} className="border border-gray-300 p-1.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="text-center font-bold">
            <td className="border border-gray-300 p-2">{record.scheduled_days}</td>
            <td className="border border-gray-300 p-2">{fmtDays(record.days_worked)}</td>
            <td className="border border-gray-300 p-2">{fmtDays(record.paid_leave_days)}</td>
            <td className="border border-gray-300 p-2">{fmtDays(record.unpaid_leave_days)}</td>
            <td className="border border-gray-300 p-2">{record.holidays}</td>
            <td className="border border-gray-300 p-2">{fmtDays(record.extra_days)}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-gray-300 pt-2">
        {row("Attendance pay", formatLKR(record.earnings))}
        {num(record.allowances) > 0 && row("Allowances / bonus", `+ ${formatLKR(record.allowances)}`)}
        {num(record.advances) > 0 && row("Salary advances", `− ${formatLKR(record.advances)}`)}
        {num(record.deductions) > 0 && row("Other deductions", `− ${formatLKR(record.deductions)}`)}
        {num(record.epf_employee) > 0 && row("EPF employee contribution (8%)", `− ${formatLKR(record.epf_employee)}`)}
        {row("NET PAY", formatLKR(record.net_salary), "border-t-2 border-gray-800 mt-2 pt-2 text-base font-black")}
      </div>

      {num(record.epf_employer) > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          Employer contributions (not deducted): EPF 12% {formatLKR(record.epf_employer)} · ETF 3% {formatLKR(record.etf_employer)}
        </p>
      )}
      {record.notes && <p className="mt-3 text-sm italic text-gray-700">Note: {record.notes}</p>}

      <div className="grid grid-cols-2 gap-12 mt-16 text-xs text-center text-gray-600">
        <div><div className="border-b border-gray-500 mb-1 h-8" />Authorised by</div>
        <div><div className="border-b border-gray-500 mb-1 h-8" />Employee signature</div>
      </div>
      {record.status === "PAID" && (
        <div className="absolute top-24 right-12 border-4 border-green-600 text-green-600 font-black text-sm px-3 py-1 rounded rotate-12 opacity-70">
          PAID {record.paid_date || ""}
        </div>
      )}
    </div>
  );
});

const PayrollTab = ({ period, setPeriod, onOpenCalendar, notify }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [paying, setPaying] = useState(null);
  const [slip, setSlip] = useState(null);
  const slipRef = useRef(null);

  const printSlip = useReactToPrint({
    contentRef: slipRef,
    documentTitle: slip ? `Salary-${slip.employee_details?.first_name}-${period.year}-${period.month}` : "Salary",
    onAfterPrint: () => setSlip(null),
  });
  useEffect(() => {
    if (slip) printSlip();
  }, [slip]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await fetchPayroll(period.month, period.year));
    } catch (err) {
      notify("error", apiError(err, "Could not load payroll."));
    } finally {
      setLoading(false);
    }
  }, [period, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const calculate = async () => {
    setCalculating(true);
    try {
      setRecords(await generatePayrollDrafts({ month: period.month, year: period.year }));
      notify("success", "Salaries calculated from attendance.");
    } catch (err) {
      notify("error", apiError(err, "Could not calculate salaries."));
    } finally {
      setCalculating(false);
    }
  };

  const markPaid = async () => {
    const rec = paying;
    setPaying(null);
    try {
      const updated = await payPayroll(rec.id);
      setRecords((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      notify("success", "Marked as paid.");
    } catch (err) {
      notify("error", apiError(err, "Could not mark as paid."));
    }
  };

  const now = new Date();
  const monthInProgress = period.year > now.getFullYear() || (period.year === now.getFullYear() && period.month >= now.getMonth() + 1);
  const unmarkedTotal = records.reduce((s, r) => s + (r.unmarked_days || 0), 0);
  const total = (k) => records.reduce((s, r) => s + num(r[k]), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <MonthNav value={period} onChange={setPeriod} />
        <button
          onClick={calculate}
          disabled={calculating}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold disabled:opacity-50"
        >
          {calculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {records.length ? "Recalculate salaries" : "Calculate salaries"}
        </button>
      </div>

      {monthInProgress && records.length > 0 && (
        <p className="text-sm p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-100">
          This month isn't over yet. Remaining days are counted as worked, so these figures are a projection. Recalculate at month end.
        </p>
      )}
      {unmarkedTotal > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm p-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} /> {unmarkedTotal} working day{unmarkedTotal === 1 ? "" : "s"} not marked — counted as present. Check them before paying.
          </span>
          <button onClick={onOpenCalendar} className="font-bold underline whitespace-nowrap">Open calendar</button>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="mx-auto animate-spin mb-3" /> Loading payroll…
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
          No salaries for {MONTHS[period.month - 1]} {period.year} yet. Press <strong>Calculate salaries</strong> to work them out from attendance.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-center" title="Working days (excl. holidays) / days worked">Days</th>
                <th className="p-3 text-center">Leave paid / unpaid</th>
                <th className="p-3 text-center" title="Holidays on their working days / worked on holiday or day off">Hol. / Extra</th>
                <th className="p-3 text-right">Attendance pay</th>
                <th className="p-3 text-right">Allow. / Adv. / Ded.</th>
                <th className="p-3 text-right">EPF 8%</th>
                <th className="p-3 text-right">Net pay</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => {
                const emp = r.employee_details || {};
                const paid = r.status === "PAID";
                return (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="p-3">
                      <p className="font-bold text-gray-900">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-gray-500">
                        {emp.salary_type === "MONTHLY" ? "Monthly" : "Daily"} · {formatLKR(emp.salary_rate)}
                        {r.unmarked_days > 0 && <span className="text-amber-600 font-semibold"> · {r.unmarked_days} unmarked</span>}
                      </p>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="font-bold">{fmtDays(r.days_worked)}</span>
                      <span className="text-gray-400"> / {r.scheduled_days}</span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="text-blue-700 font-semibold">{fmtDays(r.paid_leave_days)}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-red-700 font-semibold">{fmtDays(r.unpaid_leave_days)}</span>
                      {num(r.uninformed_absences) > 0 && (
                        <span className="block text-[10px] text-red-600">{fmtDays(r.uninformed_absences)} not informed</span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {r.holidays}
                      <span className="text-gray-300"> / </span>
                      {fmtDays(r.extra_days)}
                    </td>
                    <td className="p-3 text-right font-semibold whitespace-nowrap">{formatLKR(r.earnings)}</td>
                    <td className="p-3 text-right text-xs whitespace-nowrap">
                      <span className="text-green-700">+{num(r.allowances).toLocaleString()}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-red-600">−{num(r.advances).toLocaleString()}</span>
                      <span className="text-gray-300"> / </span>
                      <span className="text-red-600">−{num(r.deductions).toLocaleString()}</span>
                    </td>
                    <td className="p-3 text-right text-red-600 whitespace-nowrap">
                      {num(r.epf_employee) > 0 ? `−${num(r.epf_employee).toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-right font-black text-gray-900 whitespace-nowrap">{formatLKR(r.net_salary)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {paid ? (
                          <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-200">Paid {r.paid_date}</span>
                        ) : (
                          <>
                            <button onClick={() => setAdjusting(r)} className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50" title="Allowances, advances, deductions">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => setPaying(r)} className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold">
                              Mark paid
                            </button>
                          </>
                        )}
                        <button onClick={() => setSlip(r)} className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100" title="Print salary slip">
                          <Printer size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td className="p-3" colSpan={4}>Total for {MONTHS[period.month - 1]}</td>
                <td className="p-3 text-right whitespace-nowrap">{formatLKR(total("earnings"))}</td>
                <td className="p-3" />
                <td className="p-3 text-right text-red-600 whitespace-nowrap">−{total("epf_employee").toLocaleString()}</td>
                <td className="p-3 text-right text-lg whitespace-nowrap">{formatLKR(total("net_salary"))}</td>
                <td className="p-3" />
              </tr>
              {total("epf_employer") > 0 && (
                <tr>
                  <td colSpan={9} className="px-3 pb-3 text-xs font-medium text-gray-500">
                    Employer contributions on top: EPF 12% {formatLKR(total("epf_employer"))} · ETF 3% {formatLKR(total("etf_employer"))} · EPF to remit (8% + 12%): {formatLKR(total("epf_employee") + total("epf_employer"))}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {adjusting && (
        <AdjustPayrollModal
          record={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={(updated) => {
            setRecords((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
            setAdjusting(null);
          }}
          notify={notify}
        />
      )}
      <ConfirmModal
        isOpen={!!paying}
        title="Mark salary as paid?"
        message={paying ? `${paying.employee_details?.first_name}'s ${MONTHS[period.month - 1]} salary of ${formatLKR(paying.net_salary)} will be locked as paid. It can't be recalculated or edited after this.` : ""}
        confirmLabel="Yes, mark paid"
        tone="info"
        onConfirm={markPaid}
        onCancel={() => setPaying(null)}
      />
      <div className="hidden">{slip && <SalarySlip ref={slipRef} record={slip} period={period} />}</div>
    </div>
  );
};

// ─── Tab 4: Employees ─────────────────────────────────────────────────────────
const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone_numbers: [{ type: "Personal", number: "" }],
  address: "",
  role: "",
  date_joined: toLocalISO(new Date()),
  salary_type: "DAILY",
  salary_rate: "",
  working_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  epf_registered: false,
  epf_number: "",
  is_active: true,
};

const EmployeeFormModal = ({ employee, onClose, onSaved, notify }) => {
  const [form, setForm] = useState(() =>
    employee
      ? {
        ...EMPTY_FORM,
        ...employee,
        email: employee.email || "",
        address: employee.address || "",
        epf_number: employee.epf_number || "",
        phone_numbers: employee.phone_numbers?.length ? employee.phone_numbers : [{ type: "Personal", number: "" }],
        working_days: employee.working_days || EMPTY_FORM.working_days,
      }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const set = (fields) => setForm((f) => ({ ...f, ...fields }));
  const input = "w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:outline-none text-sm font-semibold";
  const label = "text-[11px] text-gray-500 font-bold uppercase mb-1 block";

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, phone_numbers: form.phone_numbers.filter((p) => p.number?.trim()) };
      if (employee) await updateEmployee(employee.id, payload);
      else await createEmployee(payload);
      onSaved(employee ? "Employee updated." : "Employee added.");
    } catch (err) {
      notify("error", apiError(err, "Could not save employee."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-red-800 text-white p-4 flex justify-between items-center z-10">
          <h2 className="font-bold text-lg">{employee ? "Edit employee" : "Add employee"}</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><XCircle size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className={label}>First name</span><input required className={input} value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></div>
            <div><span className={label}>Last name</span><input required className={input} value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></div>
            <div><span className={label}>Role</span><input required placeholder="Mechanic, Cashier…" className={input} value={form.role} onChange={(e) => set({ role: e.target.value })} /></div>
            <div><span className={label}>Date joined</span><input type="date" required className={input} value={form.date_joined || ""} onChange={(e) => set({ date_joined: e.target.value })} /></div>
            <div><span className={label}>Email</span><input type="email" className={input} value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
            <div><span className={label}>Address</span><input className={input} value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
            <div className="flex justify-between items-center">
              <span className={label}>Phone numbers</span>
              <button type="button" onClick={() => set({ phone_numbers: [...form.phone_numbers, { type: "Personal", number: "" }] })} className="text-red-700 font-bold text-xs flex items-center gap-1">
                <Plus size={13} /> Add
              </button>
            </div>
            {form.phone_numbers.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="p-2 border border-gray-200 rounded-lg bg-white text-xs font-semibold w-28"
                  value={p.type}
                  onChange={(e) => set({ phone_numbers: form.phone_numbers.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}
                >
                  <option>Personal</option>
                  <option>Home</option>
                  <option>Parents</option>
                </select>
                <input
                  className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Phone number"
                  value={p.number}
                  onChange={(e) => set({ phone_numbers: form.phone_numbers.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)) })}
                />
                <button type="button" onClick={() => set({ phone_numbers: form.phone_numbers.filter((_, j) => j !== i) })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div>
            <span className={label}>Working days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = form.working_days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ working_days: on ? form.working_days.filter((x) => x !== d) : [...form.working_days, d] })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${on ? "bg-red-800 text-white border-red-800" : "bg-white text-gray-500 border-gray-200"}`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Paid</span>
              <select className={input} value={form.salary_type} onChange={(e) => set({ salary_type: e.target.value })}>
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <span className={label}>{form.salary_type === "DAILY" ? "Day rate (LKR)" : "Monthly salary (LKR)"}</span>
              <input type="number" min="0" step="0.01" required className={input} value={form.salary_rate} onChange={(e) => set({ salary_rate: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
              <input type="checkbox" checked={form.epf_registered} onChange={(e) => set({ epf_registered: e.target.checked })} className="w-4 h-4 accent-red-700" />
              <span>
                <span className="block text-sm font-bold text-gray-800">EPF / ETF registered</span>
                <span className="block text-[11px] text-gray-500">Deduct 8% EPF; employer 12% + ETF 3%</span>
              </span>
            </label>
            <div>
              <span className={label}>EPF number</span>
              <input className={input} disabled={!form.epf_registered} value={form.epf_number} onChange={(e) => set({ epf_number: e.target.value })} />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="w-4 h-4 accent-red-700" />
            <span className="text-sm font-bold text-gray-800">Currently employed (shows on the attendance sheet)</span>
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-gray-700">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white font-bold flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Save employee
          </button>
        </div>
      </form>
    </div>
  );
};

const EmployeesTab = ({ notify }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(await fetchEmployees());
    } catch (err) {
      notify("error", apiError(err, "Could not load employees."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    const emp = deleting;
    setDeleting(null);
    try {
      await deleteEmployee(emp.id);
      notify("success", "Employee removed.");
      load();
    } catch (err) {
      notify("error", apiError(err, "Could not remove employee."));
    }
  };

  const q = search.trim().toLowerCase();
  const shown = employees.filter((e) => !q || `${e.first_name} ${e.last_name} ${e.role}`.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees" className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 bg-white" />
        </div>
        <button onClick={() => setEditing(null)} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold">
          <Plus size={16} /> Add employee
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100"><Loader2 className="mx-auto animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">No employees found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((e) => (
            <div key={e.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${e.is_active ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0">{e.first_name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{e.first_name} {e.last_name}</p>
                    <p className="text-xs text-gray-500">{e.role}{!e.is_active && " · inactive"}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(e)} className="p-2 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50" title="Edit"><Edit2 size={15} /></button>
                  <button onClick={() => setDeleting(e)} className="p-2 rounded-lg text-gray-400 hover:text-red-700 hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400 font-semibold">{e.salary_type === "MONTHLY" ? "Monthly salary" : "Day rate"}</p>
                  <p className="font-bold text-gray-800">{formatLKR(e.salary_rate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400 font-semibold">EPF</p>
                  <p className="font-bold text-gray-800">{e.epf_registered ? e.epf_number || "Registered" : "Not registered"}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Works {(e.working_days || []).map((d) => d.slice(0, 3)).join(", ") || "—"} · joined {e.date_joined}</p>
              {(e.phone_numbers?.[0]?.number || e.email) && (
                <p className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-x-3">
                  {e.phone_numbers?.[0]?.number && <span className="flex items-center gap-1"><Phone size={11} /> {e.phone_numbers[0].number}</span>}
                  {e.email && <span className="flex items-center gap-1"><Mail size={11} /> {e.email}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <EmployeeFormModal
          employee={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(msg) => {
            setEditing(undefined);
            notify("success", msg);
            load();
          }}
          notify={notify}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        title="Delete employee?"
        message={deleting ? `This removes ${deleting.first_name} ${deleting.last_name} along with their attendance and payroll history. To keep the history, edit them and untick "Currently employed" instead.` : ""}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "attendance", label: "Daily Attendance", icon: ClipboardCheck },
  { id: "calendar", label: "Calendar & Holidays", icon: CalendarDays },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "employees", label: "Employees", icon: Users },
];

// Links can open a tab and month directly: /employees?tab=payroll&month=2026-11
const initialFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "attendance";
  const now = new Date();
  let period = { month: now.getMonth() + 1, year: now.getFullYear() };
  const m = /^(\d{4})-(\d{2})$/.exec(params.get("month") || "");
  if (m && +m[2] >= 1 && +m[2] <= 12) period = { month: +m[2], year: +m[1] };
  return { tab, period };
};

const EmployeePage = () => {
  const [initial] = useState(initialFromURL);
  const [tab, setTab] = useState(initial.tab);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [calendarPeriod, setCalendarPeriod] = useState(initial.period);
  const [payrollPeriod, setPayrollPeriod] = useState(initial.period);
  const notify = useCallback((type, message) => setAlert({ type, message }), []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-red-700" /> Employees & Payroll
          </h1>
          <p className="text-gray-500">Mark attendance every day; salaries are worked out from it at month end.</p>
        </div>

        <div className="flex gap-1 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${tab === t.id ? "bg-red-700 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "attendance" && <DailyAttendanceTab notify={notify} />}
        {tab === "calendar" && <MonthCalendarTab period={calendarPeriod} setPeriod={setCalendarPeriod} notify={notify} />}
        {tab === "payroll" && (
          <PayrollTab
            period={payrollPeriod}
            setPeriod={setPayrollPeriod}
            onOpenCalendar={() => {
              setCalendarPeriod(payrollPeriod);
              setTab("calendar");
            }}
            notify={notify}
          />
        )}
        {tab === "employees" && <EmployeesTab notify={notify} />}
      </div>

      {alert.message && (
        <AlertComponent type={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}
    </div>
  );
};

export default EmployeePage;
