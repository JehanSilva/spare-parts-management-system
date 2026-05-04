import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
// Create a customized axios instance
const API = axios.create({ baseURL: API_URL });

// --- INTERCEPTOR: Automatically add Token to every request ---
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// --- INTERCEPTOR: Handle 401 Unauthorized (Auto Logout) ---
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      logoutUser();
    }
    return Promise.reject(error);
  }
);

// --- AUTH SERVICES ---
export const loginUser = async (username, password) => {
  try {
    const response = await axios.post(`${API_URL}/token/`, {
      username,
      password,
    });
    // Save tokens to browser storage
    localStorage.setItem("access_token", response.data.access);
    localStorage.setItem("refresh_token", response.data.refresh);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Login failed";
  }
};

export const logoutUser = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
};

// --- DATA SERVICES (Updated to use the 'API' instance) ---
export const fetchParts = async (params) => {
  // 'params' will be { search: '...', brand: '...' }
  // axios automatically turns this into ?search=...&brand=...
  const response = await API.get("/parts/", { params });
  return response.data;
};
export const createPart = async (data) =>
  (await API.post("/parts/add/", data)).data;
export const bulkUploadParts = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return (await API.post("/parts/bulk-upload/", formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data;
};
export const updatePart = async (id, data) =>
  (await API.put(`/parts/${id}/update/`, data)).data;
export const deletePart = async (id) =>
  await API.delete(`/parts/${id}/delete/`);
export const restockPart = async (id, data) =>
  (await API.post(`/parts/${id}/restock/`, data)).data;


export const fetchSuppliers = async () => (await API.get("/suppliers/")).data;
export const createSupplier = async (data) =>
  (await API.post("/suppliers/add/", data)).data;
export const updateSupplier = async (id, data) =>
  (await API.put(`/suppliers/${id}/update/`, data)).data;
export const deleteSupplier = async (id) =>
  await API.delete(`/suppliers/${id}/delete/`);

export const fetchVehicles = async () => (await API.get("/vehicles/")).data;
export const createVehicle = async (data) =>
  (await API.post("/vehicles/add/", data)).data;
export const updateVehicle = async (id, data) =>
  (await API.put(`/vehicles/${id}/update/`, data)).data;
export const deleteVehicle = async (id) =>
  await API.delete(`/vehicles/${id}/delete/`);

export const createSale = async (data) =>
  (await API.post("/sales/create/", data)).data;
export const fetchSales = async () => (await API.get("/sales/")).data;
export const updateSale = async (id, data) =>
  (await API.patch(`/sales/${id}/update/`, data)).data;
export const cancelSale = async (id) =>
  (await API.post(`/sales/${id}/cancel/`)).data;
export const fetchDashboardStats = async (period = 'all') =>
  (await API.get("/dashboard/stats/", { params: { period } })).data;
export const fetchDailyReport = async (date) =>
  (await API.get("/reports/daily/", { params: { date } })).data;

export default API;
