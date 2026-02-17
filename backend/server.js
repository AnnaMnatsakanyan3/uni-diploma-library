

const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const db = require("./db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads", {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
    }
  }
}));// serve uploaded files

// File upload config
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });




// ==========================
// REGISTER
// ==========================
app.post("/register", async (req, res) => {

  const { name, email, password, role } = req.body;

  if (!email || !email.toLowerCase().trim().endsWith("@nuaca.am")) {
    return res.status(400).json({
      error: "Only @nuaca.am email addresses are allowed"
    });
  }

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
    [name, email, hash, role],
    (err) => {
      if (err) return res.status(500).send("User exists");
      res.send("Registered");
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

// ===== DIPLOMA UPLOAD =====
app.post("/diploma/upload", upload.single("file"), (req, res) => {

  const {
    title,
    student,
    supervisor,
    department,
    year,
    uploaded_by
  } = req.body;

  db.query(
    `INSERT INTO diploma_works
     (title, student, supervisor, department, year, filename, uploaded_by, approved)
     VALUES (?,?,?,?,?,?,?,0)`,

    [
      title,
      student,
      supervisor,
      department,
      year,
      req.file.filename,
      uploaded_by
    ],

    err => {
      if (err) return res.status(500).send(err);
      res.send("Diploma uploaded");
    }
  );
});
// =========================
// GET DIPLOMA WORKS
// =========================
app.get("/diploma", (req, res) => {
  db.query(
    "SELECT * FROM books WHERE category='Diploma' AND approved=1",
    (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).send("DB error");
      }
      res.json(rows);
    }
  );
});


// ==========================
// GET BOOKS
// ==========================

app.get("/books", (req, res) => {
  db.query(
    "SELECT * FROM books WHERE approved = 1",
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});


app.get("/admin/books", (req, res) => {
  db.query(
    "SELECT * FROM books ORDER BY approved ASC",
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});


// ===== ADMIN — APPROVE =====
app.post("/admin/approve/:id", (req, res) => {
  db.query(
    "UPDATE books SET approved = 1 WHERE id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).send(err);
      res.send("Approved");
    }
  );
});
// ==========================
// UPLOAD BOOK (LECTURER ONLY)
// ==========================
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const { title, author, category, uploaded_by } = req.body;

    if (!title || !author || !category) {
      return res.status(400).send("Missing fields");
    }

    const sql = `
      INSERT INTO books
      (title, author, filename, uploaded_by, category, approved)
      VALUES (?, ?, ?, ?, ?, 0)
    `;

    db.query(sql,
      [title, author, req.file.filename, uploaded_by, category],
      (err) => {
        if (err) {
          console.error("DB ERROR:", err);
          return res.status(500).send("Database error");
        }

        res.send("Uploaded");
      }
    );

  } catch (e) {
    console.error("UPLOAD CRASH:", e);
    res.status(500).send("Server crash");
  }
});


app.post("/view/:id", (req, res) => {
  db.query(
    "UPDATE books SET views = views + 1 WHERE id=?",
    [req.params.id]
  );
  res.send("ok");
});


app.post("/download/:id", (req, res) => {
  db.query(
    "UPDATE books SET downloads = downloads + 1 WHERE id=?",
    [req.params.id]
  );
  res.send("ok");
});


app.post("/approve/:id", (req, res) => {
  db.query(
    "UPDATE books SET approved=1 WHERE id=?",
    [req.params.id],
    () => res.send("Approved")
  );
});
// =====================
// DOWNLOAD COUNTER
// =====================
app.post("/download/:id", (req, res) => {
  db.query(
    "UPDATE books SET downloads = downloads + 1 WHERE id=?",
    [req.params.id],
    err => {
      if (err) {
        console.log(err);
        return res.status(500).send("DB error");
      }
      res.send("Download counted");
    }
  );
});


// ==========================
// START SERVER
// ==========================
app.listen(5000, () => console.log("Backend running on http://localhost:5000"));