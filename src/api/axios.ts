import axios from "axios";

const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const API = axios.create({
  baseURL: base,
  withCredentials: true, // tetap aktif untuk dukung cookie kalau nanti dibutuhkan
});

// === Interceptor: tambahkan Authorization token ke setiap request ===
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // ambil dari localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// === Interceptor: auto logout / handle 401 ===
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      console.warn("Token hilang atau tidak valid. Harap login ulang.");
      // (opsional) bisa tambahkan redirect otomatis ke /login:
      // localStorage.removeItem("token");
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;
