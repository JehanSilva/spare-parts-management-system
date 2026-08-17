import React, { useState, useEffect, useCallback } from "react";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addVehicleToCustomer,
  deleteCustomerVehicle,
  updateCustomerVehicle,
  fetchCustomerHistory,
} from "../services/api";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Gauge,
  Palette,
  History,
  Wrench,
  StickyNote,
} from "lucide-react";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import AvatarBadge from "../components/AvatarBadge";

const formatLKR = (amount) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const Field = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
      {label}
    </label>
    <input
      id={id}
      {...props}
      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-900 focus:bg-white transition-colors disabled:text-gray-400"
    />
  </div>
);

const CustomerModal = ({ customer, onClose, onSaved }) => {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Customer name is required."); return; }
    setLoading(true);
    try {
      if (isEdit) { await updateCustomer(customer.id, form); }
      else { await createCustomer(form); }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || "Failed to save customer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header — mirrors a customer card: avatar, muted meta line, bold title */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            {form.name.trim() ? (
              <AvatarBadge name={form.name} />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">
                {isEdit ? "Editing customer" : "New customer"}
              </p>
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {form.name.trim() || (isEdit ? "Edit Customer" : "Add New Customer")}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Field label="Full Name *" id="cust-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John Doe" />
          <Field label="Phone" id="cust-phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 077 123 4567" />
          <Field label="Email" id="cust-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. john@email.com" />
          <div>
            <label htmlFor="cust-address" className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Address</label>
            <textarea id="cust-address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="e.g. 42 Main Street, Colombo" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-900 focus:bg-white transition-colors resize-none" />
          </div>
          <div className="border-t border-gray-100 mt-2 pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              {loading ? "Saving..." : isEdit ? "Save changes" : "Add customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Shared Add/Edit Vehicle Modal
const VehicleModal = ({ customerId, vehicle, onClose, onSaved }) => {
  const isEdit = !!vehicle;
  const [form, setForm] = useState({
    vehicle_number: vehicle?.vehicle_number || "",
    make: vehicle?.make || "",
    model: vehicle?.model || "",
    year: vehicle?.year ? String(vehicle.year) : "",
    color: vehicle?.color || "",
    current_mileage: vehicle?.current_mileage ? String(vehicle.current_mileage) : "",
    notes: vehicle?.notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_number.trim()) { setError("Vehicle number is required."); return; }
    setLoading(true);
    const payload = {
      ...form,
      year: form.year ? parseInt(form.year) : null,
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
    };
    try {
      if (isEdit) {
        await updateCustomerVehicle(vehicle.id, payload);
      } else {
        await addVehicleToCustomer(customerId, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.vehicle_number?.[0] || err.response?.data?.non_field_errors?.[0] || `Failed to ${isEdit ? 'update' : 'add'} vehicle.`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white">
          <h2 className="font-bold text-lg flex items-center gap-2"><Car size={18} /> {isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Registration Number */}
          <Field
            label="Registration Number *"
            id="veh-num"
            value={form.vehicle_number}
            onChange={e => setForm(p => ({ ...p, vehicle_number: e.target.value.toUpperCase() }))}
            placeholder="e.g. ABC-1234"
          />

          {/* Make / Model / Year row */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Make" id="veh-make" value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} placeholder="Toyota" />
            <Field label="Model" id="veh-model" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="Corolla" />
            <Field label="Year" id="veh-year" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="2020" />
          </div>

          {/* Color / Mileage row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Color" id="veh-color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} placeholder="e.g. Pearl White" />
            <Field label="Current Mileage (km)" id="veh-mileage" type="number" value={form.current_mileage} onChange={e => setForm(p => ({ ...p, current_mileage: e.target.value }))} placeholder="e.g. 45000" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this vehicle"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-900 focus:bg-white transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-sm disabled:opacity-60">
              {loading ? (isEdit ? "Saving..." : "Adding...") : (isEdit ? "Save Changes" : "Add Vehicle")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Purchase History Modal — every sale tied to this customer (Sale.customer FK),
// whether or not that sale had a vehicle attached. Mirrors VehicleHistoryModal
// in VehicleRegistryPage.js, but scoped by customer instead of by plate number.
const CustomerHistoryModal = ({ customer, onClose }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    fetchCustomerHistory(customer.id)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [customer]);

  if (!customer) return null;

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-LK", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white shrink-0">
          <h2 className="font-bold text-lg flex items-center gap-2"><History size={18} /> {customer.name} — Purchase History</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag size={28} className="mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-gray-500">No purchases yet</p>
              <p className="text-sm mt-1">Sales made for this customer in POS will show up here.</p>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">{formatDate(job.created_at)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${job.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {job.status}
                    </span>
                    {job.vehicle_number ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <Car size={9} /> {job.vehicle_number}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">No Vehicle</span>
                    )}
                    {job.mileage != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        <Gauge size={9} /> {job.mileage.toLocaleString()} km
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${job.status === "CANCELLED" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {formatLKR(job.total_amount)}
                  </span>
                </div>
                {job.notes && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 italic flex items-start gap-1.5">
                    <StickyNote size={12} className="shrink-0 mt-0.5" /> {job.notes}
                  </div>
                )}
                <div className="px-4 py-3 space-y-1.5">
                  {job.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 flex items-center gap-1.5 min-w-0">
                        {item.item_type === "LABOR" && <Wrench size={10} className="text-gray-400 shrink-0" />}
                        <span className="truncate">{item.part_name}</span>
                        <span className="text-gray-400 shrink-0">x{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-800 shrink-0">{formatLKR(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CustomerCard = ({ customer, onEdit, onDelete, onHistory, onRefresh, autoExpand }) => {
  const [expanded, setExpanded] = useState(!!autoExpand);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);

  // Auto-expand when a vehicle-number search targets this customer
  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try { await deleteCustomerVehicle(vehicleToDelete.id); onRefresh(); } catch {}
    setVehicleToDelete(null);
  };

  return (
    <>
      {showAddVehicle && <VehicleModal customerId={customer.id} onClose={() => setShowAddVehicle(false)} onSaved={onRefresh} />}
      {editVehicle && <VehicleModal vehicle={editVehicle} onClose={() => setEditVehicle(null)} onSaved={onRefresh} />}
      <ConfirmModal isOpen={!!vehicleToDelete} title="Remove Vehicle?" message={`Remove ${vehicleToDelete?.vehicle_number} from ${customer.name}?`} onConfirm={handleDeleteVehicle} onCancel={() => setVehicleToDelete(null)} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden">
        <div className="p-5">
          {/* Header: avatar + actions */}
          <div className="flex items-start justify-between gap-3">
            <AvatarBadge name={customer.name} />

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onHistory(customer)}
                title="Purchase history"
                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
              >
                <History size={14} />
              </button>
              <button
                onClick={() => onEdit(customer)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
                title="Edit customer"
              >
                Edit <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(customer)}
                title="Delete customer"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Identity */}
          <p className="text-xs text-gray-400 font-medium mt-4">
            {customer.total_sales > 0
              ? `${customer.total_sales} sale${customer.total_sales > 1 ? "s" : ""}`
              : "No sales yet"}
            {customer.vehicles?.length > 0 &&
              ` · ${customer.vehicles.length} vehicle${customer.vehicles.length > 1 ? "s" : ""}`}
          </p>
          <h3 className="text-lg font-bold text-gray-900 leading-snug mt-0.5 truncate">
            {customer.name}
          </h3>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
              >
                <Phone size={12} className="shrink-0 text-gray-400" /> {customer.phone}
              </a>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                title={customer.email}
                className="inline-flex items-center gap-1.5 max-w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
              >
                <Mail size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">{customer.email}</span>
              </a>
            )}
            {customer.address && (
              <span
                title={customer.address}
                className="inline-flex items-center gap-1.5 max-w-full bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg"
              >
                <MapPin size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">{customer.address}</span>
              </span>
            )}
          </div>

          {/* Footer: vehicles count + expand action */}
          <div className="border-t border-gray-100 mt-4 pt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-none">
                {customer.vehicles?.length || 0}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Registered vehicle{customer.vehicles?.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              onClick={() => setExpanded(p => !p)}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-full transition-colors shrink-0"
            >
              <Car size={13} /> {expanded ? "Hide" : "Vehicles"}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 px-5 pb-4 pt-3 bg-gray-50/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Registered Vehicles</span>
              <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors">
                <Plus size={13} /> Add vehicle
              </button>
            </div>
            {customer.vehicles?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No vehicles registered yet.</p>
            ) : (
              <div className="space-y-2.5">
                {customer.vehicles.map(v => (
                  <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Vehicle Header */}
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <AvatarBadge name={v.vehicle_number} icon={Car} iconSize={14} size="w-8 h-8" />
                        <div>
                          <p className="font-bold text-sm text-gray-800 tracking-wide">{v.vehicle_number}</p>
                          {(v.make || v.model || v.year) && (
                            <p className="text-[11px] text-gray-500 font-medium">
                              {[v.make, v.model, v.year].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditVehicle(v)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                          title="Edit vehicle"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setVehicleToDelete(v)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove vehicle"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Vehicle Detail Tags */}
                    {(v.color || v.current_mileage || v.notes) && (
                      <div className="flex flex-wrap gap-2 px-3 pb-2.5 pt-0">
                        {v.color && (
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                            <Palette size={12} className="shrink-0 text-gray-400" /> {v.color}
                          </span>
                        )}
                        {v.current_mileage && (
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                            <Gauge size={12} className="shrink-0 text-gray-400" /> {v.current_mileage.toLocaleString()} km
                          </span>
                        )}
                        {v.notes && (
                          <span className="text-[11px] text-gray-400 italic truncate max-w-full">{v.notes}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers(searchTerm);
      setCustomers(data);
    } catch {
      setAlertInfo({ type: "error", message: "Failed to load customers." });
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
      setAlertInfo({ type: "success", message: `${deleteTarget.name} deleted.` });
      load();
    } catch {
      setAlertInfo({ type: "error", message: "Failed to delete customer." });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {alertInfo.message && <AlertComponent type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo({ type: "", message: "" })} />}
      {showAddModal && <CustomerModal onClose={() => setShowAddModal(false)} onSaved={load} />}
      {editCustomer && <CustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} onSaved={load} />}
      {historyCustomer && <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />}
      <ConfirmModal isOpen={!!deleteTarget} title="Delete Customer?" message={`This will permanently delete ${deleteTarget?.name} and all their vehicles. This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-red-50 rounded-xl"><User size={22} className="text-red-600" /></div>
            Customers
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-1">Manage customer records and their registered vehicles</p>
        </div>
        <button id="add-customer-btn" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 active:scale-95 transition-all shadow-md">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Customers</p>
          <p className="text-3xl font-extrabold text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Registered Vehicles</p>
          <p className="text-3xl font-extrabold text-gray-900">{customers.reduce((a, c) => a + (c.vehicles?.length || 0), 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">With Vehicles</p>
          <p className="text-3xl font-extrabold text-gray-900">{customers.filter(c => c.vehicles?.length > 0).length}</p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        <input id="customer-search" type="text" placeholder="Search by name, phone or vehicle number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm" />

      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-20" />)}</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><User size={32} className="opacity-40" /></div>
          <p className="text-lg font-semibold text-gray-500">No customers found</p>
          <p className="text-sm mt-1">Add your first customer using the button above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map(c => {
            // Auto-expand this card if the search term matches one of its vehicle numbers
            const term = searchTerm.trim().toLowerCase();
            const autoExpand = term.length > 0 &&
              c.vehicles?.some(v => v.vehicle_number?.toLowerCase().includes(term));
            return (
              <CustomerCard
                key={c.id}
                customer={c}
                onEdit={setEditCustomer}
                onDelete={setDeleteTarget}
                onHistory={setHistoryCustomer}
                onRefresh={load}
                autoExpand={autoExpand}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerPage;
