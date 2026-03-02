require('dotenv').config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI || "mongodb+srv://devsamuel404_db_user:PAZFYKT116gkK0Zi@sneakerverse.q4bk4ny.mongodb.net/DevSite?retryWrites=true&w=majority";

// Middleware
app.use(express.json());

/* ========================= CORS MIDDLEWARE ========================= */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://sams-dev-proj.vercel.app",
  "https://sams-dev-proj-git-main-samuelmbayas-projects.vercel.app",
  "https://sams-dev-proj-er2q1po6e-samuelmbayas-projects.vercel.app",
  "https://shoenationrsa.netlify.app",
];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return cb(null, true);
    }
    return cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

let client;
let db;

async function connectToMongo() {
  try {
    if (db) return db;
    
    // Remove deprecated options - they're not needed in newer MongoDB driver versions
    client = new MongoClient(uri);
    
    await client.connect();
    db = client.db("SneakerVerse");
    console.log("✅ Connected to MongoDB (SneakerVerse)");
    
    // Create indexes for better performance
    try {
      await db.collection("Users").createIndex({ email: 1 }, { unique: true });
    } catch (indexError) {
      // Index might already exist, ignore error
      console.log("Note: Email index may already exist");
    }
    
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    mongodb: db ? "connected" : "disconnected"
  });
});

