import "dotenv/config";
import Stripe from "stripe";

// one shared Stripe client for the whole backend
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
