import React, { useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/Sidebar/Sidebar";
import { Route, Routes } from "react-router-dom";
import Orders from "./pages/Orders/Orders";
import Add from "./pages/Add/Add";
import List from "./pages/List/List";
import Login from "./pages/Login/Login";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { url } from "./assets/assets";
import { getToken, saveToken, clearToken } from "./auth";

const App = () => {
  const [token, setToken] = useState(getToken());

  const handleLogin = (newToken) => {
    saveToken(newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    clearToken();
    setToken("");
  };

  // nobody sees the admin pages without logging in
  if (!token) {
    return (
      <div>
        <ToastContainer />
        <Login url={url} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div>
      <ToastContainer />
      <Navbar onLogout={handleLogout} />
      <hr />
      <div className="app-content">
        <Sidebar />
        <Routes>
          <Route path="/add" element={<Add url={url} />} />
          <Route path="/list" element={<List url={url} />} />
          <Route path="/orders" element={<Orders url={url} />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
