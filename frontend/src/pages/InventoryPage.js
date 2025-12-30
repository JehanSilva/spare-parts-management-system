import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Filter,
  AlertTriangle,
  Package,
  MapPin,
} from "lucide-react";
import { fetchParts, fetchSuppliers } from "../services/api"; // Ensure api.js is in src/services/
import AddPartForm from "../components/forms/AddPartForm";

const InventoryPage = () => {
  const [parts, setParts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const partsData = await fetchParts();
    const suppliersData = await fetchSuppliers();
    setParts(partsData);
    setSuppliers(suppliersData);
    setLoading(false);
  };

  // Handle Search/Filter
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    const filters = {
      search: searchTerm,
      brand: selectedBrand,
      supplier: selectedSupplier,
    };
    const filteredParts = await fetchParts(filters);
    setParts(filteredParts);
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-red-900 flex items-center gap-2">
            <Package className="w-8 h-8" /> Inventory Management
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage spare parts, stock levels, and prices.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-lg shadow hover:bg-red-700 transition flex items-center justify-center gap-2 font-bold"
        >
          {showForm ? (
            "Close Form"
          ) : (
            <>
              <Plus size={20} /> Add New Part
            </>
          )}
        </button>
      </div>

      {/* Add Part Form (Collapsible) */}
      {showForm && (
        <div className="mb-8 animate-fade-in-down">
          <AddPartForm
            onPartAdded={() => {
              setShowForm(false);
              loadData();
            }}
          />
        </div>
      )}

      {/* Search & Filter Bar */}
      <form
        onSubmit={handleSearch}
        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        {/* Text Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by Name or Part Number..."
            className="w-full pl-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Brand Filter */}
        <input
          type="text"
          placeholder="Filter by Brand (e.g. Toyota)"
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:outline-none"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        />

        {/* Submit Button */}
        <button
          type="submit"
          className="bg-gray-800 text-white p-2 rounded hover:bg-gray-900 flex items-center justify-center gap-2"
        >
          <Filter size={18} /> Apply Filters
        </button>
      </form>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          Loading Inventory...
        </div>
      ) : (
        /* Parts Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {parts.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded shadow">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">
                No parts found matching your criteria.
              </p>
            </div>
          ) : (
            parts.map((part) => (
              <div
                key={part.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col"
              >
                {/* Image Section */}
                <div className="h-48 bg-gray-100 relative">
                  {part.image_url ? (
                    <img
                      src={part.image_url}
                      alt={part.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Package size={48} opacity={0.2} />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className="absolute top-2 right-2">
                    {part.stock_qty <= part.min_stock_level ? (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow">
                        <AlertTriangle size={12} /> Low Stock
                      </span>
                    ) : (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                        In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h2 className="text-lg font-bold text-gray-800 leading-tight">
                      {part.name}
                    </h2>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <span className="bg-red-50 text-red-800 text-xs font-semibold px-2 py-0.5 rounded border border-red-100">
                      {part.brand || "No Brand"}
                    </span>
                    <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-0.5 rounded border border-gray-200">
                      {part.part_number}
                    </span>
                  </div>

                  {/* Location & Supplier */}
                  <div className="space-y-1 mb-4 flex-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {part.rack_location}
                    </p>
                    <p
                      className="text-xs text-gray-500 truncate"
                      title={part.supplier_details?.name}
                    >
                      Sup: {part.supplier_details?.name || "Unknown"}
                    </p>
                  </div>

                  {/* Price Footer */}
                  <div className="flex justify-between items-end border-t border-gray-100 pt-3 mt-auto">
                    <div>
                      <p className="text-xs text-gray-400">
                        Buying: ${part.buy_price}
                      </p>
                      <p className="text-xl font-bold text-red-700">
                        ${part.sell_price}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Qty</p>
                      <span
                        className={`font-bold text-lg ${
                          part.stock_qty <= part.min_stock_level
                            ? "text-red-600"
                            : "text-gray-800"
                        }`}
                      >
                        {part.stock_qty}
                      </span>
                    </div>
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

export default InventoryPage;
