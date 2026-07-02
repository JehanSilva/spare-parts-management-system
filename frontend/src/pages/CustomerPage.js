import React, { useState, useEffect, useCallback } from "react";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addVehicleToCustomer,
  deleteCustomerVehicle,
  updateCustomerVehicle,
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
} from "lucide-react";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";

const Field = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </label>
    <input
      id={id}
      {...props}
      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <User size={18} /> {isEdit ? "Edit Customer" : "Add New Customer"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Field label="Full Name *" id="cust-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John Doe" />
          <Field label="Phone" id="cust-phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 077 123 4567" />
          <Field label="Email" id="cust-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. john@email.com" />
          <div>
            <label htmlFor="cust-address" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
            <textarea id="cust-address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="e.g. 42 Main Street, Colombo" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-sm disabled:opacity-60">
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Customer"}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Registration Number */}
          <Field
            label="Registration Number *"
            id="veh-num"
            value={form.vehicle_number}
            onChange={e => setForm(p => ({ ...p, vehicle_number: e.target.value.toUpperCase() }))}
            placeholder="e.g. ABC-1234"
            disabled={isEdit}
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
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this vehicle"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all resize-none"
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

const CustomerCard = ({ customer, onEdit, onDelete, onRefresh, autoExpand }) => {
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

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex items-start gap-4 p-5">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <User size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-base truncate">{customer.name}</h3>
              {customer.total_sales > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                  <ShoppingBag size={9} /> {customer.total_sales} sale{customer.total_sales > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {customer.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} className="text-gray-400" /> {customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} className="text-gray-400" /> {customer.email}</span>}
              {customer.address && <span className="flex items-center gap-1 text-xs text-gray-500 truncate max-w-xs"><MapPin size={11} className="text-gray-400 shrink-0" /> {customer.address}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onEdit(customer)} title="Edit customer" className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
            <button onClick={() => onDelete(customer)} title="Delete customer" className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
            <button onClick={() => setExpanded(p => !p)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${expanded ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <Car size={13} /> {customer.vehicles?.length || 0}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 px-5 pb-4 pt-3 bg-gray-50/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Registered Vehicles</span>
              <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors">
                <Plus size={12} /> Add Vehicle
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
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                          <Car size={14} className="text-red-500" />
                        </div>
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
                          <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                            <Palette size={9} className="text-gray-400" /> {v.color}
                          </span>
                        )}
                        {v.current_mileage && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <Gauge size={9} /> {v.current_mileage.toLocaleString()} km
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
