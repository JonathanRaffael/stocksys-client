import axios from "axios";

// pakai ENV saat build
const BASE_URL = import.meta.env.VITE_API_BASE; // <-- wajib ada di Vercel

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
