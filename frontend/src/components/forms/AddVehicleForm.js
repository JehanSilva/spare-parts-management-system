import React, { useState } from "react";
import axios from "axios";

const AddVehicleForm = () => {
  const [data, setData] = useState({ make: "", model: "", year: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure you create this endpoint in Django later!
      await axios.post("http://127.0.0.1:8000/api/vehicles/add/", data);
      alert("Vehicle Added!");
      setData({ make: "", model: "", year: "" });
    } catch (error) {
      alert("Error adding vehicle");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded shadow max-w-md mx-auto mt-10"
    >
      <h2 className="text-xl font-bold mb-4">Add New Vehicle Model</h2>
      <div className="space-y-4">
        <input
          placeholder="Make (e.g. Toyota)"
          value={data.make}
          onChange={(e) => setData({ ...data, make: e.target.value })}
          className="w-full border p-2 rounded"
          required
        />
        <input
          placeholder="Model (e.g. Corolla)"
          value={data.model}
          onChange={(e) => setData({ ...data, model: e.target.value })}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="number"
          placeholder="Year (e.g. 2024)"
          value={data.year}
          onChange={(e) => setData({ ...data, year: e.target.value })}
          className="w-full border p-2 rounded"
          required
        />
        <button className="w-full bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700">
          Save Vehicle
        </button>
      </div>
    </form>
  );
};

export default AddVehicleForm;
