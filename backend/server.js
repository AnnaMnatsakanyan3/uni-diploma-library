const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // serve uploaded files

// File upload config
const upload = multer({ dest: "uploads/" });

// ==========================
// REGISTER
// ==========================
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
    [name, email, hash, role],
    (err) => {
      if (err) return res.status(500).send("Error registering user");
      res.send("Registered successfully!");
    }
  );
});

// ==========================
// LOGIN
// ==========================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, result) => {
    if (err) return res.status(500).send("Database error");

    if (result.length === 0) return res.status(401).send("Invalid login");

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).send("Invalid login");

    res.json({ id: user.id, name: user.name, role: user.role });
  });
});

// ==========================
// GET BOOKS
// ==========================
app.get("/books", (req, res) => {
  db.query("SELECT * FROM books WHERE approved = 1", (err, result) => {
    if (err) return res.status(500).send("Database error");
    res.json(result);
  });
});


// ==========================
// UPLOAD BOOK (LECTURER ONLY)
// ==========================
app.post("/upload", upload.single("file"), (req, res) => {
  const { title, author, category, uploaded_by } = req.body;

  db.query(
    "INSERT INTO books (title,author,filename,uploaded_by,category,approved) VALUES (?,?,?,?,?,0)",
    [title, author, req.file.filename, uploaded_by, category],
    () => res.send("Uploaded")
  );
    [title, author, req.file.filename, uploaded_by],
    (err) => {
      if (err) return res.status(500).send("Database error");
      res.send("Book uploaded successfully!");
    }
});
app.post("/approve/:id", (req, res) => {
  db.query(
    "UPDATE books SET approved=1 WHERE id=?",
    [req.params.id],
    () => res.send("Approved")
  );
});


// ==========================
// START SERVER
// ==========================
app.listen(5000, () => console.log("Backend running on http://localhost:5000"));