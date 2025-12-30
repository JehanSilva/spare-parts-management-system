import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

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

export const fetchSuppliers = async () => {
  try {
    const response = await axios.get(`${API_URL}/suppliers/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return [];
  }
};

export const createPart = async (partData) => {
  try {
    const response = await axios.post(`${API_URL}/parts/add/`, partData);
    return response.data;
  } catch (error) {
    console.error("Error creating part:", error);
    throw error;
  }
};
