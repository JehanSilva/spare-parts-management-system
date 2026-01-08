import React, { useEffect, useState } from "react";
import { fetchVehicles, deleteVehicle } from "../services/api";
import AddVehicleForm from "../components/forms/AddVehicleForm";
import { Car, Search, Plus, Edit2, Trash2, AlertTriangle } from "lucide-react";

const VehiclePage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // UI States
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null); // Tracks the vehicle being edited

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await fetchVehicles();
      setVehicles(data);
    } catch (error) {
      console.error("Failed to load vehicles", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // --- ACTIONS ---

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle); // Set data to edit
    setShowForm(true); // Open form
    window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await deleteVehicle(id);
        loadVehicles(); // Refresh list
      } catch (error) {
        alert("Failed to delete vehicle.");
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingVehicle(null); // Clear editing state
  };

  const handleFormSuccess = () => {
    loadVehicles();
    handleFormClose();
  };

  // Filter Logic
  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.year.toString().includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Car className="w-8 h-8" /> Vehicle Models
          </h1>
          <p className="text-gray-600 mt-1">Manage supported vehicles.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) handleFormClose();
            else setShowForm(true);
          }}
          className={`px-6 py-2 rounded-lg font-bold shadow transition flex items-center gap-2 text-white ${
            showForm
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <Plus
            size={20}
            className={
              showForm
                ? "rotate-45 transition-transform"
                : "transition-transform"
            }
          />
          {showForm ? "Close Form" : "Add Vehicle"}
        </button>
      </div>

      {/* Smart Form (Handles Add & Edit) */}
      {showForm && (
        <AddVehicleForm
          onVehicleSaved={handleFormSuccess}
          onCancel={handleFormClose}
          editingVehicle={editingVehicle} // Pass the vehicle to edit
        />
      )}

      {/* Search Bar */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search vehicles..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">
          Loading Vehicles...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md border-l-4 border-red-500 transition group relative"
            >
              {/* Card Content */}
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {vehicle.make} {vehicle.model}
                </h3>
                <span className="bg-red-50 text-red-800 text-xs font-bold px-2 py-1 rounded mt-2 inline-block border border-red-100">
                  Year: {vehicle.year}
                </span>
              </div>

              {/* Action Buttons (Edit / Delete) */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehiclePage;
