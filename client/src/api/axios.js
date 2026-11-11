import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SERVER_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // browser cookie bhejega aur lega
});

// 401 par logout (login aur session-check ko chhod ke)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const skip = url.includes("/auth/login") || url.includes("/auth/me");
    if (error.response?.status === 401 && !skip) {
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

export default api;
