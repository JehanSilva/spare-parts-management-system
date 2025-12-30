import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import InventoryPage from "./pages/InventoryPage";
import AddVehicleForm from "./components/forms/AddVehicleForm";
import SupplierPage from "./pages/SupplierPage";
import POSPage from "./pages/POSPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="container mx-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/suppliers" element={<SupplierPage />} />
            <Route path="/vehicles" element={<AddVehicleForm />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
