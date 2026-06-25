import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import InventoryPage from "./pages/InventoryPage";
import VehiclePage from "./pages/VehiclePage";
import SupplierPage from "./pages/SupplierPage";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import LoginPage from "./pages/LoginPage";
import EmployeePage from "./pages/EmployeePage";
import DailyReportPage from "./pages/DailyReportPage";
import PrivateRoute from "./components/PrivateRoute";
import useAutoLogout from "./hooks/useAutoLogout";
import { PartsProvider } from "./context/PartsContext";

// Helper component to hide Navbar on Login page
const Layout = ({ children }) => {
  const location = useLocation();
  // Don't show Navbar if we are on /login
  if (location.pathname === "/login") {
    return children;
  }
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="container mx-auto">{children}</div>
    </div>
  );
};

function App() {
  useAutoLogout();
  return (
    <Router>
      <PartsProvider>
        <Layout>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <HomePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <PrivateRoute>
                <POSPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <PrivateRoute>
                <InventoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <PrivateRoute>
                <SupplierPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/vehicles"
            element={
              <PrivateRoute>
                <VehiclePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <PrivateRoute>
                <EmployeePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/sales-history"
            element={
              <PrivateRoute>
                <SalesHistoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/daily-report"
            element={
              <PrivateRoute>
                <DailyReportPage />
              </PrivateRoute>
            }
          />
        </Routes>
        </Layout>
      </PartsProvider>
    </Router>
  );
}

export default App;
