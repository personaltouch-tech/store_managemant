import axios from "axios";

// const api = axios.create({
//     baseURL: "https://storemanagemant-production.up.railway.app",
// });
const api = axios.create({
    baseURL: "http://127.0.0.1:8000",
});

api.interceptors.request.use(config => {
    const token = sessionStorage.getItem("token"); // ← changed
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("admin");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;