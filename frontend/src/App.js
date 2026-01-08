import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import InventoryPage from "./pages/InventoryPage";
import VehiclePage from "./pages/VehiclePage"; // <--- ADD THIS
import SupplierPage from "./pages/SupplierPage";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";

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
            <Route path="/vehicles" element={<VehiclePage />} />
            <Route path="/sales-history" element={<SalesHistoryPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
