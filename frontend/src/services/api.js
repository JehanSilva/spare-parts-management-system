import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

// Parts API Calls
export const createPart = async (partData) => {
  try {
    const response = await axios.post(`${API_URL}/parts/add/`, partData);
    return response.data;
  } catch (error) {
    console.error("Error creating part:", error);
    throw error;
  }
};

export const fetchParts = async (filters = {}) => {
  try {
    // Builds a query string like ?search=toyota&brand=genuine
    const params = new URLSearchParams(filters).toString();
    const response = await axios.get(`${API_URL}/parts/?${params}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching parts:", error);
    return [];
  }
};

export const updatePart = async (id, data) => {
  const response = await axios.put(`${API_URL}/parts/${id}/update/`, data);
  return response.data;
};

export const deletePart = async (id) => {
  try {
    await axios.delete(`${API_URL}/parts/${id}/delete/`);
  } catch (error) {
    // Pass backend error message (e.g., "Cannot delete part with sales")
    throw error.response?.data?.error || "Delete failed";
  }
};

// Suppliers API Calls
export const createSupplier = async (supplierData) => {
  try {
    const response = await axios.post(`${API_URL}/suppliers/`, supplierData);
    return response.data;
  } catch (error) {
    console.error("Error creating supplier:", error);
    throw error;
  }
};

export const fetchSuppliers = async () => {
  try {
    const response = await axios.get(`${API_URL}/suppliers/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }
};

export const updateSupplier = async (id, data) => {
  const response = await axios.put(`${API_URL}/suppliers/${id}/update/`, data);
  return response.data;
};

export const deleteSupplier = async (id) => {
  await axios.delete(`${API_URL}/suppliers/${id}/delete/`);
};

// Sales API Calls
export const createSale = async (saleData) => {
  try {
    const response = await axios.post(`${API_URL}/sales/create/`, saleData);
    return response.data;
  } catch (error) {
    console.error("Error creating sale:", error);
    throw error;
  }
};

export const fetchSales = async () => {
  try {
    const response = await axios.get(`${API_URL}/sales/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching sales:", error);
    return [];
  }
};

// Vehicles API Calls
export const fetchVehicles = async () => {
  try {
    const response = await axios.get(`${API_URL}/vehicles/`); // Ensure you have this endpoint in Django
    return response.data;
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return [];
  }
};

export const createVehicle = async (vehicleData) => {
  try {
    const response = await axios.post(`${API_URL}/vehicles/add/`, vehicleData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateVehicle = async (id, vehicleData) => {
  try {
    const response = await axios.put(
      `${API_URL}/vehicles/${id}/update/`,
      vehicleData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteVehicle = async (id) => {
  try {
    await axios.delete(`${API_URL}/vehicles/${id}/delete/`);
  } catch (error) {
    throw error;
  }
};

// Dashboard Stats API Call
export const fetchDashboardStats = async () => {
  try {
    const response = await axios.get(`${API_URL}/dashboard/stats/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching stats:", error);
    return null;
  }
};
