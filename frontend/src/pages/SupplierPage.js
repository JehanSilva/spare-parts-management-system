import React, { useEffect, useState } from "react";
import { fetchSuppliers } from "../services/api";
import AddSupplierForm from "../components/forms/AddSupplierForm";
import { Truck, Plus, Phone, Mail, MapPin, User, Search } from "lucide-react";

const SupplierPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadSuppliers = async () => {
    setLoading(true);
    const data = await fetchSuppliers();
    setSuppliers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Client-side filtering for suppliers (since lists are usually small)
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Truck className="w-8 h-8" /> Supplier Directory
          </h1>
          <p className="text-gray-600 mt-1">
            Manage distributor contacts and details.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-6 py-2 rounded-lg font-bold shadow transition flex items-center gap-2 text-white ${
            showForm
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <Plus size={20} /> {showForm ? "Close Form" : "Add Supplier"}
        </button>
      </div>

      {/* Add Form Section */}
      {showForm && (
        <div className="animate-fade-in-down">
          <AddSupplierForm
            onSupplierAdded={() => {
              setShowForm(false);
              loadSuppliers();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search suppliers by name or contact person..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading Suppliers...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 italic">
              No suppliers found.
            </p>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition border-t-4 border-red-600 p-6"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  {supplier.name}
                </h2>
                <hr className="border-gray-100 my-3" />

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-3">
                    <User className="text-red-500" size={18} />
                    <span className="font-medium text-gray-900">
                      {supplier.contact_person || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="text-red-500" size={18} />
                    <span>{supplier.phone || "No Phone"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="text-red-500" size={18} />
                    <a
                      href={`mailto:${supplier.email}`}
                      className="hover:text-red-700 underline"
                    >
                      {supplier.email || "No Email"}
                    </a>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="text-red-500 mt-1" size={18} />
                    <span className="leading-tight">
                      {supplier.address || "No Address"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierPage;
