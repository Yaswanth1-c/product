import express, { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { Product, Filters } from "./databasemodel/productsSchema";
import { User } from "./databasemodel/user";
import fs from "fs";
import jwt from "jsonwebtoken";

const router = Router();

// Configure multer middleware to store uploaded files in the uploads directory
const upload = multer({ dest: "uploads/" });

// Middleware to authenticate user using JSON Web Token
const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the token from the Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify the token
    const decoded = jwt.verify(token, "secret") as {
      userId: string;
    };

    // Find the user in the database using the userId from the decoded token
    const user = await User.findById(decoded.userId.split("|")[0]);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Store the user information in res.locals for use in other middleware functions and routes
    res.locals.user = {
      userId: decoded.userId.split("|")[0],
      isAdmin: user.isAdmin,
    };
    console.log(`@@@@@@@`, res.locals.user);
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// Create a new product
router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Read the contents of the uploaded file
    const buffer = fs.readFileSync(file.path);
    const filename = `${file.originalname}`;
    try {
      // Write the contents of the file to the uploads directory
      fs.writeFileSync(`uploads/${filename}`, buffer);

      // Check if the user is an admin before creating a new product
      if (!res.locals.user.isAdmin) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Create a new product object with the image data and request body data
      const newProduct = new Product({
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        image: `${__dirname}/uploads/${filename}`,
      });

      // Save the product to MongoDB
      await newProduct.save();
      res.json({ message: "Product saved successfully" });
    } catch (error) {
      res.status(500).json({ error: "Error saving product to MongoDB" });
    }
  }
);

// Retrieve all products
router.get("/:products", async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Find all products in the MongoDB database with pagination
    const products = await Product.find().skip(skip).limit(limit);

    // Send the products as a JSON response
    res.json(products);
  } catch (error) {
    // Send a 500 error response if there was an error retrieving products from the database
    res.status(500).json({ error: "Error retrieving products from MongoDB" });
  }
});

// Retrieve products with optional query parameters
router.get("/", async (req: Request, res: Response) => {
  try {
    let filters: Filters = {};

    // Check for query parameters and add them to the filter object
    if (req.query.name) {
      filters.name = req.query.name as string;
    }
    if (req.query.description) {
      filters.description = req.query.description as string;
    }
    if (req.query.minPrice) {
      const minPrice = Number(req.query.minPrice);
      if (!isNaN(minPrice)) {
        filters.price = { $gte: minPrice };
      }
    }
    if (req.query.maxPrice) {
      const maxPrice = Number(req.query.maxPrice);
      if (!isNaN(maxPrice)) {
        if (filters.price) {
          filters.price.$lte = maxPrice;
        } else {
          filters.price = { $lte: maxPrice };
        }
      }
    }

    // Set pagination options
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Find all products that match the specified filters
    const products = await Product.find(filters).skip(skip).limit(limit);

    // Count the total number of products that match the specified filters
    const count = await Product.countDocuments(filters);

    // Calculate the total number of pages
    const totalPages = Math.ceil(count / limit);

    // Send the products and pagination data as a JSON response
    res.json({ products, count, totalPages });
  } catch (error) {
    // Send a 500 error response if there was an error retrieving products from the database
    res.status(500).json({ error: "Error retrieving products from MongoDB" });
  }
});

// Retrieve a single product by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    // Find the product with the specified ID in the database
    const product = await Product.findById(req.params.id);
    if (!product) {
      // If the product is not found, send a 404 error response
      res.status(404).json({ error: "Product not found" });
    } else {
      // Send the product as a JSON response
      res.json(product);
    }
  } catch (error) {
    // Send a 500 error response if there was an error retrieving the product from the database
    res.status(500).json({ error: "Error retrieving product from MongoDB" });
  }
});
// Update a product by ID
router.put("/:id", authMiddleware, upload.single("file"), async (req, res) => {
  const { id } = req.params;

  try {
    // Find the product with the given ID
    const product = await Product.findById(id);

    // If the product is not found, return an error response
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if the current user is an admin
    if (!res.locals.user.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Update the product object with the new data
    product.name = req.body.name;
    product.description = req.body.description;
    product.price = req.body.price;

    // Check if there's a new image file
    if (req.file) {
      // Read the contents of the uploaded file
      const buffer = fs.readFileSync(req.file.path);

      // Use the original filename for the uploaded file
      const filename = `${req.file.originalname}`;

      // Write the file to the uploads directory
      fs.writeFileSync(`uploads/${filename}`, buffer);

      // Update the product object with the new image path
      product.image = `${__dirname}/uploads/${filename}`;
    }

    // Save the updated product to MongoDB
    await product.save();

    // Return a success response
    res.json({ message: "Product updated successfully" });
  } catch (error) {
    // If there's an error, return a 500 response with an error message
    res.status(500).json({ error: "Error updating product in MongoDB" });
  }
});

// Delete a product by ID
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Find the product with the given ID and delete it
    const product = await Product.findByIdAndDelete(id);

    // If the product is not found, return an error response
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if the current user is an admin
    if (!res.locals.user.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Return a success response
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    // If there's an error, return a 500 response with an error message
    res.status(500).json({ error: "Error deleting product from MongoDB" });
  }
});

// Export the router for use in other modules
export default router;