/* ========================= USERS CRUD ========================= */
// Get all users
app.get("/users", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const users = await db.collection("Users").find().toArray();
    // Remove passwords from response
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.status(200).json({ message: "Users fetched successfully", data: usersWithoutPasswords });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get user by ID
app.get("/users/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const user = await db.collection("Users").findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.status(200).json({ data: userWithoutPassword });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create user
app.post("/users", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password required" });
    }

    const result = await db.collection("Users").insertOne({
      name,
      email: email.toLowerCase(),
      password: Buffer.from(password).toString('base64'),
      createdAt: new Date()
    });

    res.status(201).json({ 
      message: "User created", 
      id: result.insertedId 
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user
app.put("/users/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.status(200).json({ message: "User updated" });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Users").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ========================= AUTH ROUTES ========================= */

// SIGNUP
app.post('/signup', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected. Please try again." });
    }

    const { name, email, password, confirmPassword } = req.body;
    console.log("Signup attempt for email:", email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const collection = db.collection("Users");
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await collection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create new user
    const newUser = {
      name: name || "",
      email: normalizedEmail,
      password: Buffer.from(password).toString('base64'),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newUser);
    console.log("User created successfully with ID:", result.insertedId);

    res.status(201).json({
      message: "Account created successfully",
      userId: result.insertedId,
      email: normalizedEmail,
      name: name || ""
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// SIGNIN
app.post('/signin', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: "Database not connected. Please try again." });
    }

    const { email, password } = req.body;
    console.log("Signin attempt for email:", email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const encodedPassword = Buffer.from(password).toString('base64');
    const user = await db.collection('Users').findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user || user.password !== encodedPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log("User signed in successfully:", user.email);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

/* ========================= PRODUCTS CRUD ========================= */

app.get("/products", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { category } = req.query;
    const collection = db.collection("Products");

    let products;
    if (category && category.toLowerCase() !== "all") {
      products = await collection.find({ 
        category: { $regex: new RegExp(category, "i") } 
      }).toArray();
    } else {
      products = await collection.find().toArray();
    }

    res.status(200).json({ message: "Products fetched successfully", data: products });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const product = await db.collection("Products").findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.status(200).json({ data: product });
  } catch (error) {
    console.error("Failed to fetch product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.post("/products", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { name, price, category, image, description } = req.body;
    if (!name || !price || !category) {
      return res.status(400).json({ error: "Name, price, and category required" });
    }

    const result = await db.collection("Products").insertOne({
      name,
      price: parseFloat(price),
      category,
      image: image || "",
      description: description || "",
      createdAt: new Date()
    });

    res.status(201).json({ message: "Product created", id: result.insertedId });
  } catch (error) {
    console.error("Failed to create product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Products").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.status(200).json({ message: "Product updated" });
  } catch (error) {
    console.error("Failed to update product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Products").deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.status(200).json({ message: "Product deleted" });
  } catch (error) {
    console.error("Failed to delete product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

/* ========================= CART CRUD ========================= */

app.get("/cart", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { userId } = req.query;
    let query = {};
    if (userId) {
      query.userId = userId;
    }
    
    const cartItems = await db.collection("Cart").find(query).toArray();
    res.status(200).json({ message: "Cart fetched successfully", data: cartItems });
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

app.get("/cart/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const item = await db.collection("Cart").findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    res.status(200).json({ data: item });
  } catch (error) {
    console.error("Failed to fetch cart item:", error);
    res.status(500).json({ error: "Failed to fetch cart item" });
  }
});

app.post("/cart", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { productId, quantity, userId } = req.body;
    if (!productId || !quantity || !userId) {
      return res.status(400).json({ error: "productId, quantity, and userId required" });
    }

    // Check if item already in cart
    const existingItem = await db.collection("Cart").findOne({
      productId,
      userId
    });

    if (existingItem) {
      // Update quantity
      const result = await db.collection("Cart").updateOne(
        { _id: existingItem._id },
        { $set: { quantity: existingItem.quantity + parseInt(quantity), updatedAt: new Date() } }
      );
      return res.status(200).json({ message: "Cart item updated", id: existingItem._id });
    }

    // Add new item
    const result = await db.collection("Cart").insertOne({
      productId,
      quantity: parseInt(quantity),
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({ message: "Item added to cart", id: result.insertedId });
  } catch (error) {
    console.error("Failed to add cart item:", error);
    res.status(500).json({ error: "Failed to add cart item" });
  }
});

app.put("/cart/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Cart").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    res.status(200).json({ message: "Cart item updated" });
  } catch (error) {
    console.error("Failed to update cart item:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

app.delete("/cart/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Cart").deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    
    res.status(200).json({ message: "Cart item deleted" });
  } catch (error) {
    console.error("Failed to delete cart item:", error);
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

// Clear user's cart
app.delete("/cart/user/:userId", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Cart").deleteMany({ 
      userId: req.params.userId
    });
    
    res.status(200).json({ message: "Cart cleared", count: result.deletedCount });
  } catch (error) {
    console.error("Failed to clear cart:", error);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

/* ========================= ORDERS CRUD ========================= */

app.get("/orders", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { userId } = req.query;
    let query = {};
    if (userId) {
      query.userId = userId;
    }
    
    const orders = await db.collection("Orders").find(query).sort({ createdAt: -1 }).toArray();
    res.status(200).json({ message: "Orders fetched successfully", data: orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const order = await db.collection("Orders").findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.status(200).json({ data: order });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post("/orders", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const { userId, items, totalAmount, shippingAddress, paymentMethod } = req.body;
    if (!userId || !items || !totalAmount) {
      return res.status(400).json({ error: "userId, items, and totalAmount required" });
    }

    const result = await db.collection("Orders").insertOne({
      userId,
      items,
      totalAmount: parseFloat(totalAmount),
      shippingAddress: shippingAddress || {},
      paymentMethod: paymentMethod || "cash",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Clear user's cart after order is placed
    await db.collection("Cart").deleteMany({ userId });

    res.status(201).json({ message: "Order created", id: result.insertedId });
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Orders").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.status(200).json({ message: "Order updated" });
  } catch (error) {
    console.error("Failed to update order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    
    const result = await db.collection("Orders").deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    res.status(200).json({ message: "Order deleted" });
  } catch (error) {
    console.error("Failed to delete order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ========================= START SERVER ========================= */
// Define and call the connect function
async function startServer() {
  try {
    await connectToMongo();
    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://0.0.0.0:${port}`);
      console.log(`📝 Health check: http://0.0.0.0:${port}/health`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});