import React from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";

const Navbar = ({ onLogout }) => {
  return (
    <div className="navbar">
      <img className="logo" src={assets.logo} alt="Food Mate Admin" />
      <div className="navbar-right">
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
        <img className="profile" src={assets.profile_image} alt="" />
      </div>
    </div>
  );
};

export default Navbar;
