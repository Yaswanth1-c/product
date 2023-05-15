import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import ProductController from "./ProductController";

// Create an express application
const app = express();

// Configure body-parser middleware to parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/store")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Protect the routes that require authorization by adding the middleware function
app.use("/products", ProductController);

app.listen(5000, () => console.log("Server started on port 5000"));
