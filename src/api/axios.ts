import axios from "axios";

const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const API = axios.create({
  baseURL: base,
  withCredentials: true, // dukung cookie bila dibutuhkan
});

// === Interceptor: tambahkan Authorization token ke setiap request ===
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // ambil dari localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// === Interceptor: validasi response ===
API.interceptors.response.use(
  (res) => {
    const ct = res.headers["content-type"] || "";
    // Kalau backend balas HTML (biasanya error proxy), lempar error khusus
    if (!ct.includes("application/json")) {
      throw new Error(
        `Expected JSON but got ${ct}. URL: ${res.config?.url}`
      );
    }
    return res;
  },
  (error) => {
    if (error?.response?.status === 401) {
      console.warn("Token hilang atau tidak valid. Harap login ulang.");
      // opsional: redirect otomatis
      // localStorage.removeItem("token");
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;
