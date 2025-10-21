require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://fishcmelly_db_user:lUWKKXnWelnHGeLB@developmnetproject.lqy9l4q.mongodb.net/DevSite?retryWrites=true&w=majority";

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'sams-dev-proj.vercel.app',
    'sams-dev-proj-git-main-samuelmbayas-projects.vercel.app',
    "sams-dev-proj-git-main-samuelmbayas-projects.vercel.app",
    'sams-dev-proj-er2q1po6e-samuelmbayas-projects.vercel.app'
  ],
  credentials: true
}));

let client, db;

async function connectToMongo() {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("SneakerVerse");
  console.log("✅ Connected to MongoDB (SneakerVerse)");
}

/* ========================= USERS CRUD ========================= */

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await db.collection("Users").find().toArray();
    res.status(200).json({ message: "Users fetched successfully", data: users });
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get user by ID
app.get("/users/:id", async (req, res) => {
  try {
    const user = await db.collection("Users").findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ data: user });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create user (basic, optional for admin use)
app.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email, and password required" });

    const result = await db.collection("Users").insertOne({
      name,
      email: email.toLowerCase(),
      password,
      createdAt: new Date()
    });

    res.status(201).json({ message: "User created", id: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user
app.put("/users/:id", async (req, res) => {
  try {
    const result = await db.collection("Users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ message: "User updated" });
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    const result = await db.collection("Users").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ message: "User deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ========================= AUTH ROUTES ========================= */

// SIGNUP
app.post('/signup', async (req, res) => {
  try {
    const user = req.body;

    if (!user.email || !user.password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (user.password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (user.password !== user.confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const collection = db.collection("Users");
    const normalizedEmail = user.email.toLowerCase();

    const existingUser = await collection.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    const newUser = {
      name: user.name || "",
      email: normalizedEmail,
      password: Buffer.from(user.password).toString('base64'),
      createdAt: new Date()
    };

    const result = await collection.insertOne(newUser);

    res.status(201).json({
      message: "User created successfully",
      userId: result.insertedId
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// SIGNIN
app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const encodedPassword = Buffer.from(password).toString('base64');
    const user = await db.collection('Users').findOne({ email: email.toLowerCase() });

    if (!user || user.password !== encodedPassword)
      return res.status(401).json({ error: 'Invalid email or password' });

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
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ========================= PRODUCTS CRUD ========================= */

app.get("/products", async (req, res) => {
  try {
    const { category } = req.query;
    const collection = db.collection("Products");

    let products;
    if (category && category.toLowerCase() !== "all") {
      products = await collection.find({ category: { $regex: new RegExp(category, "i") } }).toArray();
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
    const product = await db.collection("Products").findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ data: product });
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.post("/products", async (req, res) => {
  try {
    const { name, price, category } = req.body;
    if (!name || !price || !category)
      return res.status(400).json({ error: "Name, price, and category required" });

    const result = await db.collection("Products").insertOne({
      name,
      price: parseFloat(price),
      category,
      createdAt: new Date()
    });

    res.status(201).json({ message: "Product created", id: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    const result = await db.collection("Products").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ message: "Product updated" });
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const result = await db.collection("Products").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Product not found" });
    res.status(200).json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

/* ========================= CART CRUD ========================= */

app.get("/cart", async (req, res) => {
  try {
    const cartItems = await db.collection("Cart").find().toArray();
    res.status(200).json({ message: "Cart fetched successfully", data: cartItems });
  } catch {
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

app.get("/cart/:id", async (req, res) => {
  try {
    const item = await db.collection("Cart").findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ error: "Cart item not found" });
    res.status(200).json({ data: item });
  } catch {
    res.status(500).json({ error: "Failed to fetch cart item" });
  }
});

app.post("/cart", async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;
    if (!productId || !quantity || !userId)
      return res.status(400).json({ error: "productId, quantity, and userId required" });

    const result = await db.collection("Cart").insertOne({
      productId,
      quantity: parseInt(quantity),
      userId,
      createdAt: new Date()
    });

    res.status(201).json({ message: "Item added to cart", id: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to add cart item" });
  }
});

app.put("/cart/:id", async (req, res) => {
  try {
    const result = await db.collection("Cart").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Cart item not found" });
    res.status(200).json({ message: "Cart item updated" });
  } catch {
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

app.delete("/cart/:id", async (req, res) => {
  try {
    const result = await db.collection("Cart").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Cart item not found" });
    res.status(200).json({ message: "Cart item deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete cart item" });
  }
});

/* ========================= ORDERS CRUD ========================= */

app.get("/orders", async (req, res) => {
  try {
    const orders = await db.collection("Orders").find().toArray();
    res.status(200).json({ message: "Orders fetched successfully", data: orders });
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const order = await db.collection("Orders").findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ data: order });
  } catch {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post("/orders", async (req, res) => {
  try {
    const { userId, items, totalAmount, status } = req.body;
    if (!userId || !items || !totalAmount)
      return res.status(400).json({ error: "userId, items, and totalAmount required" });

    const result = await db.collection("Orders").insertOne({
      userId,
      items,
      totalAmount: parseFloat(totalAmount),
      status: status || "pending",
      createdAt: new Date()
    });

    res.status(201).json({ message: "Order created", id: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const result = await db.collection("Orders").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order updated" });
  } catch {
    res.status(500).json({ error: "Failed to update order" });
  }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    const result = await db.collection("Orders").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

/* ========================= START SERVER ========================= */

connectToMongo()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://0.0.0.0:${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });
