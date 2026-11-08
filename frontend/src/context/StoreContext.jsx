import { createContext, useEffect, useState } from "react";
import axios from "axios";
export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const [cartItems, setCartItems] = useState({});

  const [food_list, setFoodList] = useState([]);

  // backend link: set VITE_API_URL on Vercel, falls back to localhost for development
  const url = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
  const [token, setToken] = useState("");

  // new images are full Cloudinary links, old ones are file names on the backend
  const imageSrc = (image) =>
    image && image.startsWith("http") ? image : `${url}/images/${image}`;

  // const addToCart = (itemId) => {
  //   if (!cartItems[itemId]) {
  //     setCartItems((prev) => ({ ...prev, [itemId]: 1 }));
  //   } else {
  //     setCartItems((prev) => ({ ...prev, [itemId]: prev[itemId] + 1 }));
  //   }
  // };

  const addToCart = async (itemId) => {
    setCartItems((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));

    if (token) {
      await axios.post(
        url + "/api/cart/add",
        { itemId },
        { headers: { token } },
      );
    }
  };

  // const removeFromCart = (itemId) => {
  //   setCartItems((prev) => ({ ...prev, [itemId]: prev[itemId] - 1 }));
  // };

  const removeFromCart = async (itemId) => {
    if (token) {
      await axios.post(
        url + "/api/cart/remove",
        { itemId },
        { headers: { token } },
      );
    }

    setCartItems((prev) => {
      if (prev[itemId] <= 1) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }

      return {
        ...prev,
        [itemId]: prev[itemId] - 1,
      };
    });
  };

  const getTotalCartAmount = () => {
    let totalAmount = 0;
    for (const item in cartItems) {
      if (cartItems[item]) {
        let itemInfo = food_list.find((product) => product._id === item);
        if (itemInfo) {
          totalAmount += itemInfo.price * cartItems[item];
        }
      }
    }
    return totalAmount;
  };

  // const fetchFoodList = async () => {
  //   const response = await axios.get(url + "/api/food/list");
  //   setFoodList(response.data.data);
  // };

  const fetchFoodList = async () => {
    try {
      const response = await axios.get(url + "/api/food/list");

      if (response.data.success) {
        setFoodList(response.data.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const loadCartData = async (authToken) => {
    try {
      const response = await axios.post(
        url + "/api/cart/get",
        {},
        { headers: { token: authToken } },
      );

      if (response.data.success) {
        setCartItems(response.data.cartData || {});
      } else {
        // expired / invalid token: log out cleanly instead of crashing the page
        localStorage.removeItem("token");
        setToken("");
        setCartItems({});
      }
    } catch (error) {
      console.log(error);
    }
  };

  // const storedToken = localStorage.getItem("token");

  // useEffect(() => {
  //   async function loadData() {
  //     await fetchFoodList();
  //     if (storedToken) {
  //       setToken(storedToken);
  //     }
  //   }
  //   loadData();
  // }, []);

  useEffect(() => {
    fetchFoodList();

    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // load the saved cart on page refresh AND right after login
  useEffect(() => {
    if (token) {
      loadCartData(token);
    }
  }, [token]);

  const contextValue = {
    food_list,
    cartItems,
    setCartItems,
    addToCart,
    removeFromCart,
    getTotalCartAmount,
    url,
    imageSrc,
    token,
    setToken,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreContextProvider;
