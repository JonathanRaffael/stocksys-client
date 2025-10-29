import axios from "axios";

// ✅ Base URL: pakai ENV; kalau kosong dan build production → fallback ke Railway
const base =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? "https://stocksys-production.up.railway.app/api"
    : "http://localhost:3001/api");

console.log("API baseURL:", base); // debug

const API = axios.create({
  baseURL: base,
  withCredentials: true, // dukung cookie bila dibutuhkan
});

// === Interceptor: tambahkan Authorization token ke setiap request ===
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// === Interceptor: validasi response ===
API.interceptors.response.use(
  (res) => {
    const ct = res.headers["content-type"] || "";
    if (!ct.includes("application/json")) {
      throw new Error(`Expected JSON but got ${ct}. URL: ${res.config?.url}`);
    }
    return res;
  },
  (error) => {
    if (error?.response?.status === 401) {
      console.warn("Token hilang atau tidak valid. Harap login ulang.");
    }
    return Promise.reject(error);
  }
);

export default API;
