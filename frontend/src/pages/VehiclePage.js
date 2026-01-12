import React, { useEffect, useState } from "react";
import {
  fetchVehicles,
  deleteVehicle,
  createVehicle,
  updateVehicle,
} from "../services/api"; // Ensure create/update are imported here
import AddVehicleForm from "../components/forms/AddVehicleForm";
import AlertComponent from "../components/AlertComponent";
import ConfirmModal from "../components/ConfirmModal";
import { Car, Search, Plus, Edit2, Trash2, XCircle } from "lucide-react";

const VehiclePage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  // Alert & Modal States
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });
  const [deleteId, setDeleteId] = useState(null);

  // --- 1. Load Data ---
  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await fetchVehicles();
      setVehicles(data);
    } catch (error) {
      console.error("Failed to load vehicles", error);
      setAlertInfo({ type: "error", message: "Failed to load vehicle list." });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // --- 2. Action Handlers ---

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step A: Trigger the Delete Modal
  const confirmDelete = (id) => {
    setDeleteId(id);
  };

  // Step B: Execute Delete (Called by Modal)
  const executeDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteVehicle(deleteId);
      setAlertInfo({
        type: "success",
        message: "Vehicle deleted successfully!",
      });
      loadVehicles(); // Refresh list
    } catch (error) {
      setAlertInfo({
        type: "error",
        message:
          "Failed to delete vehicle. It might be linked to existing inventory.",
      });
    } finally {
      setDeleteId(null); // Close modal
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVehicle(null);
  };

  // --- 3. SUBMIT HANDLER (Handles Add & Update API Calls) ---
  const handleFormSubmit = async (formData) => {
    setAlertInfo({ type: "", message: "" }); // Clear previous alerts

    try {
      if (editingVehicle) {
        // Update Logic
        await updateVehicle(editingVehicle.id, formData);
        setAlertInfo({
          type: "success",
          message: "Vehicle Updated Successfully!",
        });
      } else {
        // Create Logic
        await createVehicle(formData);
        setAlertInfo({
          type: "success",
          message: "Vehicle Added Successfully!",
        });
      }

      loadVehicles(); // Refresh List
      handleFormClose(); // Close Form
    } catch (error) {
      console.error("Save Error:", error);

      // Error Parsing Logic (Extracts message from backend)
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
    }
  };

  // --- 4. Filter Logic ---
  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.year && v.year.toString().includes(searchTerm))
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50 relative">
      {/* --- CONFIRMATION MODAL --- */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Vehicle?"
        message="Are you sure you want to delete this vehicle model? This action cannot be undone."
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
            <Car className="w-6 h-6 md:w-8 md:h-8" /> Vehicle Models
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage supported vehicles.
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
          {showForm ? "Close Form" : "Add Vehicle"}
        </button>
      </div>

      {/* --- FORM SECTION --- */}
      {showForm && (
        <div className="mb-8 animate-fade-in-down">
          <AddVehicleForm
            onSubmit={handleFormSubmit} // Passes the submit logic down
            onCancel={handleFormClose}
            editingVehicle={editingVehicle}
          />
        </div>
      )}

      {/* --- SEARCH BAR --- */}
      <div className="relative mb-6 w-full md:max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search vehicles..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* --- VEHICLES GRID --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mb-2"></div>
          <p>Loading Vehicles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredVehicles.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded-lg shadow border border-gray-100">
              <Car size={48} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 italic">No vehicles found.</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white p-5 rounded-lg shadow-sm hover:shadow-xl border-l-4 border-red-500 transition-all duration-300 group relative"
              >
                {/* Content */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 pr-16 truncate">
                    {vehicle.make}
                  </h3>
                  <p className="text-gray-600 font-medium truncate">
                    {vehicle.model}
                  </p>

                  <div className="mt-3">
                    <span className="bg-red-50 text-red-800 text-xs font-bold px-2.5 py-1 rounded border border-red-100">
                      Year: {vehicle.year || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Mobile-Friendly Actions */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="p-2 bg-gray-100 text-blue-600 rounded-full hover:bg-blue-100 hover:text-blue-800 transition"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => confirmDelete(vehicle.id)}
                    className="p-2 bg-gray-100 text-red-500 rounded-full hover:bg-red-100 hover:text-red-700 transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default VehiclePage;
