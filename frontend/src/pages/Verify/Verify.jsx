import React, { useContext, useEffect } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
const Verify = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { url, setCartItems } = useContext(StoreContext);
  const navigate = useNavigate();

  const verifyPayment = async () => {
    try {
      // The server asks Stripe whether the order was really paid.
      // (the login token is read straight from localStorage: this page opens fresh after Stripe)
      const response = await axios.post(
        url + "/api/order/verify",
        { orderId },
        { headers: { token: localStorage.getItem("token") || "" } },
      );
      if (response.data.success) {
        setCartItems({}); // the server emptied the saved cart after the payment
        navigate("/myorders");
      } else {
        navigate("/cart");
      }
    } catch (error) {
      console.log(error);
      navigate("/cart");
    }
  };

  useEffect(() => {
    verifyPayment();
  }, []);

  return (
    <div className="verify">
      <div className="spinner"></div>
    </div>
  );
};

export default Verify;
