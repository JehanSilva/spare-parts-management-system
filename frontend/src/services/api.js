import axios from "axios";

// Falls back to the hostname the page was loaded from (e.g. a LAN IP when
// accessing the dev server from a phone) instead of a hardcoded localhost,
// so REACT_APP_API_URL only needs to be set explicitly for prod deploys.
const API_URL =
  process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000/api`;
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
export const restockPart = async (id, entries) =>
  (await API.post(`/parts/${id}/restock/`, { entries })).data;
export const fetchRestockHistory = async (id) =>
  (await API.get(`/parts/${id}/restock-history/`)).data;
export const returnRestockRecord = async (partId, recordId, data) =>
  (await API.post(`/parts/${partId}/restock/${recordId}/return/`, data)).data;
export const editRestockRecord = async (partId, recordId, data) =>
  (await API.put(`/parts/${partId}/restock/${recordId}/edit/`, data)).data;


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
export const cancelSale = async (id, data) =>
  (await API.post(`/sales/${id}/cancel/`, data)).data;
export const markSaleAsPaid = async (id, amount) =>
  (await API.post(`/sales/${id}/mark-paid/`, amount != null ? { amount } : {})).data;
export const fetchDashboardStats = async (period = 'all') =>
  (await API.get("/dashboard/stats/", { params: { period } })).data;
export const fetchDailyReport = async (date) =>
  (await API.get("/reports/daily/", { params: { date } })).data;

export const fetchActiveCarts = async () => (await API.get("/active-carts/")).data;
export const syncActiveCarts = async (data) => (await API.post("/active-carts/sync/", data)).data;

// --- EMPLOYEE SERVICES ---
export const fetchEmployees = async () => (await API.get("/employees/")).data;
export const createEmployee = async (data) => (await API.post("/employees/add/", data)).data;
export const updateEmployee = async (id, data) => (await API.put(`/employees/${id}/update/`, data)).data;
export const deleteEmployee = async (id) => await API.delete(`/employees/${id}/delete/`);
export const fetchEmployeeAttendance = async (empId, month, year) =>
  (await API.get(`/employees/${empId}/attendance/`, { params: { month, year } })).data;

// --- ATTENDANCE SERVICES ---
export const fetchAttendanceSheet = async (date) => (await API.get("/attendance/", { params: { date } })).data;
export const markAttendanceSheet = async (data) => (await API.post("/attendance/mark/", data)).data;

// --- HOLIDAY SERVICES ---
export const fetchHolidays = async () => (await API.get("/holidays/")).data;
export const createHoliday = async (data) => (await API.post("/holidays/add/", data)).data;
export const deleteHoliday = async (id) => await API.delete(`/holidays/${id}/delete/`);

// --- PAYROLL SERVICES ---
export const fetchPayroll = async (month, year) => (await API.get("/payroll/", { params: { month, year } })).data;
export const generatePayrollDrafts = async (data) => (await API.post("/payroll/generate/", data)).data;
export const updatePayroll = async (id, data) => (await API.put(`/payroll/${id}/update/`, data)).data;
export const payPayroll = async (id) => (await API.post(`/payroll/${id}/pay/`)).data;

// --- CUSTOMER SERVICES ---
export const fetchCustomers = async (search = '') => (await API.get("/customers/", { params: search ? { search } : {} })).data;
export const createCustomer = async (data) => (await API.post("/customers/add/", data)).data;
export const updateCustomer = async (id, data) => (await API.put(`/customers/${id}/update/`, data)).data;
export const deleteCustomer = async (id) => await API.delete(`/customers/${id}/delete/`);
export const lookupCustomerByVehicle = async (vehicleNumber) =>
  (await API.get("/customers/lookup/", { params: { vehicle_number: vehicleNumber } })).data;
export const addVehicleToCustomer = async (customerId, data) =>
  (await API.post(`/customers/${customerId}/vehicles/add/`, data)).data;
export const deleteCustomerVehicle = async (vehicleId) =>
  await API.delete(`/customers/vehicles/${vehicleId}/delete/`);
export const updateCustomerVehicle = async (vehicleId, data) =>
  (await API.patch(`/customers/vehicles/${vehicleId}/update/`, data)).data;

export default API;
