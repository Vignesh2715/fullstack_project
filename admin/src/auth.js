import axios from "axios";

// Keeps the admin login token: in localStorage, and as a default header on every request.
const KEY = "adminToken";

export const getToken = () => localStorage.getItem(KEY) || "";

export const saveToken = (token) => {
  localStorage.setItem(KEY, token);
  axios.defaults.headers.common.token = token;
};

export const clearToken = () => {
  localStorage.removeItem(KEY);
  delete axios.defaults.headers.common.token;
};

// use the saved token straight away when the page opens
if (getToken()) {
  axios.defaults.headers.common.token = getToken();
}

// if the server says "not logged in" or "not an admin" (expired token, role removed),
// log out and show the login screen again
axios.interceptors.response.use((response) => {
  const code = response.data && response.data.code;
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") {
    clearToken();
    sessionStorage.setItem("adminLoggedOut", "Please login again");
    window.location.reload();
  }
  return response;
});
