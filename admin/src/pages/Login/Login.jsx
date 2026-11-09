import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { assets } from "../../assets/assets";
import "./Login.css";

const Login = ({ url, onLogin }) => {
  const [data, setData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // message left behind by an automatic logout
  useEffect(() => {
    const message = sessionStorage.getItem("adminLoggedOut");
    if (message) {
      toast.info(message);
      sessionStorage.removeItem("adminLoggedOut");
    }
  }, []);

  const onChangeHandler = (event) => {
    setData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(url + "/api/user/admin/login", data);
      if (response.data.success) {
        onLogin(response.data.token);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error("Cannot reach the server");
    }
    setLoading(false);
  };

  return (
    <div className="admin-login">
      <form onSubmit={onSubmit} className="admin-login-box">
        <img className="admin-login-logo" src={assets.logo} alt="Food Mate Admin" />
        <h2>Admin Login</h2>
        <input
          name="email"
          type="email"
          placeholder="Admin email"
          value={data.email}
          onChange={onChangeHandler}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={data.password}
          onChange={onChangeHandler}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
