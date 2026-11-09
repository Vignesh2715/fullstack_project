// Business rules live on the SERVER, so the browser can never change them.
export const DELIVERY_FEE = 2; // dollars, added once per order
export const INR_PER_USD = 90; // menu is shown in $, Stripe charges in INR
export const MAX_QTY_PER_ITEM = 50;

// must match the options in the admin panel "Orders" dropdown
export const ORDER_STATUSES = ["Food Processing", "Out for Delivery", "Delivered"];

export const ADDRESS_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "street",
  "city",
  "state",
  "zipcode",
  "country",
  "phone",
];
