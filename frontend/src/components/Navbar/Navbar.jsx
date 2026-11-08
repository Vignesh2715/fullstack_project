import React, { useContext, useState } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
const Navbar = ({ setShowLogin }) => {
  const [menu, setMenu] = useState("menu");

  // const { getTotalCartAmount, token, setToken, setCartItems } =
  //   useContext(StoreContext);
  const { cartItems, token, setToken, setCartItems } = useContext(StoreContext);

  // total number of items in the cart (e.g. 2 pizzas + 1 cake = 3)
  const cartCount = Object.values(cartItems).reduce(
    (total, quantity) => total + quantity,
    0,
  );

  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setCartItems({}); // don't leave the previous user's cart on screen
    navigate("/");
  };
  return (
    <div className="navbar">
      <Link to="/">
        <img src={assets.logo} alt="Food Mate" className="logo" />
      </Link>
      <ul className="navbar-menu">
        <Link
          to="/"
          onClick={() => setMenu("home")}
          className={menu === "home" ? "active" : ""}
        >
          home
        </Link>
        <a
          href="#explore-menu"
          onClick={() => setMenu("menu")}
          className={menu === "menu" ? "active" : ""}
        >
          menu
        </a>
        <a
          href="#app-download"
          onClick={() => setMenu("mobile-app")}
          className={menu === "mobile-app" ? "active" : ""}
        >
          mobile-app
        </a>
        <a
          href="#footer"
          onClick={() => setMenu("contact us")}
          className={menu === "contact us" ? "active" : ""}
        >
          contact us
        </a>
      </ul>
      <div className="navbar-right">
        <img src={assets.search_icon} alt="" />
        <div className="navbar-search-icon">
          {/* <Link to="/cart">
            <img src={assets.basket_icon} alt="" />
          </Link>
          <div className={getTotalCartAmount() === 0 ? "" : "dot"}></div> */}
          <Link to="/cart">
            {/* key={cartCount} restarts the animation every time the count changes */}
            <img
              key={cartCount}
              src={assets.basket_icon}
              alt="Cart"
              className={cartCount > 0 ? "cart-bump" : ""}
            />
          </Link>
          {cartCount > 0 && (
            <span key={cartCount} className="cart-badge">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </div>
        {!token ? (
          <button onClick={() => setShowLogin(true)}>sign in</button>
        ) : (
          <div className="navbar-profile">
            <img src={assets.profile_icon} alt="" />
            <ul className="navbar-profile-dropdown">
              <li onClick={() => navigate("/myorders")}>
                <img src={assets.bag_icon} alt="" />
                <p>Orders</p>
              </li>
              <hr />
              <li onClick={logout}>
                <img src={assets.logout_icon} alt="" />
                <p>Logout</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
