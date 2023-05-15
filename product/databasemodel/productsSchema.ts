import mongoose from "mongoose";

// Define a schema for the product model
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  image: String,
});


interface Filters {
  name?: string;
  description?: string;
  price?: { $gte?: number; $lte?: number };
}

// Create a model based on the schema
const Product = mongoose.model("Product", productSchema);

export { Product, Filters };
