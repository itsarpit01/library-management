import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
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