import React, { useState, useEffect } from "react";
import { fetchSuppliers, createPart } from "../../services/api";

const AddPartForm = ({ onPartAdded }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    part_number: "",
    brand: "",
    supplier: "", // This will send the Supplier ID
    buy_price: "",
    sell_price: "",
    stock_qty: "",
    min_stock_level: 5,
    rack_location: "",
    description: "",
    image_url: "", // For now, we paste a link
  });

  // Load suppliers when the form opens
  useEffect(() => {
    const loadSuppliers = async () => {
      const data = await fetchSuppliers();
      setSuppliers(data);
    };
    loadSuppliers();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createPart(formData);
      alert("Part added successfully!");
      // Reset form
      setFormData({
        name: "",
        part_number: "",
        brand: "",
        supplier: "",
        buy_price: "",
        sell_price: "",
        stock_qty: "",
        min_stock_level: 5,
        rack_location: "",
        description: "",
        image_url: "",
      });
      // Refresh the main list
      if (onPartAdded) onPartAdded();
    } catch (error) {
      alert("Failed to add part. Check console for details.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Add New Spare Part
      </h2>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Row 1 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Part Name
          </label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="e.g. Brake Pad"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Part Number (OEM)
          </label>
          <input
            name="part_number"
            value={formData.part_number}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
          />
        </div>

        {/* Row 2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Brand
          </label>
          <input
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="e.g. Toyota Genuine"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Supplier
          </label>
          <select
            name="supplier"
            value={formData.supplier}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white"
          >
            <option value="">Select a Supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Row 3 - Prices */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Buy Price
          </label>
          <input
            type="number"
            name="buy_price"
            value={formData.buy_price}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sell Price
          </label>
          <input
            type="number"
            name="sell_price"
            value={formData.sell_price}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
          />
        </div>

        {/* Row 4 - Inventory */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Initial Stock
          </label>
          <input
            type="number"
            name="stock_qty"
            value={formData.stock_qty}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rack Location
          </label>
          <input
            name="rack_location"
            value={formData.rack_location}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="e.g. Aisle 3, Shelf B"
          />
        </div>

        {/* Row 5 - Image (Full Width) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Image URL
          </label>
          <input
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            placeholder="https://example.com/part-image.jpg"
          />
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Save Part
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPartForm;
