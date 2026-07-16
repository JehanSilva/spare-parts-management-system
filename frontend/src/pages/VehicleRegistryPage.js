import React, { useState, useEffect, useCallback } from "react";
import {
  fetchCustomerVehicles,
  createCustomerVehicle,
  updateCustomerVehicle,
  deleteCustomerVehicle,
} from "../services/api";
import {
  Car,
  Phone,
  Mail,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Gauge,
  Palette,
  UserPlus,
  UserCheck,
  Link2Off,
} from "lucide-react";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import CustomerLinkPicker from "../components/CustomerLinkPicker";

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

// Add/Edit Vehicle Modal — no customer field at all; linking is a separate action.
const VehicleModal = ({ vehicle, onClose, onSaved }) => {
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
        await createCustomerVehicle(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.vehicle_number?.[0] || err.response?.data?.non_field_errors?.[0] || `Failed to ${isEdit ? "update" : "add"} vehicle.`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white">
          <h2 className="font-bold text-lg flex items-center gap-2"><Car size={18} /> {isEdit ? "Edit Vehicle" : "Add Vehicle"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <Field
            label="Registration Number *"
            id="reg-veh-num"
            value={form.vehicle_number}
            onChange={(e) => setForm((p) => ({ ...p, vehicle_number: e.target.value.toUpperCase() }))}
            placeholder="e.g. ABC-1234"
            disabled={isEdit}
          />

          <div className="grid grid-cols-3 gap-3">
            <Field label="Make" id="reg-veh-make" value={form.make} onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))} placeholder="Toyota" />
            <Field label="Model" id="reg-veh-model" value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} placeholder="Corolla" />
            <Field label="Year" id="reg-veh-year" type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="2020" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Color" id="reg-veh-color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} placeholder="e.g. Pearl White" />
            <Field label="Current Mileage (km)" id="reg-veh-mileage" type="number" value={form.current_mileage} onChange={(e) => setForm((p) => ({ ...p, current_mileage: e.target.value }))} placeholder="e.g. 45000" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about this vehicle"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-sm disabled:opacity-60">
              {loading ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Link/Change/Unlink Customer Modal
const LinkCustomerModal = ({ vehicle, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = async (customer) => {
    setLoading(true);
    setError("");
    try {
      await updateCustomerVehicle(vehicle.id, { customer: customer.id });
      onSaved();
      onClose();
    } catch {
      setError("Failed to link customer.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    setError("");
    try {
      await updateCustomerVehicle(vehicle.id, { customer: null });
      onSaved();
      onClose();
    } catch {
      setError("Failed to unlink customer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900 text-white">
          <h2 className="font-bold text-lg flex items-center gap-2"><UserCheck size={18} /> {vehicle.vehicle_number}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {vehicle.customer_details ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Currently Linked</p>
              <p className="font-bold text-green-900">{vehicle.customer_details.name}</p>
              {vehicle.customer_details.phone && <p className="text-sm text-green-700">{vehicle.customer_details.phone}</p>}
              {vehicle.customer_details.email && <p className="text-sm text-green-700">{vehicle.customer_details.email}</p>}
              <button
                onClick={handleUnlink}
                disabled={loading}
                className="w-full mt-2 py-2 text-sm font-bold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <Link2Off size={14} /> {loading ? "Unlinking..." : "Unlink Customer"}
              </button>
            </div>
          ) : (
            <CustomerLinkPicker onSelect={handleSelect} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
};

const VehicleCard = ({ vehicle, onEdit, onDelete, onLink }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
        <Car size={20} className="text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 text-base tracking-wide truncate">{vehicle.vehicle_number}</h3>
        {(vehicle.make || vehicle.model || vehicle.year) && (
          <p className="text-sm text-gray-500 font-medium">{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {vehicle.color && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
              <Palette size={9} className="text-gray-400" /> {vehicle.color}
            </span>
          )}
          {vehicle.current_mileage != null && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              <Gauge size={9} /> {vehicle.current_mileage.toLocaleString()} km
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(vehicle)} title="Edit vehicle" className="p-2 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
        <button onClick={() => onDelete(vehicle)} title="Delete vehicle" className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
      </div>
    </div>

    <div className="mt-3 pt-3 border-t border-gray-100">
      {vehicle.customer_details ? (
        <button
          onClick={() => onLink(vehicle)}
          className="w-full flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 hover:bg-green-100 transition-colors text-left"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold text-green-800 truncate">{vehicle.customer_details.name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {vehicle.customer_details.phone && <span className="flex items-center gap-1 text-[11px] text-green-600"><Phone size={10} /> {vehicle.customer_details.phone}</span>}
              {vehicle.customer_details.email && <span className="flex items-center gap-1 text-[11px] text-green-600"><Mail size={10} /> {vehicle.customer_details.email}</span>}
              {vehicle.customer_details.address && <span className="flex items-center gap-1 text-[11px] text-green-600 truncate"><MapPin size={10} className="shrink-0" /> {vehicle.customer_details.address}</span>}
            </div>
          </div>
          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">Change</span>
        </button>
      ) : (
        <button
          onClick={() => onLink(vehicle)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-dashed border-gray-300 hover:border-red-300 rounded-xl py-2 transition-colors"
        >
          <UserPlus size={13} /> Link Customer (optional)
        </button>
      )}
    </div>
  </div>
);

const VehicleRegistryPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [linkVehicle, setLinkVehicle] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerVehicles(searchTerm);
      setVehicles(data);
    } catch {
      setAlertInfo({ type: "error", message: "Failed to load vehicles." });
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
      await deleteCustomerVehicle(deleteTarget.id);
      setAlertInfo({ type: "success", message: `${deleteTarget.vehicle_number} deleted.` });
      load();
    } catch {
      setAlertInfo({ type: "error", message: "Failed to delete vehicle." });
    }
    setDeleteTarget(null);
  };

  const linkedCount = vehicles.filter((v) => v.customer_details).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {alertInfo.message && <AlertComponent type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo({ type: "", message: "" })} />}
      {showAddModal && <VehicleModal onClose={() => setShowAddModal(false)} onSaved={load} />}
      {editVehicle && <VehicleModal vehicle={editVehicle} onClose={() => setEditVehicle(null)} onSaved={load} />}
      {linkVehicle && <LinkCustomerModal vehicle={linkVehicle} onClose={() => setLinkVehicle(null)} onSaved={load} />}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Vehicle?"
        message={`This will permanently delete ${deleteTarget?.vehicle_number} from the registry. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-red-50 rounded-xl"><Car size={22} className="text-red-600" /></div>
            Vehicles
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-1">Registered vehicles (plate/make/model) — independent of any customer</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 active:scale-95 transition-all shadow-md">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Vehicles</p>
          <p className="text-3xl font-extrabold text-gray-900">{vehicles.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Linked to Customer</p>
          <p className="text-3xl font-extrabold text-gray-900">{linkedCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Unlinked</p>
          <p className="text-3xl font-extrabold text-gray-900">{vehicles.length - linkedCount}</p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by plate, make, model, or customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-32" />)}</div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Car size={32} className="opacity-40" /></div>
          <p className="text-lg font-semibold text-gray-500">No vehicles found</p>
          <p className="text-sm mt-1">Add your first vehicle using the button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onEdit={setEditVehicle}
              onDelete={setDeleteTarget}
              onLink={setLinkVehicle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleRegistryPage;
