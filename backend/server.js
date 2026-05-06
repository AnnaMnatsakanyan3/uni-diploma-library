
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
require("dotenv").config();
const { PDFParse } = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const db = require("./db");
const fs = require("fs");
const path = require("path");
const uploadsDir = path.join(__dirname, "uploads");
const legacyUploadsDir = path.join(__dirname, "..", "uploads");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key_change_in_production";
const ALLOWED_COURSE_CODES = ["HK12-1", "HK12-2", "HK13", "K12"];

const ensureUsersDepartmentColumn = () => {
  db.query("SHOW COLUMNS FROM users LIKE 'department'", (err, rows) => {
    if (err) {
      console.error("Failed to check users.department column:", err.message);
      return;
    }

    if (rows.length === 0) {
      db.query("ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL AFTER course_code", (alterErr) => {
        if (alterErr) {
          console.error("Failed to add users.department column:", alterErr.message);
          return;
        }
        console.log("users.department column added.");
      });
    }
  });
};

const ensureExamsTable = () => {
  db.query(
    `CREATE TABLE IF NOT EXISTS exams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_code VARCHAR(30) NOT NULL,
      exam_name VARCHAR(255) NOT NULL,
      exam_date DATE NOT NULL,
      start_time VARCHAR(20) NOT NULL,
      end_time VARCHAR(20) NOT NULL,
      auditorium VARCHAR(120) NOT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_exam_course (course_code),
      INDEX idx_exam_date (exam_date),
      CONSTRAINT fk_exams_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    (err) => {
      if (err) {
        console.error("Failed to ensure exams table:", err.message);
      }
    }
  );
};

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
    }
  }
}));

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ensureWaitlistTable = () => {
  db.query(
    `CREATE TABLE IF NOT EXISTS book_waitlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      book_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notified TINYINT(1) DEFAULT 0,
      UNIQUE KEY uq_waitlist (user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )`,
    (err) => { if (err) console.error("Failed to ensure waitlist table:", err.message); }
  );
};

ensureUsersDepartmentColumn();
ensureExamsTable();
ensureWaitlistTable();

// ==========================
// NOTIFICATION HELPER
// ==========================
const notify = (userId, title, message, type = "info", linkPage = null) => {
  db.query(
    "INSERT INTO notifications (user_id, title, message, type, link_page) VALUES (?, ?, ?, ?, ?)",
    [userId, title, message, type, linkPage],
    (err) => { if (err) console.error("Notify error:", err.message); }
  );
};

// File upload config
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint"
    ];
    const allowedExts = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isMimeAllowed = allowedMimes.includes(file.mimetype);
    const isExtAllowed = allowedExts.includes(ext);

    if (!isMimeAllowed && !isExtAllowed) {
      cb(new Error("Only PDF, Word, and PowerPoint files are allowed"));
    } else {
      cb(null, true);
    }
  }
});

// ==========================
// JWT MIDDLEWARE
// ==========================
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Admin role check
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const isLecturer = (req, res, next) => {
  if (req.user.role !== "lecturer" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Lecturer/Admin access required" });
  }
  next();
};




// ==========================
// REGISTER
// ==========================
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, course_code, department } = req.body;
    const normalizedRole = role || "student";
    const normalizedEmail = (email || "").toLowerCase().trim();

    // Validation
    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (!normalizedEmail.endsWith("@nuaca.am")) {
      return res.status(400).json({ error: "Only @nuaca.am email addresses are allowed" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Admin role cannot self-register
    if (normalizedRole === "admin") {
      return res.status(400).json({ error: "Admin accounts cannot be created through registration" });
    }

    if (normalizedRole === "student") {
      if (!course_code) {
        return res.status(400).json({ error: "Course is required for students" });
      }
      if (!ALLOWED_COURSE_CODES.includes(course_code)) {
        return res.status(400).json({ error: "Invalid course selection" });
      }
    }

    if (normalizedRole === "lecturer" && !department) {
      return res.status(400).json({ error: "Department is required for lecturers" });
    }

    const hash = await bcrypt.hash(password, 10);

    db.query(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail],
      (checkErr, existing) => {
        if (checkErr) {
          console.error("Register check query error:", checkErr.code, checkErr.message);
          return res.status(500).json({ error: "Registration failed" });
        }
        if (existing.length > 0) {
          return res.status(400).json({ error: "This email is already registered" });
        }

        const baseValues = [
          name,
          normalizedEmail,
          hash,
          normalizedRole,
          normalizedRole === "student" ? course_code : null,
          normalizedRole === "lecturer" ? department : null
        ];

        db.query(
          "INSERT INTO users (name, email, password, role, course_code, department) VALUES (?, ?, ?, ?, ?, ?)",
          baseValues,
          (err) => {
            if (err && err.code === "ER_BAD_FIELD_ERROR" && /department/i.test(err.message || "")) {
              // Backward-compatible fallback if users.department does not exist yet.
              return db.query(
                "INSERT INTO users (name, email, password, role, course_code) VALUES (?, ?, ?, ?, ?)",
                [name, normalizedEmail, hash, normalizedRole, normalizedRole === "student" ? course_code : null],
                (fallbackErr) => {
                  if (fallbackErr) {
                    console.error("Register fallback insert error:", fallbackErr.code, fallbackErr.message);
                    if (fallbackErr.code === "ER_DUP_ENTRY") {
                      return res.status(400).json({ error: "Email already registered" });
                    }
                    return res.status(500).json({ error: "Registration failed" });
                  }
                  return res.json({ message: "Registered successfully" });
                }
              );
            }

            if (err) {
              console.error("Register insert error:", err.code, err.message);
              if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).json({ error: "Email already registered" });
              }
              return res.status(500).json({ error: "Registration failed" });
            }
            return res.json({ message: "Registered successfully" });
          }
        );
      }
    );

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/registration-courses", (req, res) => {
  res.json(ALLOWED_COURSE_CODES);
});

// ==========================
// EXAM SCHEDULE
// ==========================
app.get("/exams", (req, res) => {
  try {
    const { course_code } = req.query;
    const params = [];
    let query = `
      SELECT id, course_code, exam_name, exam_date, start_time, end_time, auditorium, created_at
      FROM exams
    `;

    if (course_code) {
      query += " WHERE course_code = ?";
      params.push(course_code);
    }

    query += " ORDER BY exam_date ASC, start_time ASC";

    db.query(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch exams" });
      res.json(rows || []);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/admin/exams", verifyToken, isAdmin, (req, res) => {
  try {
    const { course_code, exam_name, exam_date, start_time, end_time, auditorium } = req.body;

    if (!course_code || !exam_name || !exam_date || !start_time || !end_time || !auditorium) {
      return res.status(400).json({ error: "All exam fields are required" });
    }

    if (!ALLOWED_COURSE_CODES.includes(course_code)) {
      return res.status(400).json({ error: "Invalid course code" });
    }

    db.query(
      "INSERT INTO exams (course_code, exam_name, exam_date, start_time, end_time, auditorium, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [course_code, exam_name.trim(), exam_date, start_time, end_time, auditorium.trim(), req.user.id],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to add exam" });
        // Notify all users assigned to this course
        db.query(
          "SELECT id FROM users WHERE course_code = ?",
          [course_code],
          (err2, students) => {
            if (!err2) {
              const cleanExamName = exam_name.trim();
              const cleanAuditorium = auditorium.trim();

              students.forEach((s) => notify(
                s.id,
                "📝 New Exam Scheduled",
                `${cleanExamName} has been scheduled on ${exam_date} at ${start_time} in ${cleanAuditorium} (Course: ${course_code})`,
                "warning",
                "academics"
              ));
            }
          }
        );
        res.json({ message: "Exam added successfully", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// LOGIN
// ==========================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
      if (err) {
        console.error("Login DB error:", err.code, err.message);
        return res.status(500).json({ error: "Database error" });
      }

      if (result.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = result[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name, course_code: user.course_code, department: user.department },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          course_code: user.course_code,
          department: user.department
        }
      });
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// GET USER PROFILE
// ==========================
app.get("/user/profile", verifyToken, (req, res) => {
  db.query("SELECT id, name, email, role, avatar, bio, course_code, department, created_at FROM users WHERE id = ?", [req.user.id], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (result.length === 0) return res.status(404).json({ error: "User not found" });

    res.json(result[0]);
  });
});

// ==========================
// UPDATE USER PROFILE
// ==========================
app.put("/user/profile", verifyToken, (req, res) => {
  try {
    const { name, bio } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    db.query(
      "UPDATE users SET name = ?, bio = ? WHERE id = ?",
      [name, bio || "", userId],
      (err) => {
        if (err) return res.status(500).json({ error: "Update failed" });
        res.json({ message: "Profile updated successfully" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// GET BOOKS (APPROVED ONLY)
// ==========================
app.get("/books", (req, res) => {
  try {
    const { search, faculty, category } = req.query;

    let query = "SELECT * FROM books WHERE approved = 1";
    let params = [];

    if (search) {
      query += " AND (title LIKE ? OR author LIKE ? OR category LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (faculty && faculty !== "All") {
      query += " AND faculty = ?";
      params.push(faculty);
    }

    if (category && category !== "all") {
      query += " AND category = ?";
      params.push(category);
    }

    query += " ORDER BY created_at DESC";

    db.query(query, params, (err, rows) => {
      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Failed to fetch books" });
      }
      res.json(rows);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// GET SINGLE BOOK
// ==========================
app.get("/books/:id", (req, res) => {
  db.query("SELECT * FROM books WHERE id = ? AND approved = 1", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (result.length === 0) return res.status(404).json({ error: "Book not found" });

    res.json(result[0]);
  });
});

// ==========================
// UPLOAD BOOK (LECTURER ONLY)
// ==========================
app.post("/books/upload", verifyToken, isLecturer, (req, res) => {
  upload.single("file")(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || "Invalid file upload" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { title, author, faculty, description, price, is_available, book_type, total_copies, category } = req.body;

      if (!title || !author) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Title and author are required" });
      }

      const normalizedCategory = category === "exam_questions" ? "exam_questions" : category === "lesson_material" ? "lesson_material" : "book";
      const normalizedBookType = normalizedCategory === "exam_questions" ? "online" : (book_type || "online");
      const normalizedPrice = (normalizedCategory === "exam_questions" || normalizedCategory === "lesson_material") ? 0 : (parseFloat(price) || 0);
      const normalizedCopies = (normalizedCategory === "exam_questions" || normalizedCategory === "lesson_material") ? 0 : (parseInt(total_copies) || 0);
      const normalizedAvailability = (normalizedCategory === "exam_questions" || normalizedCategory === "lesson_material") ? 1 : (is_available === "0" ? 0 : 1);
      const approved = req.user.role === "admin" ? 1 : 0;

      const sql = `
      INSERT INTO books (title, author, filename, uploaded_by, category, faculty, description, price, is_available, book_type, total_copies, available_copies, approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

      db.query(
        sql,
        [title, author, req.file.filename, req.user.id, normalizedCategory, faculty || null, description || "", normalizedPrice, normalizedAvailability, normalizedBookType, normalizedCopies, normalizedCopies, approved],
        (err) => {
          if (err) {
            console.error("DB ERROR:", err);
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: "Failed to upload book" });
          }

          res.json({
            message: approved === 1
              ? "Material uploaded successfully"
              : "Material uploaded successfully and awaiting approval"
          });
        }
      );
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

// ==========================
// PURCHASE / ORDER BOOK
// ==========================
app.post("/books/:id/order", verifyToken, (req, res) => {
  const { order_type, notes } = req.body;
  const bookId = req.params.id;

  if (!["purchase", "order"].includes(order_type)) {
    return res.status(400).json({ error: "Invalid order type" });
  }

  // Check if user already has a pending order for this book
  db.query(
    "SELECT id FROM book_orders WHERE user_id = ? AND book_id = ? AND status = 'pending'",
    [req.user.id, bookId],
    (err, existing) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (existing.length > 0) {
        return res.status(400).json({ error: "You already have a pending order for this book" });
      }

      db.query(
        "INSERT INTO book_orders (user_id, book_id, order_type, notes) VALUES (?, ?, ?, ?)",
        [req.user.id, bookId, order_type, notes || null],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Failed to create order" });
          res.json({ message: order_type === "purchase" ? "Purchase request submitted!" : "Order request submitted!" });
        }
      );
    }
  );
});

// Get user's orders
app.get("/my-orders", verifyToken, (req, res) => {
  db.query(
    `SELECT bo.*, b.title, b.author, b.price 
     FROM book_orders bo 
     JOIN books b ON bo.book_id = b.id 
     WHERE bo.user_id = ? 
     ORDER BY bo.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch orders" });
      res.json(rows);
    }
  );
});

// Admin: Get all orders
app.get("/admin/orders", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT bo.*, b.title, b.author, b.price, u.name as user_name, u.email as user_email
     FROM book_orders bo 
     JOIN books b ON bo.book_id = b.id 
     JOIN users u ON bo.user_id = u.id
     ORDER BY bo.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch orders" });
      res.json(rows);
    }
  );
});

// Admin: Update order status
app.put("/admin/orders/:id", verifyToken, isAdmin, (req, res) => {
  const { status } = req.body;
  if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  db.query(
    "UPDATE book_orders SET status = ? WHERE id = ?",
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update order" });
      res.json({ message: "Order updated" });
    }
  );
});

// ==========================
// BOOK RESERVATIONS
// ==========================

// Reserve a physical book
app.post("/books/:id/reserve", verifyToken, (req, res) => {
  const bookId = req.params.id;

  // Check book exists and is physical/both
  db.query("SELECT * FROM books WHERE id = ? AND approved = 1", [bookId], (err, books) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (books.length === 0) return res.status(404).json({ error: "Book not found" });

    const book = books[0];
    if (book.book_type === "online") {
      return res.status(400).json({ error: "This is an online-only book and cannot be reserved" });
    }
    if (book.available_copies <= 0) {
      return res.status(400).json({ error: "No copies available for reservation" });
    }

    // Check user doesn't already have an active reservation
    db.query(
      "SELECT id FROM book_reservations WHERE user_id = ? AND book_id = ? AND status IN ('reserved', 'borrowed')",
      [req.user.id, bookId],
      (err2, existing) => {
        if (err2) return res.status(500).json({ error: "Database error" });
        if (existing.length > 0) {
          return res.status(400).json({ error: "You already have an active reservation for this book" });
        }

        // Create reservation and decrease available copies
        db.query(
          "INSERT INTO book_reservations (user_id, book_id, status) VALUES (?, ?, 'reserved')",
          [req.user.id, bookId],
          (err3) => {
            if (err3) return res.status(500).json({ error: "Failed to reserve book" });

            db.query("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", [bookId]);
            res.json({ message: "Book reserved successfully! Visit the library to pick it up." });
          }
        );
      }
    );
  });
});

// Cancel reservation
app.put("/reservations/:id/cancel", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM book_reservations WHERE id = ? AND user_id = ? AND status = 'reserved'",
    [req.params.id, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (rows.length === 0) return res.status(404).json({ error: "Reservation not found" });

      db.query("UPDATE book_reservations SET status = 'cancelled' WHERE id = ?", [req.params.id], (err2) => {
        if (err2) return res.status(500).json({ error: "Failed to cancel reservation" });
        db.query("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [rows[0].book_id]);
        res.json({ message: "Reservation cancelled" });
      });
    }
  );
});

// Get user's reservations with days count
app.get("/my-reservations", verifyToken, (req, res) => {
  db.query(
    `SELECT br.*, b.title, b.author, b.book_type,
      CASE 
        WHEN br.status = 'borrowed' THEN DATEDIFF(NOW(), br.borrowed_at)
        WHEN br.status = 'returned' THEN DATEDIFF(br.returned_at, br.borrowed_at)
        ELSE 0
      END as days_held,
      CASE
        WHEN br.status = 'borrowed' AND br.due_date < NOW() THEN 1
        ELSE 0
      END as is_overdue
     FROM book_reservations br 
     JOIN books b ON br.book_id = b.id 
     WHERE br.user_id = ? 
     ORDER BY br.reserved_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch reservations" });
      res.json(rows);
    }
  );
});

// Admin: Get all reservations
app.get("/admin/reservations", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT br.*, b.title, b.author, b.book_type, u.name as user_name, u.email as user_email,
      CASE 
        WHEN br.status = 'borrowed' THEN DATEDIFF(NOW(), br.borrowed_at)
        WHEN br.status = 'returned' THEN DATEDIFF(br.returned_at, br.borrowed_at)
        ELSE 0
      END as days_held,
      CASE
        WHEN br.status = 'borrowed' AND br.due_date < NOW() THEN 1
        ELSE 0
      END as is_overdue
     FROM book_reservations br 
     JOIN books b ON br.book_id = b.id 
     JOIN users u ON br.user_id = u.id
     ORDER BY br.reserved_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch reservations" });
      res.json(rows);
    }
  );
});

// Admin: Mark as borrowed (student picked up book)
app.put("/admin/reservations/:id/borrow", verifyToken, isAdmin, (req, res) => {
  const dueDate = req.body.due_date;
  db.query(
    "SELECT br.*, b.title, br.user_id FROM book_reservations br JOIN books b ON br.book_id = b.id WHERE br.id = ? AND br.status = 'reserved'",
    [req.params.id],
    (err, rows) => {
      if (err || rows.length === 0) return res.status(404).json({ error: "Reservation not found or not in reserved status" });
      const row = rows[0];
      const due = dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      db.query(
        "UPDATE book_reservations SET status = 'borrowed', borrowed_at = NOW(), due_date = ? WHERE id = ?",
        [due, req.params.id],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: "Failed to update reservation" });
          if (result.affectedRows === 0) return res.status(404).json({ error: "Reservation not found or not in reserved status" });
          notify(row.user_id, "📖 Book Ready for Pickup", `"${row.title}" is now marked as borrowed. Please return it by ${new Date(due).toLocaleDateString()}.`, "info", "dashboard");
          res.json({ message: "Book marked as borrowed" });
        }
      );
    }
  );
});

// Admin: Mark as returned
app.put("/admin/reservations/:id/return", verifyToken, isAdmin, (req, res) => {
  db.query(
    "SELECT * FROM book_reservations WHERE id = ? AND status = 'borrowed'",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (rows.length === 0) return res.status(404).json({ error: "Reservation not found or not borrowed" });

      db.query(
        "UPDATE book_reservations SET status = 'returned', returned_at = NOW() WHERE id = ?",
        [req.params.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Failed to update" });
          const bookId = rows[0].book_id;
          const returnedTitle = rows[0].title;
          db.query("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [bookId]);
          notify(rows[0].user_id, "✅ Book Return Confirmed", `Your return of "${returnedTitle}" has been recorded. Thank you!`, "success", "dashboard");
          // Notify first person on waitlist
          db.query(
            "SELECT user_id FROM book_waitlist WHERE book_id = ? AND notified = 0 ORDER BY joined_at ASC LIMIT 1",
            [bookId],
            (wErr, waiters) => {
              if (!wErr && waiters.length > 0) {
                const nextUserId = waiters[0].user_id;
                notify(nextUserId, "📚 Book Now Available!", `"${returnedTitle}" is now available. Reserve it before someone else does!`, "success", "dashboard");
                db.query("UPDATE book_waitlist SET notified = 1 WHERE user_id = ? AND book_id = ?", [nextUserId, bookId]);
              }
            }
          );
          res.json({ message: "Book marked as returned" });
        }
      );
    }
  );
});

// Admin: Send overdue reminder notification to student
app.post("/admin/reservations/:id/remind", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT br.*, b.title, b.author, u.name as user_name, u.email as user_email,
      DATEDIFF(NOW(), br.borrowed_at) as days_held
     FROM book_reservations br
     JOIN books b ON br.book_id = b.id
     JOIN users u ON br.user_id = u.id
     WHERE br.id = ? AND br.status IN ('borrowed', 'overdue')`,
    [req.params.id],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (rows.length === 0) return res.status(404).json({ error: "Active borrow not found" });

      const r = rows[0];

      // Save a notification message in the messages table
      const subject = `⚠️ Book Return Reminder: "${r.title}"`;
      const body = `Dear ${r.user_name},\n\nThis is a reminder that you have held the book "${r.title}" by ${r.author} for ${r.days_held} days.\n\nPlease return the book to the university library as soon as possible.\n\nIf the book is not returned within the next few days, additional penalties may apply.\n\nThank you,\nNUACA Library Administration`;

      db.query(
        "INSERT INTO messages (sender_id, recipient_email, subject, body) VALUES (?, ?, ?, ?)",
        [req.user.id, r.user_email, subject, body],
        async (err2) => {
          if (err2) return res.status(500).json({ error: "Failed to save notification" });

          // Also try sending email if SMTP is configured
          let emailSent = false;
          if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
              await transporter.sendMail({
                from: `"NUACA Library" <${process.env.SMTP_USER}>`,
                to: r.user_email,
                subject: subject,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                    <h2 style="color:#dc2626">⚠️ Book Return Reminder</h2>
                    <p>Dear <strong>${r.user_name}</strong>,</p>
                    <p>You have been holding the following book for <strong style="color:#dc2626">${r.days_held} days</strong>:</p>
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
                      <p style="margin:0;font-size:18px;font-weight:bold">${r.title}</p>
                      <p style="margin:4px 0;color:#666">by ${r.author}</p>
                      <p style="margin:4px 0;color:#666">Borrowed: ${new Date(r.borrowed_at).toLocaleDateString()}</p>
                      ${r.due_date ? `<p style="margin:4px 0;color:#dc2626;font-weight:bold">Due: ${new Date(r.due_date).toLocaleDateString()}</p>` : ""}
                    </div>
                    <p>Please return the book to the university library as soon as possible.</p>
                    <p style="color:#888;font-size:12px;margin-top:24px">NUACA Library Administration</p>
                  </div>
                `
              });
              emailSent = true;
            } catch (emailErr) {
              console.error("Reminder email error:", emailErr.message);
            }
          }

          // Mark as overdue if held 30+ days
          if (r.days_held >= 30) {
            db.query("UPDATE book_reservations SET status = 'overdue' WHERE id = ? AND status = 'borrowed'", [req.params.id]);
          }

          res.json({
            message: `Reminder sent to ${r.user_name} (${r.user_email}). Book held for ${r.days_held} days.${emailSent ? " Email also sent." : " (In-app message only - SMTP not configured)"}`,
          });
        }
      );
    }
  );
});

// ==========================
// BOOK WAITLIST
// ==========================

// Join waitlist
app.post("/books/:id/waitlist", verifyToken, (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  db.query("SELECT id, title, available_copies FROM books WHERE id = ? AND approved = 1", [bookId], (err, books) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!books.length) return res.status(404).json({ error: "Book not found" });
    if (books[0].available_copies > 0) {
      return res.status(400).json({ error: "Book has available copies — reserve it directly" });
    }
    db.query(
      "INSERT IGNORE INTO book_waitlist (user_id, book_id) VALUES (?, ?)",
      [req.user.id, bookId],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: "Failed to join waitlist" });
        if (result.affectedRows === 0) {
          return res.status(400).json({ error: "You are already on the waitlist for this book" });
        }
        res.json({ message: `Added to waitlist for "${books[0].title}". You'll be notified when it's returned.` });
      }
    );
  });
});

// Leave waitlist
app.delete("/books/:id/waitlist", verifyToken, (req, res) => {
  db.query(
    "DELETE FROM book_waitlist WHERE user_id = ? AND book_id = ?",
    [req.user.id, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (result.affectedRows === 0) return res.status(404).json({ error: "Not on waitlist" });
      res.json({ message: "Removed from waitlist" });
    }
  );
});

// Get my waitlist entries
app.get("/my-waitlist", verifyToken, (req, res) => {
  db.query(
    `SELECT bw.id, bw.book_id, bw.joined_at, bw.notified, b.title, b.author, b.available_copies
     FROM book_waitlist bw
     JOIN books b ON bw.book_id = b.id
     WHERE bw.user_id = ?
     ORDER BY bw.joined_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows || []);
    }
  );
});

// ==========================
// CRON: Daily overdue reminder
// ==========================
cron.schedule("0 8 * * *", () => {
  db.query(
    `SELECT br.id, br.user_id, br.due_date, b.title,
       DATEDIFF(NOW(), br.due_date) AS days_overdue
     FROM book_reservations br
     JOIN books b ON br.book_id = b.id
     WHERE br.status = 'borrowed' AND br.due_date IS NOT NULL AND br.due_date < NOW()`,
    (err, rows) => {
      if (err) return console.error("Cron overdue query error:", err.message);
      rows.forEach((r) => {
        // Mark as overdue in DB
        db.query("UPDATE book_reservations SET status = 'overdue' WHERE id = ? AND status = 'borrowed'", [r.id]);
        // Send in-app notification
        notify(
          r.user_id,
          "⚠️ Overdue Book",
          `"${r.title}" was due ${r.days_overdue} day(s) ago. Please return it to the library as soon as possible.`,
          "warning",
          "dashboard"
        );
      });
      if (rows.length > 0) console.log(`Cron: marked ${rows.length} reservation(s) as overdue.`);
    }
  );
});

// ==========================
// UPLOAD DIPLOMA WORK
// ==========================
app.post("/diploma/upload", verifyToken, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { title, student, supervisor, department, year, description } = req.body;

    if (!title || !student || !supervisor) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Title, student name, and supervisor are required" });
    }

    db.query(
      `INSERT INTO diploma_works 
       (title, student, supervisor, department, year, filename, uploaded_by, description, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [title, student, supervisor, department || "", year || new Date().getFullYear(), req.file.filename, req.user.id, description || ""],
      (err) => {
        if (err) {
          console.error("DB ERROR:", err);
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: "Failed to upload diploma work" });
        }

        res.json({ message: "Diploma work uploaded successfully and awaiting approval" });
      }
    );
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ==========================
// GET DIPLOMA WORKS (APPROVED ONLY)
// ==========================
app.get("/diploma", (req, res) => {
  try {
    const { search, year, department } = req.query;

    let query = "SELECT * FROM diploma_works WHERE approved = 1";
    let params = [];

    if (search) {
      query += " AND (title LIKE ? OR student LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (year) {
      query += " AND year = ?";
      params.push(year);
    }

    if (department) {
      query += " AND department LIKE ?";
      params.push(`%${department}%`);
    }

    query += " ORDER BY created_at DESC";

    db.query(query, params, (err, rows) => {
      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ error: "Failed to fetch diploma works" });
      }
      res.json(rows);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// TRACK VIEW
// ==========================
app.post("/books/:id/view", (req, res) => {
  db.query(
    "UPDATE books SET views = views + 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update view count" });
      res.json({ message: "View counted" });
    }
  );
});

app.post("/diploma/:id/view", (req, res) => {
  db.query(
    "UPDATE diploma_works SET views = views + 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update view count" });
      res.json({ message: "View counted" });
    }
  );
});

// ==========================
// TRACK DOWNLOAD
// ==========================
app.post("/books/:id/download", (req, res) => {
  db.query(
    "UPDATE books SET downloads = downloads + 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update download count" });
      res.json({ message: "Download counted" });
    }
  );
});

app.post("/diploma/:id/download", (req, res) => {
  db.query(
    "UPDATE diploma_works SET downloads = downloads + 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update download count" });
      res.json({ message: "Download counted" });
    }
  );
});

// ==========================
// ADMIN - GET ALL BOOKS (FOR APPROVAL)
// ==========================
app.get("/admin/books", verifyToken, isAdmin, (req, res) => {
  db.query(
    "SELECT b.*, u.name as uploader FROM books b LEFT JOIN users u ON b.uploaded_by = u.id ORDER BY b.approved ASC, b.created_at DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch books" });
      res.json(rows);
    }
  );
});

// ==========================
// ADMIN - GET ALL DIPLOMA WORKS (FOR APPROVAL)
// ==========================
app.get("/admin/diploma", verifyToken, isAdmin, (req, res) => {
  db.query(
    "SELECT d.*, u.name as uploader FROM diploma_works d LEFT JOIN users u ON d.uploaded_by = u.id ORDER BY d.approved ASC, d.created_at DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to fetch diploma works" });
      res.json(rows);
    }
  );
});

// ==========================
// ADMIN - APPROVE BOOK
// ==========================
app.post("/admin/books/:id/approve", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE books SET approved = 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to approve book" });
      res.json({ message: "Book approved" });
    }
  );
});

// ==========================
// ADMIN - APPROVE DIPLOMA
// ==========================
app.post("/admin/diploma/:id/approve", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE diploma_works SET approved = 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to approve diploma work" });
      res.json({ message: "Diploma work approved" });
    }
  );
});

// ==========================
// ADMIN - DELETE BOOK
// ==========================
app.delete("/admin/books/:id", verifyToken, isAdmin, (req, res) => {
  db.query("SELECT filename FROM books WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (result.length === 0) return res.status(404).json({ error: "Book not found" });

    const filename = result[0].filename;
    const filepath = path.join("uploads", filename);

    db.query("DELETE FROM books WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete book" });

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      res.json({ message: "Book deleted" });
    });
  });
});

// ==========================
// ADMIN - GET STATISTICS
// ==========================
app.get("/admin/statistics", verifyToken, isAdmin, (req, res) => {
  try {
    Promise.all([
      new Promise((resolve) => {
        db.query("SELECT COUNT(*) as count FROM users", (err, result) => {
          resolve(err ? 0 : result[0].count);
        });
      }),
      new Promise((resolve) => {
        db.query("SELECT COUNT(*) as count FROM books", (err, result) => {
          resolve(err ? 0 : result[0].count);
        });
      }),
      new Promise((resolve) => {
        db.query("SELECT COUNT(*) as count FROM books WHERE approved = 1", (err, result) => {
          resolve(err ? 0 : result[0].count);
        });
      }),
      new Promise((resolve) => {
        db.query("SELECT COUNT(*) as count FROM books WHERE approved = 0", (err, result) => {
          resolve(err ? 0 : result[0].count);
        });
      }),
      new Promise((resolve) => {
        db.query("SELECT SUM(downloads) as total FROM books", (err, result) => {
          resolve(err ? 0 : result[0].total || 0);
        });
      })
    ]).then(([users, totalBooks, approvedBooks, pendingBooks, totalDownloads]) => {
      res.json({
        users,
        totalBooks,
        approvedBooks,
        pendingBooks,
        totalDownloads
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// ==========================
// CALENDAR EVENTS ENDPOINTS
// ==========================

// Get all events (public - anyone can view)
app.get("/events", (req, res) => {
  try {
    const { month, year, category, group, exclude_category } = req.query;
    let query = "SELECT e.*, u.name as creator_name, COUNT(r.id) as total_rsvp FROM calendar_events e LEFT JOIN users u ON e.created_by = u.id LEFT JOIN event_rsvp r ON e.id = r.event_id";
    let params = [];
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      query += " WHERE e.start_date >= ? AND e.start_date <= ?";
      params.push(startDate + " 00:00:00", endDate + " 23:59:59");
    }
    
    if (category) {
      query += params.length > 0 ? " AND" : " WHERE";
      query += " e.category = ?";
      params.push(category);
    }

    if (exclude_category) {
      query += params.length > 0 ? " AND" : " WHERE";
      query += " e.category <> ?";
      params.push(exclude_category);
    }

    if (group && group !== "all") {
      query += params.length > 0 ? " AND" : " WHERE";
      query += " (e.target_group = 'all' OR e.target_group IS NULL OR e.target_group = '' OR e.target_group = ?)";
      params.push(group);
    }
    
    query += " GROUP BY e.id ORDER BY e.start_date ASC";

    db.query(query, params, (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch events" });
      res.json(results);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get event details with RSVP info
app.get("/events/:id", (req, res) => {
  try {
    const eventId = req.params.id;
    
    db.query(
      "SELECT e.*, u.name as creator_name FROM calendar_events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?",
      [eventId],
      (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: "Event not found" });
        
        const event = results[0];
        
        // Get RSVP stats
        db.query(
          "SELECT status, COUNT(*) as count FROM event_rsvp WHERE event_id = ? GROUP BY status",
          [eventId],
          (err, rsvpStats) => {
            event.rsvp_stats = {};
            rsvpStats.forEach(stat => {
              event.rsvp_stats[stat.status] = stat.count;
            });
            res.json(event);
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create event (admins only)
app.post("/events", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, description, start_date, end_date, category, color, location, target_group, send_reminders, reminder_days } = req.body;
    const normalizedTargetGroup = target_group && String(target_group).trim() ? String(target_group).trim() : "all";

    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: "Title and dates are required" });
    }

    db.query(
      "INSERT INTO calendar_events (title, description, start_date, end_date, category, color, location, target_group, created_by, send_reminders, reminder_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [title, description, start_date, end_date, category || "general", color || "#3498db", location, normalizedTargetGroup, req.user.id, send_reminders ? 1 : 0, reminder_days || 1],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to create event" });
        res.json({ message: "Event created", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update event (admins only)
app.put("/events/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, description, start_date, end_date, category, color, location, target_group, send_reminders, reminder_days } = req.body;
    const normalizedTargetGroup = target_group && String(target_group).trim() ? String(target_group).trim() : "all";
    
    db.query(
      "UPDATE calendar_events SET title = ?, description = ?, start_date = ?, end_date = ?, category = ?, color = ?, location = ?, target_group = ?, send_reminders = ?, reminder_days = ? WHERE id = ?",
      [title, description, start_date, end_date, category, color, location, normalizedTargetGroup, send_reminders ? 1 : 0, reminder_days, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to update event" });
        res.json({ message: "Event updated" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete event (admins only)
app.delete("/events/:id", verifyToken, isAdmin, (req, res) => {
  try {
    db.query("DELETE FROM calendar_events WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete event" });
      res.json({ message: "Event deleted" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// RSVP to event
app.post("/events/:id/rsvp", verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    const eventId = req.params.id;
    const userId = req.user.id;

    if (!["going", "not_going", "maybe"].includes(status)) {
      return res.status(400).json({ error: "Invalid RSVP status" });
    }

    db.query(
      "INSERT INTO event_rsvp (event_id, user_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?",
      [eventId, userId, status, status],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to update RSVP" });
        res.json({ message: "RSVP updated" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get user's RSVP for an event
app.get("/events/:id/my-rsvp", verifyToken, (req, res) => {
  try {
    db.query(
      "SELECT status FROM event_rsvp WHERE event_id = ? AND user_id = ?",
      [req.params.id, req.user.id],
      (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to fetch RSVP" });
        res.json({ rsvp: results.length > 0 ? results[0].status : null });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// COURSES & COURSE MATERIALS
// ==========================

// Get all courses with material count
app.get("/courses", (req, res) => {
  try {
    const { semester } = req.query;
    let query = `
      SELECT c.*, 
             u.name as instructor_name,
             COUNT(cm.id) as material_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_materials cm ON c.id = cm.course_id
    `;
    let params = [];

    if (semester) {
      query += " WHERE c.semester = ?";
      params.push(semester);
    }

    query += " GROUP BY c.id ORDER BY c.semester DESC, c.code ASC";

    db.query(query, params, (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch courses" });
      res.json(results);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get single course with all materials
app.get("/courses/:id", (req, res) => {
  try {
    db.query(
      `SELECT c.*, u.name as instructor_name 
       FROM courses c 
       LEFT JOIN users u ON c.instructor_id = u.id 
       WHERE c.id = ?`,
      [req.params.id],
      (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ error: "Course not found" });
        }

        const course = results[0];

        // Get all materials for this course
        db.query(
          `SELECT cm.*, b.title, b.author, b.filename, b.filename as book_filename
           FROM course_materials cm
           LEFT JOIN books b ON cm.material_id = b.id AND cm.material_type = 'book'
           WHERE cm.course_id = ?
           ORDER BY cm.sort_order ASC`,
          [req.params.id],
          (err, materials) => {
            if (err) return res.status(500).json({ error: "Failed to fetch materials" });
            course.materials = materials || [];
            res.json(course);
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create course (admins/lecturers only)
app.post("/courses", verifyToken, isLecturer, async (req, res) => {
  try {
    const { code, name, description, semester, credits } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: "Course code and name are required" });
    }

    db.query(
      "INSERT INTO courses (code, name, description, instructor_id, semester, credits) VALUES (?, ?, ?, ?, ?, ?)",
      [code, name, description, req.user.id, semester, credits || 0],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Course code already exists" });
          }
          return res.status(500).json({ error: "Failed to create course" });
        }
        res.json({ message: "Course created", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update course (instructors/admins only)
app.put("/courses/:id", verifyToken, isLecturer, async (req, res) => {
  try {
    const { name, description, semester, credits } = req.body;

    // Check if user is instructor or admin
    db.query(
      "SELECT instructor_id FROM courses WHERE id = ?",
      [req.params.id],
      (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ error: "Course not found" });
        }

        if (results[0].instructor_id !== req.user.id && req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }

        db.query(
          "UPDATE courses SET name = ?, description = ?, semester = ?, credits = ? WHERE id = ?",
          [name, description, semester, credits, req.params.id],
          (err) => {
            if (err) return res.status(500).json({ error: "Failed to update course" });
            res.json({ message: "Course updated" });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete course (admins only)
app.delete("/courses/:id", verifyToken, isAdmin, (req, res) => {
  try {
    db.query("DELETE FROM courses WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: "Failed to delete course" });
      res.json({ message: "Course deleted" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add material to course
app.post("/courses/:id/materials", verifyToken, isLecturer, (req, res) => {
  try {
    const { material_id, material_type, is_required } = req.body;

    if (!material_id || !material_type) {
      return res.status(400).json({ error: "Material ID and type are required" });
    }

    db.query(
      "INSERT INTO course_materials (course_id, material_id, material_type, added_by, is_required) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, material_id, material_type, req.user.id, is_required ? 1 : 0],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to add material" });
        res.json({ message: "Material added to course", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Remove material from course
app.delete("/courses/:courseId/materials/:materialId", verifyToken, isLecturer, (req, res) => {
  try {
    db.query(
      "DELETE FROM course_materials WHERE course_id = ? AND material_id = ?",
      [req.params.courseId, req.params.materialId],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to remove material" });
        res.json({ message: "Material removed from course" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// BOOKMARKS & READING LISTS
// ==========================

// Get all reading lists for user
app.get("/reading-lists", verifyToken, (req, res) => {
  try {
    db.query(
      `SELECT rl.*, COUNT(bi.id) as item_count 
       FROM reading_lists rl
       LEFT JOIN bookmark_items bi ON rl.id = bi.reading_list_id
       WHERE rl.user_id = ?
       GROUP BY rl.id
       ORDER BY rl.updated_at DESC`,
      [req.user.id],
      (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to fetch reading lists" });
        res.json(results);
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get single reading list with items
app.get("/reading-lists/:id", verifyToken, (req, res) => {
  try {
    db.query(
      "SELECT * FROM reading_lists WHERE id = ?",
      [req.params.id],
      (err, results) => {
        if (err || results.length === 0) {
          return res.status(404).json({ error: "Reading list not found" });
        }

        const list = results[0];

        // Get items in list
        db.query(
          `SELECT bi.*, b.title, b.author, b.filename, dw.title as diploma_title
           FROM bookmark_items bi
           LEFT JOIN books b ON bi.material_id = b.id AND bi.material_type = 'book'
           LEFT JOIN diploma_works dw ON bi.material_id = dw.id AND bi.material_type = 'diploma_work'
           WHERE bi.reading_list_id = ?
           ORDER BY bi.added_at DESC`,
          [req.params.id],
          (err, items) => {
            if (err) return res.status(500).json({ error: "Failed to fetch items" });
            list.items = items || [];
            res.json(list);
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create reading list
app.post("/reading-lists", verifyToken, (req, res) => {
  try {
    const { name, description, is_public } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Reading list name is required" });
    }

    db.query(
      "INSERT INTO reading_lists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)",
      [req.user.id, name, description, is_public ? 1 : 0],
      (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to create reading list" });
        res.json({ message: "Reading list created", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update reading list
app.put("/reading-lists/:id", verifyToken, (req, res) => {
  try {
    const { name, description, is_public } = req.body;

    db.query(
      "UPDATE reading_lists SET name = ?, description = ?, is_public = ? WHERE id = ? AND user_id = ?",
      [name, description, is_public ? 1 : 0, req.params.id, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to update reading list" });
        res.json({ message: "Reading list updated" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete reading list
app.delete("/reading-lists/:id", verifyToken, (req, res) => {
  try {
    db.query(
      "DELETE FROM reading_lists WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to delete reading list" });
        res.json({ message: "Reading list deleted" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add item to reading list
app.post("/reading-lists/:id/items", verifyToken, (req, res) => {
  try {
    const { material_id, material_type } = req.body;

    if (!material_id || !material_type) {
      return res.status(400).json({ error: "Material ID and type are required" });
    }

    db.query(
      "INSERT INTO bookmark_items (reading_list_id, material_id, material_type) VALUES (?, ?, ?)",
      [req.params.id, material_id, material_type],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Item already in reading list" });
          }
          return res.status(500).json({ error: "Failed to add item" });
        }
        res.json({ message: "Item added to reading list", id: result.insertId });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update bookmark item status
app.put("/bookmark-items/:id", verifyToken, (req, res) => {
  try {
    const { status, progress, notes } = req.body;

    db.query(
      "UPDATE bookmark_items SET status = ?, progress = ?, notes = ? WHERE id = ?",
      [status, progress, notes, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to update item" });
        res.json({ message: "Item updated" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Remove item from reading list
app.delete("/reading-lists/:id/items/:itemId", verifyToken, (req, res) => {
  try {
    db.query(
      "DELETE FROM bookmark_items WHERE id = ? AND reading_list_id = ?",
      [req.params.itemId, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to remove item" });
        res.json({ message: "Item removed from reading list" });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// ADVANCED SEARCH & FILTERS
// ==========================

// Advanced library search
app.get("/search", (req, res) => {
  try {
    const {
      query,
      type, // 'all', 'books', 'diploma', 'courses'
      author,
      course,
      year_from,
      year_to,
      sort_by, // 'newest', 'popular', 'title'
      limit = 50,
      offset = 0
    } = req.query;

    let results = {};

    // Helper function to search books
    const searchBooks = () => {
      return new Promise((resolve, reject) => {
        let bookQuery = "SELECT id, title, author, description, category, approved, views, downloads, filename FROM books WHERE approved = 1";
        let params = [];

        if (query) {
          bookQuery += " AND (title LIKE ? OR author LIKE ? OR category LIKE ?)";
          const searchTerm = `%${query}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        if (author) {
          bookQuery += " AND author LIKE ?";
          params.push(`%${author}%`);
        }

        if (course) {
          bookQuery = `
            SELECT DISTINCT b.id, b.title, b.author, b.description, b.category, b.approved, b.views, b.downloads, b.filename
            FROM books b
            INNER JOIN course_materials cm ON b.id = cm.material_id
            INNER JOIN courses c ON cm.course_id = c.id
            WHERE b.approved = 1 AND (c.code = ? OR c.name LIKE ?)
          `;
          params = [`${course}`, `%${course}%`];

          if (query) {
            bookQuery += " AND (b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ?)";
            const searchTerm = `%${query}%`;
            params.push(searchTerm, searchTerm, searchTerm);
          }
        }

        // Sort
        if (sort_by === "popular") {
          bookQuery += " ORDER BY downloads DESC, views DESC";
        } else if (sort_by === "title") {
          bookQuery += " ORDER BY title ASC";
        } else {
          bookQuery += " ORDER BY id DESC";
        }

        bookQuery += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        db.query(bookQuery, params, (err, books) => {
          if (err) reject(err);
          else resolve(books);
        });
      });
    };

    // Helper function to search diploma works
    const searchDiploma = () => {
      return new Promise((resolve, reject) => {
        let diplomaQuery = "SELECT id, title, student, supervisor, department, year, description, approved, views, downloads, filename FROM diploma_works WHERE approved = 1";
        let params = [];

        if (query) {
          diplomaQuery += " AND (title LIKE ? OR student LIKE ? OR supervisor LIKE ?)";
          const searchTerm = `%${query}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        if (year_from || year_to) {
          if (year_from && year_to) {
            diplomaQuery += " AND year BETWEEN ? AND ?";
            params.push(parseInt(year_from), parseInt(year_to));
          } else if (year_from) {
            diplomaQuery += " AND year >= ?";
            params.push(parseInt(year_from));
          } else if (year_to) {
            diplomaQuery += " AND year <= ?";
            params.push(parseInt(year_to));
          }
        }

        // Sort
        if (sort_by === "popular") {
          diplomaQuery += " ORDER BY downloads DESC, views DESC";
        } else if (sort_by === "title") {
          diplomaQuery += " ORDER BY title ASC";
        } else {
          diplomaQuery += " ORDER BY year DESC";
        }

        diplomaQuery += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        db.query(diplomaQuery, params, (err, diplomas) => {
          if (err) reject(err);
          else resolve(diplomas);
        });
      });
    };

    // Helper function to search courses
    const searchCourses = () => {
      return new Promise((resolve, reject) => {
        let courseQuery = "SELECT id, code, name, description, semester, credits FROM courses";
        let params = [];

        if (query) {
          courseQuery += " WHERE (code LIKE ? OR name LIKE ? OR description LIKE ?)";
          const searchTerm = `%${query}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }

        courseQuery += " ORDER BY code ASC LIMIT ? OFFSET ?";
        params.push(parseInt(limit), parseInt(offset));

        db.query(courseQuery, params, (err, courses) => {
          if (err) reject(err);
          else resolve(courses);
        });
      });
    };

    // Execute appropriate searches (each catches its own errors so one failure doesn't break all)
    const searches = [];
    if (!type || type === "all" || type === "books") searches.push(searchBooks().then(books => { results.books = books; }).catch(() => { results.books = []; }));
    if (!type || type === "all" || type === "diploma") searches.push(searchDiploma().then(diplomas => { results.diploma = diplomas; }).catch(() => { results.diploma = []; }));
    if (!type || type === "all" || type === "courses") searches.push(searchCourses().then(courses => { results.courses = courses; }).catch(() => { results.courses = []; }));

    Promise.all(searches)
      .then(() => {
        res.json({
          query,
          filters: { type, author, course, year_from, year_to, sort_by },
          results
        });
      })
      .catch(err => {
        res.status(500).json({ error: "Search failed", details: err.message });
      });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get search suggestions
app.get("/search/suggestions/:field", (req, res) => {
  try {
    const { field } = req.params;
    const { q } = req.query;

    let query = "";
    let params = [];

    switch(field) {
      case "author":
        query = "SELECT DISTINCT author FROM books WHERE author LIKE ? LIMIT 10";
        params = [`%${q}%`];
        break;
      case "category":
        query = "SELECT DISTINCT category FROM books WHERE category LIKE ? LIMIT 10";
        params = [`%${q}%`];
        break;
      case "course":
        query = "SELECT code as label, name as description FROM courses WHERE (code LIKE ? OR name LIKE ?) LIMIT 10";
        params = [`%${q}%`, `%${q}%`];
        break;
      case "department":
        query = "SELECT DISTINCT department FROM diploma_works WHERE department LIKE ? LIMIT 10";
        params = [`%${q}%`];
        break;
      default:
        return res.status(400).json({ error: "Invalid field" });
    }

    db.query(query, params, (err, suggestions) => {
      if (err) return res.status(500).json({ error: "Failed to fetch suggestions" });
      
      // Format suggestions
      const formatted = suggestions.map(s => 
        typeof s.label !== 'undefined' 
          ? { label: s.label, description: s.description } 
          : { label: s.author || s.category || s.department }
      );
      
      res.json(formatted);
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// AI QUIZ GENERATION (Google Gemini - Free)
// ==========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const quizFallbackDistractors = [
  "The document is mainly about entertainment trends and celebrity news.",
  "The document focuses only on university parking regulations.",
  "The content is a fictional story without academic concepts.",
  "The text rejects evidence-based learning methods and examples."
];

const buildFallbackQuiz = (book, text) => {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 70 && s.length <= 240);

  const source = [];
  for (const sentence of sentences) {
    if (source.length >= 10) break;
    source.push(sentence);
  }

  while (source.length < 10) {
    source.push(`A core concept from ${book.title} is discussed with examples and practical context.`);
  }

  return source.slice(0, 10).map((sentence, idx) => {
    const answer = sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;
    const correctKey = ["A", "B", "C", "D"][idx % 4];

    const wrong = quizFallbackDistractors
      .filter((item) => item !== answer)
      .slice(0, 3);

    const options = {
      A: wrong[0],
      B: wrong[1],
      C: wrong[2],
      D: wrong[0]
    };
    options[correctKey] = answer;

    return {
      question: `Which statement best matches the material in ${book.title}?`,
      options,
      correct: correctKey,
      explanation: "This option reflects a statement taken from the document text."
    };
  });
};

const normalizeQuizQuestions = (rawQuestions, fallbackQuestions) => {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return fallbackQuestions;
  }

  const normalized = [];
  for (const item of rawQuestions) {
    if (!item || typeof item !== "object") continue;
    const question = String(item.question || "").trim();
    if (!question) continue;

    const optionsSource = item.options && typeof item.options === "object" ? item.options : {};
    const options = {
      A: String(optionsSource.A || "").trim(),
      B: String(optionsSource.B || "").trim(),
      C: String(optionsSource.C || "").trim(),
      D: String(optionsSource.D || "").trim()
    };

    if (!options.A || !options.B || !options.C || !options.D) {
      continue;
    }

    const correct = ["A", "B", "C", "D"].includes(String(item.correct || "").toUpperCase())
      ? String(item.correct).toUpperCase()
      : "A";

    normalized.push({
      question,
      options,
      correct,
      explanation: item.explanation ? String(item.explanation).trim() : ""
    });

    if (normalized.length >= 10) break;
  }

  if (normalized.length < 6) {
    return fallbackQuestions;
  }

  let idx = 0;
  while (normalized.length < 10 && idx < fallbackQuestions.length) {
    normalized.push(fallbackQuestions[idx]);
    idx += 1;
  }

  return normalized.slice(0, 10);
};

app.post("/books/:id/quiz", verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Get book info
    const [book] = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM books WHERE id = ? AND approved = 1", [bookId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    if (!book) return res.status(404).json({ error: "Book not found" });

    let text = "";

    // Try both current and legacy uploads folders so old records still work.
    const candidateFilePaths = [
      path.join(uploadsDir, book.filename),
      path.join(legacyUploadsDir, book.filename)
    ];
    const existingFilePath = candidateFilePaths.find((p) => fs.existsSync(p));

    if (existingFilePath) {
      const pdfBuffer = fs.readFileSync(existingFilePath);
      try {
        const parser = new PDFParse({ data: pdfBuffer });
        const pdfData = await parser.getText();
        text = String(pdfData?.text || "");
      } catch (pdfErr) {
        console.warn("Quiz PDF parse failed, using metadata fallback:", pdfErr.message);
      }
    } else {
      console.warn(`Quiz source PDF not found for book ${book.id}: ${book.filename}`);
    }

    if (text.trim().length < 100) {
      text = `${book.title}. Author: ${book.author || "Unknown"}. This material covers academic concepts and practical examples used for university study and exam preparation.`;
    }

    // Limit text to ~4000 chars to stay within token limits
    if (text.length > 4000) {
      text = text.substring(0, 4000);
    }

    const fallbackQuestions = buildFallbackQuiz(book, text);
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        questions: fallbackQuestions,
        bookTitle: book.title,
        source: "fallback"
      });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Based on the following document text, generate exactly 10 exam-oriented multiple-choice questions.
Requirements:
- Questions must cover different concepts from the text, not random trivia.
- Each question must have exactly 4 options (A, B, C, D).
- Include one correct option.
- Include a short explanation (max 140 characters) for why the answer is correct.

Return ONLY a valid JSON array, no markdown, no explanation. Use this exact format:
[
  {
    "question": "Question text?",
    "options": { "A": "option1", "B": "option2", "C": "option3", "D": "option4" },
    "correct": "A",
    "explanation": "Short reason"
  }
]

Document title: "${book.title}"
Document text:
${text}`;

      const result = await model.generateContent(prompt);
      const content = result.response.text().trim();

      // Parse the JSON response
      let questions;
      try {
        const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          questions = JSON.parse(cleaned);
        }
      } catch (parseErr) {
        console.warn("Quiz AI parse failed, using fallback quiz:", parseErr.message);
        return res.json({
          questions: fallbackQuestions,
          bookTitle: book.title,
          source: "fallback"
        });
      }

      const normalizedQuestions = normalizeQuizQuestions(questions, fallbackQuestions);
      res.json({
        questions: normalizedQuestions,
        bookTitle: book.title,
        source: normalizedQuestions === fallbackQuestions ? "fallback" : "ai"
      });
    } catch (aiErr) {
      console.warn("Quiz AI request failed, using fallback quiz:", aiErr.message);
      return res.json({
        questions: fallbackQuestions,
        bookTitle: book.title,
        source: "fallback"
      });
    }
  } catch (err) {
    console.error("Quiz generation error:", err);
    if (err.message && err.message.includes("429")) {
      return res.status(429).json({ error: "AI rate limit exceeded. Please wait a minute and try again." });
    }
    res.status(500).json({ error: err.message || "Failed to generate quiz" });
  }
});

// ==========================
// EMAIL SETUP (Nodemailer)
// ==========================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

// ==========================
// MESSAGES (Student -> Lecturer)
// ==========================

// Send message to lecturer
app.post("/messages", verifyToken, async (req, res) => {
  try {
    const { recipient_email, subject, body } = req.body;

    if (!recipient_email || !subject || !body) {
      return res.status(400).json({ error: "Recipient email, subject, and message body are required" });
    }

    if (subject.length > 255) {
      return res.status(400).json({ error: "Subject is too long (max 255 characters)" });
    }

    // Save message to database
    db.query(
      "INSERT INTO messages (sender_id, recipient_email, subject, body) VALUES (?, ?, ?, ?)",
      [req.user.id, recipient_email, subject, body],
      async (err, result) => {
        if (err) {
          console.error("DB error saving message:", err);
          return res.status(500).json({ error: "Failed to save message" });
        }

        // Try to send email notification
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          try {
            await transporter.sendMail({
              from: `"NUACA Library" <${process.env.SMTP_USER}>`,
              to: recipient_email,
              subject: `[NUACA] New message: ${subject}`,
              html: `
                <h3>You have a new message from ${req.user.name}</h3>
                <p><strong>From:</strong> ${req.user.name} (${req.user.email})</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr/>
                <p>${body.replace(/\n/g, "<br/>")}</p>
                <hr/>
                <p style="color:#888;font-size:12px;">This message was sent via the NUACA Student Library portal.</p>
              `
            });
            emailSent = true;
          } catch (emailErr) {
            console.error("Email send error:", emailErr.message);
          }
        }

        res.json({
          message: "Message sent successfully",
          emailSent,
          id: result.insertId
        });

        // In-app notification for recipient
        db.query("SELECT id FROM users WHERE email = ?", [recipient_email], (err3, users) => {
          if (!err3 && users.length > 0) {
            notify(
              users[0].id,
              "✉️ New Message",
              `You have a new message from ${req.user.name}: "${subject}"`,
              "info",
              "inbox"
            );
          }
        });
      }
    );
  } catch (err) {
    console.error("Message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get messages received by a lecturer (by their email)
app.get("/messages/received", verifyToken, (req, res) => {
  db.query(
    `SELECT m.*, u.name as sender_name, u.email as sender_email 
     FROM messages m 
     JOIN users u ON m.sender_id = u.id 
     WHERE m.recipient_email = ? 
     ORDER BY m.created_at DESC`,
    [req.user.email],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch messages" });
      res.json(results);
    }
  );
});

// Get messages sent by the current user
app.get("/messages/sent", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM messages WHERE sender_id = ? ORDER BY created_at DESC",
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch messages" });
      res.json(results);
    }
  );
});

// Mark message as read
app.put("/messages/:id/read", verifyToken, (req, res) => {
  db.query(
    "UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_email = ?",
    [req.params.id, req.user.email],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update message" });
      res.json({ message: "Marked as read" });
    }
  );
});

// ==========================
// SUPPORT (User -> Admin)
// ==========================

app.post("/support/questions", verifyToken, (req, res) => {
  try {
    const { category, subject, body } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    db.query(
      "SELECT email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
      (adminErr, adminRows) => {
        if (adminErr) return res.status(500).json({ error: "Failed to resolve admin recipient" });
        if (!adminRows.length) return res.status(400).json({ error: "No admin account found" });

        const adminEmail = adminRows[0].email;
        const normalizedCategory = (category || "general").toLowerCase();
        const composedSubject = `[Support:${normalizedCategory}] ${subject}`;

        db.query(
          "INSERT INTO messages (sender_id, recipient_email, subject, body) VALUES (?, ?, ?, ?)",
          [req.user.id, adminEmail, composedSubject, body],
          (insertErr, result) => {
            if (insertErr) return res.status(500).json({ error: "Failed to send support question" });
            res.json({ message: "Support question sent", id: result.insertId });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/support/my", verifyToken, (req, res) => {
  db.query(
    `SELECT m.id, m.subject, m.body, m.created_at,
            TRIM(BOTH ']' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(m.subject, '[Support:', -1), ']', 1)) AS category,
            (
              SELECT r.body
              FROM messages r
              WHERE r.subject LIKE CONCAT('[SupportReply:', m.id, ']%')
              ORDER BY r.created_at DESC
              LIMIT 1
            ) AS admin_reply,
            (
              SELECT r.created_at
              FROM messages r
              WHERE r.subject LIKE CONCAT('[SupportReply:', m.id, ']%')
              ORDER BY r.created_at DESC
              LIMIT 1
            ) AS replied_at
     FROM messages m
     JOIN users u ON m.recipient_email = u.email AND u.role = 'admin'
     WHERE m.sender_id = ?
     ORDER BY m.created_at DESC`,
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch support questions" });
      res.json(results);
    }
  );
});

app.get("/admin/support/questions", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT m.id, m.subject, m.body, m.created_at, m.is_read,
            u.name AS sender_name, u.email AS sender_email,
            (
              SELECT r.body
              FROM messages r
              WHERE r.subject LIKE CONCAT('[SupportReply:', m.id, ']%')
              ORDER BY r.created_at DESC
              LIMIT 1
            ) AS admin_reply,
            (
              SELECT r.created_at
              FROM messages r
              WHERE r.subject LIKE CONCAT('[SupportReply:', m.id, ']%')
              ORDER BY r.created_at DESC
              LIMIT 1
            ) AS replied_at
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.recipient_email = ? AND m.subject LIKE '[Support:%'
     ORDER BY m.created_at DESC`,
    [req.user.email],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to fetch admin support questions" });
      res.json(results);
    }
  );
});

app.post("/admin/support/questions/:id/reply", verifyToken, isAdmin, (req, res) => {
  try {
    const questionId = req.params.id;
    const { body } = req.body;

    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: "Reply message is required" });
    }

    db.query(
      `SELECT m.id, m.subject, u.email AS sender_email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ? AND m.recipient_email = ? AND m.subject LIKE '[Support:%'
       LIMIT 1`,
      [questionId, req.user.email],
      (findErr, rows) => {
        if (findErr) return res.status(500).json({ error: "Failed to find support question" });
        if (!rows.length) return res.status(404).json({ error: "Support question not found" });

        const question = rows[0];
        const baseSubject = String(question.subject || "").replace(/^\[Support:[^\]]+\]\s*/i, "");
        const replySubject = `[SupportReply:${question.id}] Re: ${baseSubject}`.slice(0, 255);

        db.query(
          "INSERT INTO messages (sender_id, recipient_email, subject, body, is_read) VALUES (?, ?, ?, ?, 1)",
          [req.user.id, question.sender_email, replySubject, String(body).trim()],
          (insertErr, result) => {
            if (insertErr) return res.status(500).json({ error: "Failed to send support reply" });

            db.query(
              "UPDATE messages SET is_read = 1 WHERE id = ?",
              [question.id],
              () => {
                res.json({ message: "Reply sent", id: result.insertId });
              }
            );
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================
// EXTERNAL LIBRARIES — Federated Search
// Metadata only, links back to source (legally compliant)
// ==========================

// List connected external libraries
app.get("/external-libraries", (req, res) => {
  res.json([
    {
      id: "armunicat",
      name: "Armunicat — Համահավաք գրացուցակ",
      description: "Հայաստանի գրադարանների համահավաք գրացուցակ (Armenian Libraries Union Catalog)",
      url: "http://www.armunicat.am",
      protocol: "OPAC (Koha)",
      type: "Armenian Libraries"
    },
    {
      id: "nla_armenia",
      name: "Հայաստանի ազգային գրադարան",
      description: "National Library of Armenia — Հայաստանի Հանրապետության գլխավոր գրադարանը",
      url: "https://www.nla.am",
      protocol: "OPAC",
      type: "National Library"
    },
    {
      id: "fsl_nas",
      name: "ՀՀ ԳԱԱ Հիմնարար գիտական գրադարան",
      description: "Fundamental Scientific Library of NAS RA — Հայաստանի ԳԱԱ-ի գիտական գրադարան, հիմնադրված 1935 թ.",
      url: "http://www.flib.sci.am",
      protocol: "OPAC",
      type: "Scientific Library"
    },
    {
      id: "arch_library",
      name: "Library for Architecture",
      description: "Ճարտարապետությանը նվիրված մասնագիտացված ռեսուրս — Architecture, Urban Design, Construction",
      url: "https://archnet.org",
      protocol: "Web Search",
      type: "Architecture & Design"
    },
    {
      id: "openlibrary",
      name: "Open Library",
      description: "Internet Archive's open, editable library catalog",
      url: "https://openlibrary.org",
      protocol: "API",
      type: "Books & Publications"
    },
    {
      id: "crossref",
      name: "CrossRef",
      description: "Official DOI registration agency for scholarly publications",
      url: "https://www.crossref.org",
      protocol: "API + DOI",
      type: "Academic Papers & Journals"
    },
    {
      id: "google_books",
      name: "Google Books",
      description: "Google's comprehensive book search and preview service",
      url: "https://books.google.com",
      protocol: "API",
      type: "Books & Previews"
    }
  ]);
});

// Federated search across external libraries (query, don't copy)
app.get("/external-search", async (req, res) => {
  try {
    const { query, source, limit = 10, field } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const searchLimit = Math.min(parseInt(limit) || 10, 20);
    const results = {};
    const errors = {};

    const fieldKeywords = {
      informatics: [
        "informatics",
        "computer science",
        "programming",
        "software engineering",
        "algorithms",
        "data structures",
        "database",
        "artificial intelligence",
        "machine learning",
        "web development",
        "cybersecurity",
        "operating systems",
        "computer networks",
        "compiler design",
        "distributed systems",
        "cloud computing",
        "data mining"
      ],
      mathematics: [
        "mathematics",
        "algebra",
        "linear algebra",
        "calculus",
        "discrete mathematics",
        "probability",
        "statistics",
        "numerical methods",
        "optimization",
        "mathematical logic"
      ],
      architecture: ["architecture", "urban design", "building design", "architectural history"],
      design: ["design", "graphic design", "industrial design", "interior design"],
      construction: ["construction", "civil engineering", "structural analysis", "building materials"],
      urban_economy: ["urban economics", "urban planning", "sustainability", "ecology"],
      management_technology: ["project management", "technology management", "innovation", "operations"]
    };

    const normalizedField = (field || "").toString().trim().toLowerCase();
    const keywords = fieldKeywords[normalizedField] || [];
    const expandedQuery = keywords.length > 0
      ? `${query} ${keywords.slice(0, 4).join(" ")}`
      : query;

    // Determine which sources to search
    const searchAll = !source || source === "all";

    // 1. Open Library API (free, no key)
    if (searchAll || source === "openlibrary") {
      try {
        const olRes = await axios.get("https://openlibrary.org/search.json", {
          params: { q: expandedQuery, limit: searchLimit, fields: "key,title,author_name,first_publish_year,isbn,subject,publisher,language,cover_i" },
          timeout: 8000
        });

        results.openlibrary = (olRes.data.docs || []).map(doc => ({
          source: "Open Library",
          source_id: "openlibrary",
          title: doc.title,
          authors: doc.author_name || [],
          year: doc.first_publish_year || null,
          isbn: doc.isbn ? doc.isbn[0] : null,
          subjects: (doc.subject || []).slice(0, 5),
          publisher: (doc.publisher || [])[0] || null,
          language: (doc.language || [])[0] || null,
          cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
          external_url: `https://openlibrary.org${doc.key}`,
          link_type: "catalog"
        }));
      } catch (err) {
        errors.openlibrary = err.message;
        results.openlibrary = [];
      }
    }

    // 2. CrossRef API (free, no key — DOI links)
    if (searchAll || source === "crossref") {
      try {
        const crRes = await axios.get("https://api.crossref.org/works", {
          params: {
            "query.bibliographic": expandedQuery,
            rows: searchLimit,
            select: "DOI,title,author,published-print,published-online,container-title,type,subject,publisher,URL"
          },
          headers: { "User-Agent": "NUACALibrary/1.0 (mailto:info@nuaca.am)" },
          timeout: 8000
        });

        results.crossref = (crRes.data.message?.items || []).map(item => {
          const pubDate = item["published-print"]?.["date-parts"]?.[0] ||
                          item["published-online"]?.["date-parts"]?.[0];
          return {
            source: "CrossRef",
            source_id: "crossref",
            title: (item.title || [])[0] || "Untitled",
            authors: (item.author || []).map(a => `${a.given || ""} ${a.family || ""}`.trim()),
            year: pubDate ? pubDate[0] : null,
            doi: item.DOI,
            journal: (item["container-title"] || [])[0] || null,
            type: item.type || null,
            subjects: (item.subject || []).slice(0, 5),
            publisher: item.publisher || null,
            external_url: `https://doi.org/${item.DOI}`,
            link_type: "DOI"
          };
        });
      } catch (err) {
        errors.crossref = err.message;
        results.crossref = [];
      }
    }

    // 3. Google Books API (free, limited)
    if (searchAll || source === "google_books") {
      try {
        const gbRes = await axios.get("https://www.googleapis.com/books/v1/volumes", {
          params: { q: expandedQuery, maxResults: searchLimit, printType: "books" },
          timeout: 8000
        });

        results.google_books = (gbRes.data.items || []).map(item => {
          const info = item.volumeInfo || {};
          return {
            source: "Google Books",
            source_id: "google_books",
            title: info.title || "Untitled",
            authors: info.authors || [],
            year: info.publishedDate ? parseInt(info.publishedDate) : null,
            isbn: (info.industryIdentifiers || []).find(id => id.type === "ISBN_13")?.identifier || null,
            description: info.description ? info.description.substring(0, 200) + "..." : null,
            publisher: info.publisher || null,
            language: info.language || null,
            cover_url: info.imageLinks?.thumbnail || null,
            page_count: info.pageCount || null,
            preview_url: info.previewLink || null,
            external_url: info.infoLink || info.previewLink || `https://books.google.com/books?id=${item.id}`,
            link_type: "catalog"
          };
        });
      } catch (err) {
        errors.google_books = err.message;
        results.google_books = [];
      }
    }

    // 4. Armunicat — Armenian Libraries Union Catalog
    if (searchAll || source === "armunicat") {
      const encodedQuery = encodeURIComponent(query);
      results.armunicat = [{
        source: "Armunicat",
        source_id: "armunicat",
        title: `Արդյունքներ «${query}» — Armunicat`,
        description: "Հայաստանի գրադարանների համահավաք գրացուցակ — ներառում է Հայաստանի հիմնական գրադարանների ֆոնդերի տվյալները։",
        external_url: `http://www.armunicat.am/cgi-bin/koha/opac-search.pl?q=${encodedQuery}`,
        link_type: "search_page",
        authors: [],
        subjects: []
      }];
    }

    // 5. National Library of Armenia
    if (searchAll || source === "nla_armenia") {
      const encodedQuery = encodeURIComponent(query);
      results.nla_armenia = [{
        source: "Հայաստանի ազգային գրադարան",
        source_id: "nla_armenia",
        title: `Արդյունքներ «${query}» — Հայաստանի ազգային գրադարան`,
        description: "Հայաստանի Հանրապետության գլխավոր գրադարանը, ազգային հավաքածուի պահապան (National Library of Armenia).",
        external_url: `https://www.nla.am/arm/catalog?search=${encodedQuery}`,
        link_type: "search_page",
        authors: [],
        subjects: []
      }];
    }

    // 6. FSL NAS RA — Fundamental Scientific Library
    if (searchAll || source === "fsl_nas") {
      const encodedQuery = encodeURIComponent(query);
      results.fsl_nas = [{
        source: "ՀՀ ԳԱԱ Հիմնարար գիտական գրադարան",
        source_id: "fsl_nas",
        title: `Արդյունքներ «${query}» — ՀՀ ԳԱԱ Հիմնարար գիտական գրադարան`,
        description: "ՀՀ Գիտությունների ազգային ակադեմիայի Հիմնարար գիտական գրադարան, հիմնադրված 1935 թ. — Fundamental Scientific Library of NAS RA.",
        external_url: `http://www.flib.sci.am/search/?q=${encodedQuery}`,
        link_type: "search_page",
        authors: [],
        subjects: []
      }];
    }

    // 7. Library for Architecture
    if (searchAll || source === "arch_library") {
      const encodedQuery = encodeURIComponent(query);
      results.arch_library = [{
        source: "Library for Architecture",
        source_id: "arch_library",
        title: `Արդյունքներ «${query}» — Library for Architecture`,
        description: "Ճարտարապետությանը, քաղաքաշինությանը և կառուցապատմանը նվիրված մասնագիտացված գրական ռեսուրս (ArchNet).",
        external_url: `https://archnet.org/search?q=${encodedQuery}`,
        link_type: "search_page",
        authors: [],
        subjects: []
      }];
    }

    const totalResults =
      (results.openlibrary?.length || 0) +
      (results.crossref?.length || 0) +
      (results.google_books?.length || 0) +
      (results.armunicat?.length || 0) +
      (results.nla_armenia?.length || 0) +
      (results.fsl_nas?.length || 0) +
      (results.arch_library?.length || 0);

    res.json({
      query,
      expandedQuery,
      field: normalizedField || undefined,
      total: totalResults,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    });

  } catch (err) {
    res.status(500).json({ error: "External search failed: " + err.message });
  }
});

// Resolve DOI to source URL (redirect)
app.get("/resolve/doi", (req, res) => {
  const doi = req.query.id;
  if (!doi) return res.status(400).json({ error: "DOI is required" });
  res.redirect(`https://doi.org/${encodeURIComponent(doi)}`);
});

// ==========================
// OAI-PMH ENDPOINT (Metadata Harvesting)
// ==========================
// Implements OAI-PMH 2.0 protocol for metadata harvesting
// Supports verbs: Identify, ListRecords, GetRecord, ListMetadataFormats, ListIdentifiers

const OAI_BASE_URL = "http://localhost:5000/oai";
const REPOSITORY_NAME = "NUACA Digital Library";
const ADMIN_EMAIL = "info@nuaca.am";

// Helper: format date to OAI-PMH datestamp
const toOAIDatestamp = (date) => {
  if (!date) return new Date().toISOString().split("T")[0];
  return new Date(date).toISOString().split("T")[0];
};

// Helper: convert book/diploma to Dublin Core XML
const toDublinCore = (record, type) => {
  const escape = (str) => str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";

  if (type === "book") {
    return `
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${escape(record.title)}</dc:title>
        <dc:creator>${escape(record.author)}</dc:creator>
        ${record.description ? `<dc:description>${escape(record.description)}</dc:description>` : ""}
        ${record.category ? `<dc:subject>${escape(record.category)}</dc:subject>` : ""}
        ${record.faculty ? `<dc:subject>${escape(record.faculty)}</dc:subject>` : ""}
        <dc:type>Book</dc:type>
        <dc:format>application/pdf</dc:format>
        <dc:identifier>oai:nuaca.am:book-${record.id}</dc:identifier>
        <dc:date>${toOAIDatestamp(record.created_at)}</dc:date>
        <dc:publisher>NUACA Digital Library</dc:publisher>
        <dc:language>en</dc:language>
      </oai_dc:dc>`;
  } else {
    return `
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${escape(record.title)}</dc:title>
        <dc:creator>${escape(record.student)}</dc:creator>
        <dc:contributor>${escape(record.supervisor)}</dc:contributor>
        ${record.description ? `<dc:description>${escape(record.description)}</dc:description>` : ""}
        ${record.department ? `<dc:subject>${escape(record.department)}</dc:subject>` : ""}
        <dc:type>Thesis</dc:type>
        <dc:format>application/pdf</dc:format>
        <dc:identifier>oai:nuaca.am:diploma-${record.id}</dc:identifier>
        ${record.year ? `<dc:date>${record.year}</dc:date>` : ""}
        <dc:publisher>NUACA</dc:publisher>
        <dc:language>en</dc:language>
      </oai_dc:dc>`;
  }
};

// Helper: convert to MARC21 XML
const toMARC21 = (record, type) => {
  const escape = (str) => str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

  if (type === "book") {
    return `
      <record xmlns="http://www.loc.gov/MARC21/slim">
        <leader>     nam a22     4500</leader>
        <controlfield tag="001">book-${record.id}</controlfield>
        <controlfield tag="005">${new Date(record.created_at || Date.now()).toISOString().replace(/[-:T]/g, "").slice(0, 14)}.0</controlfield>
        <controlfield tag="008">${new Date(record.created_at || Date.now()).toISOString().slice(2, 10).replace(/-/g, "")}s    xx            000 0 eng d</controlfield>
        <datafield tag="020" ind1=" " ind2=" "><subfield code="a">${escape(record.isbn || "")}</subfield></datafield>
        <datafield tag="100" ind1="1" ind2=" "><subfield code="a">${escape(record.author)}</subfield></datafield>
        <datafield tag="245" ind1="1" ind2="0"><subfield code="a">${escape(record.title)}</subfield></datafield>
        ${record.description ? `<datafield tag="520" ind1=" " ind2=" "><subfield code="a">${escape(record.description)}</subfield></datafield>` : ""}
        ${record.category ? `<datafield tag="650" ind1=" " ind2="4"><subfield code="a">${escape(record.category)}</subfield></datafield>` : ""}
        <datafield tag="710" ind1="2" ind2=" "><subfield code="a">NUACA Digital Library</subfield></datafield>
        <datafield tag="856" ind1="4" ind2="0"><subfield code="u">${OAI_BASE_URL.replace("/oai", "")}/uploads/${escape(record.filename)}</subfield></datafield>
      </record>`;
  } else {
    return `
      <record xmlns="http://www.loc.gov/MARC21/slim">
        <leader>     nam a22     4500</leader>
        <controlfield tag="001">diploma-${record.id}</controlfield>
        <controlfield tag="005">${new Date(record.created_at || Date.now()).toISOString().replace(/[-:T]/g, "").slice(0, 14)}.0</controlfield>
        <datafield tag="100" ind1="1" ind2=" "><subfield code="a">${escape(record.student)}</subfield></datafield>
        <datafield tag="245" ind1="1" ind2="0"><subfield code="a">${escape(record.title)}</subfield></datafield>
        <datafield tag="502" ind1=" " ind2=" "><subfield code="a">Thesis</subfield><subfield code="c">NUACA</subfield>${record.year ? `<subfield code="d">${record.year}</subfield>` : ""}</datafield>
        <datafield tag="700" ind1="1" ind2=" "><subfield code="a">${escape(record.supervisor)}</subfield><subfield code="e">advisor</subfield></datafield>
        ${record.department ? `<datafield tag="650" ind1=" " ind2="4"><subfield code="a">${escape(record.department)}</subfield></datafield>` : ""}
        ${record.description ? `<datafield tag="520" ind1=" " ind2=" "><subfield code="a">${escape(record.description)}</subfield></datafield>` : ""}
      </record>`;
  }
};

// OAI-PMH main endpoint
app.get("/oai", (req, res) => {
  const verb = req.query.verb;
  res.set("Content-Type", "text/xml; charset=utf-8");

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${new Date().toISOString()}</responseDate>
  <request verb="${verb || ""}">${OAI_BASE_URL}</request>`;

  if (!verb) {
    return res.send(`${xmlHeader}\n  <error code="badVerb">No verb specified</error>\n</OAI-PMH>`);
  }

  // Identify
  if (verb === "Identify") {
    return res.send(`${xmlHeader}
  <Identify>
    <repositoryName>${REPOSITORY_NAME}</repositoryName>
    <baseURL>${OAI_BASE_URL}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${ADMIN_EMAIL}</adminEmail>
    <earliestDatestamp>2024-01-01</earliestDatestamp>
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
    <description>
      <oai-identifier xmlns="http://www.openarchives.org/OAI/2.0/oai-identifier"
                      xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai-identifier http://www.openarchives.org/OAI/2.0/oai-identifier.xsd">
        <scheme>oai</scheme>
        <repositoryIdentifier>nuaca.am</repositoryIdentifier>
        <delimiter>:</delimiter>
        <sampleIdentifier>oai:nuaca.am:book-1</sampleIdentifier>
      </oai-identifier>
    </description>
  </Identify>
</OAI-PMH>`);
  }

  // ListMetadataFormats
  if (verb === "ListMetadataFormats") {
    return res.send(`${xmlHeader}
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
    <metadataFormat>
      <metadataPrefix>marc21</metadataPrefix>
      <schema>http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd</schema>
      <metadataNamespace>http://www.loc.gov/MARC21/slim</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>
</OAI-PMH>`);
  }

  // GetRecord
  if (verb === "GetRecord") {
    const identifier = req.query.identifier;
    const metadataPrefix = req.query.metadataPrefix || "oai_dc";

    if (!identifier) {
      return res.send(`${xmlHeader}\n  <error code="badArgument">Missing identifier</error>\n</OAI-PMH>`);
    }

    const match = identifier.match(/^oai:nuaca\.am:(book|diploma)-(\d+)$/);
    if (!match) {
      return res.send(`${xmlHeader}\n  <error code="idDoesNotExist">Invalid identifier format</error>\n</OAI-PMH>`);
    }

    const [, type, id] = match;
    const table = type === "book" ? "books" : "diploma_works";

    db.query(`SELECT * FROM ${table} WHERE id = ? AND approved = 1`, [id], (err, results) => {
      if (err || results.length === 0) {
        return res.send(`${xmlHeader}\n  <error code="idDoesNotExist">Record not found</error>\n</OAI-PMH>`);
      }

      const record = results[0];
      const metadata = metadataPrefix === "marc21" ? toMARC21(record, type) : toDublinCore(record, type);

      res.send(`${xmlHeader}
  <GetRecord>
    <record>
      <header>
        <identifier>${identifier}</identifier>
        <datestamp>${toOAIDatestamp(record.updated_at || record.created_at)}</datestamp>
        <setSpec>${type}s</setSpec>
      </header>
      <metadata>${metadata}
      </metadata>
    </record>
  </GetRecord>
</OAI-PMH>`);
    });
    return;
  }

  // ListIdentifiers & ListRecords
  if (verb === "ListIdentifiers" || verb === "ListRecords") {
    const metadataPrefix = req.query.metadataPrefix || "oai_dc";
    const set = req.query.set;
    const from = req.query.from;
    const until = req.query.until;

    const fetchBooks = () => {
      return new Promise((resolve, reject) => {
        let q = "SELECT * FROM books WHERE approved = 1";
        const params = [];
        if (from) { q += " AND created_at >= ?"; params.push(from); }
        if (until) { q += " AND created_at <= ?"; params.push(until + " 23:59:59"); }
        q += " ORDER BY id ASC LIMIT 100";
        db.query(q, params, (err, rows) => err ? reject(err) : resolve(rows));
      });
    };

    const fetchDiplomas = () => {
      return new Promise((resolve, reject) => {
        let q = "SELECT * FROM diploma_works WHERE approved = 1";
        const params = [];
        if (from) { q += " AND created_at >= ?"; params.push(from); }
        if (until) { q += " AND created_at <= ?"; params.push(until + " 23:59:59"); }
        q += " ORDER BY id ASC LIMIT 100";
        db.query(q, params, (err, rows) => err ? reject(err) : resolve(rows));
      });
    };

    const searches = [];
    if (!set || set === "books") searches.push(fetchBooks().then(rows => rows.map(r => ({ ...r, _type: "book" }))));
    if (!set || set === "diplomas") searches.push(fetchDiplomas().then(rows => rows.map(r => ({ ...r, _type: "diploma" }))));

    Promise.all(searches)
      .then(results => {
        const allRecords = results.flat();

        if (allRecords.length === 0) {
          return res.send(`${xmlHeader}\n  <error code="noRecordsMatch">No records match the request</error>\n</OAI-PMH>`);
        }

        const recordsXml = allRecords.map(record => {
          const identifier = `oai:nuaca.am:${record._type}-${record.id}`;
          const datestamp = toOAIDatestamp(record.updated_at || record.created_at);

          if (verb === "ListIdentifiers") {
            return `    <header>
      <identifier>${identifier}</identifier>
      <datestamp>${datestamp}</datestamp>
      <setSpec>${record._type}s</setSpec>
    </header>`;
          }

          const metadata = metadataPrefix === "marc21"
            ? toMARC21(record, record._type)
            : toDublinCore(record, record._type);

          return `    <record>
      <header>
        <identifier>${identifier}</identifier>
        <datestamp>${datestamp}</datestamp>
        <setSpec>${record._type}s</setSpec>
      </header>
      <metadata>${metadata}
      </metadata>
    </record>`;
        }).join("\n");

        res.send(`${xmlHeader}
  <${verb}>
${recordsXml}
  </${verb}>
</OAI-PMH>`);
      })
      .catch(() => {
        res.send(`${xmlHeader}\n  <error code="badArgument">Server error fetching records</error>\n</OAI-PMH>`);
      });
    return;
  }

  // ListSets
  if (verb === "ListSets") {
    return res.send(`${xmlHeader}
  <ListSets>
    <set>
      <setSpec>books</setSpec>
      <setName>Library Books</setName>
    </set>
    <set>
      <setSpec>diplomas</setSpec>
      <setName>Diploma Works / Theses</setName>
    </set>
  </ListSets>
</OAI-PMH>`);
  }

  res.send(`${xmlHeader}\n  <error code="badVerb">Unknown verb: ${verb}</error>\n</OAI-PMH>`);
});

// ==========================
// METADATA EXPORT ENDPOINTS
// ==========================

// Dublin Core JSON export for a single record
app.get("/export/dc/:type/:id", (req, res) => {
  const { type, id } = req.params;
  const table = type === "book" ? "books" : type === "diploma" ? "diploma_works" : null;
  if (!table) return res.status(400).json({ error: "Type must be 'book' or 'diploma'" });

  db.query(`SELECT * FROM ${table} WHERE id = ? AND approved = 1`, [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: "Record not found" });
    const r = results[0];

    if (type === "book") {
      res.json({
        "dc:title": r.title,
        "dc:creator": r.author,
        "dc:description": r.description || "",
        "dc:subject": [r.category, r.faculty].filter(Boolean),
        "dc:type": "Book",
        "dc:format": "application/pdf",
        "dc:identifier": `oai:nuaca.am:book-${r.id}`,
        "dc:date": toOAIDatestamp(r.created_at),
        "dc:publisher": "NUACA Digital Library",
        "dc:language": "en"
      });
    } else {
      res.json({
        "dc:title": r.title,
        "dc:creator": r.student,
        "dc:contributor": r.supervisor,
        "dc:description": r.description || "",
        "dc:subject": [r.department].filter(Boolean),
        "dc:type": "Thesis",
        "dc:format": "application/pdf",
        "dc:identifier": `oai:nuaca.am:diploma-${r.id}`,
        "dc:date": r.year ? String(r.year) : "",
        "dc:publisher": "NUACA",
        "dc:language": "en"
      });
    }
  });
});

// MARC21 XML export for a single record
app.get("/export/marc21/:type/:id", (req, res) => {
  const { type, id } = req.params;
  const table = type === "book" ? "books" : type === "diploma" ? "diploma_works" : null;
  if (!table) return res.status(400).json({ error: "Type must be 'book' or 'diploma'" });

  db.query(`SELECT * FROM ${table} WHERE id = ? AND approved = 1`, [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: "Record not found" });
    const record = results[0];
    const marcXml = toMARC21(record, type);
    res.set("Content-Type", "text/xml; charset=utf-8");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="http://www.loc.gov/MARC21/slim">${marcXml}\n</collection>`);
  });
});

// WorldCat-compatible MARCXML bulk export
app.get("/export/worldcat", (req, res) => {
  const fetchBooks = new Promise((resolve, reject) => {
    db.query("SELECT * FROM books WHERE approved = 1 ORDER BY id ASC", (err, rows) => err ? reject(err) : resolve(rows));
  });
  const fetchDiplomas = new Promise((resolve, reject) => {
    db.query("SELECT * FROM diploma_works WHERE approved = 1 ORDER BY id ASC", (err, rows) => err ? reject(err) : resolve(rows));
  });

  Promise.all([fetchBooks, fetchDiplomas])
    .then(([books, diplomas]) => {
      const records = [
        ...books.map(b => toMARC21(b, "book")),
        ...diplomas.map(d => toMARC21(d, "diploma"))
      ].join("\n");

      res.set("Content-Type", "text/xml; charset=utf-8");
      res.set("Content-Disposition", "attachment; filename=nuaca_worldcat_export.xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://www.loc.gov/MARC21/slim http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd">
${records}
</collection>`);
    })
    .catch(err => {
      res.status(500).json({ error: "Export failed: " + err.message });
    });
});

// ==========================
// NOTIFICATIONS
// ==========================

// Get unread count (for bell badge)
app.get("/notifications/count", verifyToken, (req, res) => {
  db.query(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ count: rows[0].count });
    }
  );
});

// Get all notifications for user
app.get("/notifications", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Mark a single notification as read
app.put("/notifications/:id/read", verifyToken, (req, res) => {
  db.query(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ message: "Marked as read" });
    }
  );
});

// Mark all as read
app.put("/notifications/read-all", verifyToken, (req, res) => {
  db.query(
    "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
    [req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ message: "All marked as read" });
    }
  );
});

// Admin: send notification to all users or specific user
app.post("/admin/notifications", verifyToken, isAdmin, (req, res) => {
  const { user_id, title, message, type, link_page } = req.body;
  if (!title || !message) return res.status(400).json({ error: "Title and message required" });

  if (user_id) {
    // Send to specific user
    db.query(
      "INSERT INTO notifications (user_id, title, message, type, link_page) VALUES (?, ?, ?, ?, ?)",
      [user_id, title, message, type || "info", link_page || null],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to send notification" });
        res.json({ message: "Notification sent" });
      }
    );
  } else {
    // Broadcast to all users
    db.query("SELECT id FROM users", (err, users) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (users.length === 0) return res.json({ message: "No users to notify" });

      const values = users.map(u => [u.id, title, message, type || "info", link_page || null]);
      db.query(
        "INSERT INTO notifications (user_id, title, message, type, link_page) VALUES ?",
        [values],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Failed to broadcast notification" });
          res.json({ message: `Notification sent to ${users.length} users` });
        }
      );
    });
  }
});

// ==========================
// COURSE ENROLLMENT
// ==========================

// Enroll in a course
app.post("/courses/:id/enroll", verifyToken, (req, res) => {
  const courseId = req.params.id;
  db.query("SELECT id, name FROM courses WHERE id = ?", [courseId], (err, courses) => {
    if (err || courses.length === 0) return res.status(404).json({ error: "Course not found" });

    db.query(
      "INSERT IGNORE INTO course_enrollments (user_id, course_id) VALUES (?, ?)",
      [req.user.id, courseId],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: "Enrollment failed" });
        if (result.affectedRows === 0) return res.status(400).json({ error: "Already enrolled" });

        // Send notification to student
        db.query(
          "INSERT INTO notifications (user_id, title, message, type, link_page) VALUES (?, ?, ?, ?, ?)",
          [req.user.id, "Course Enrolled", `You have successfully enrolled in "${courses[0].name}".`, "success", "courses"],
          () => {}
        );

        res.json({ message: `Enrolled in ${courses[0].name}` });
      }
    );
  });
});

// Unenroll from a course
app.delete("/courses/:id/enroll", verifyToken, (req, res) => {
  db.query(
    "DELETE FROM course_enrollments WHERE user_id = ? AND course_id = ?",
    [req.user.id, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to unenroll" });
      res.json({ message: "Unenrolled" });
    }
  );
});

// Get my enrolled courses
app.get("/my-enrollments", verifyToken, (req, res) => {
  db.query(
    `SELECT ce.course_id, ce.enrolled_at, c.code, c.name, c.semester, c.credits, u.name as instructor_name
     FROM course_enrollments ce
     JOIN courses c ON ce.course_id = c.id
     LEFT JOIN users u ON c.instructor_id = u.id
     WHERE ce.user_id = ?
     ORDER BY ce.enrolled_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Get enrollment count for a course (public)
app.get("/courses/:id/enrollment-count", (req, res) => {
  db.query(
    "SELECT COUNT(*) as count FROM course_enrollments WHERE course_id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ count: rows[0].count });
    }
  );
});

// ==========================
// ADMIN ANALYTICS
// ==========================
app.get("/admin/analytics", verifyToken, isAdmin, (req, res) => {
  Promise.all([
    // Top 5 most downloaded books
    new Promise((resolve) => {
      db.query(
        "SELECT title, author, downloads, views FROM books WHERE approved = 1 ORDER BY downloads DESC LIMIT 5",
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Top 5 most viewed diploma works
    new Promise((resolve) => {
      db.query(
        "SELECT title, student, downloads, views FROM diploma_works WHERE approved = 1 ORDER BY views DESC LIMIT 5",
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Users by role
    new Promise((resolve) => {
      db.query(
        "SELECT role, COUNT(*) as count FROM users GROUP BY role",
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Books by faculty
    new Promise((resolve) => {
      db.query(
        "SELECT faculty, COUNT(*) as count FROM books WHERE approved = 1 GROUP BY faculty ORDER BY count DESC",
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Support tickets by category
    new Promise((resolve) => {
      db.query(
        `SELECT TRIM(BOTH ']' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(subject, '[Support:', -1), ']', 1)) AS category,
                COUNT(*) as count
         FROM messages WHERE subject LIKE '[Support:%' GROUP BY category ORDER BY count DESC`,
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // New users per month (last 6 months)
    new Promise((resolve) => {
      db.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
         FROM users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
         GROUP BY month ORDER BY month ASC`,
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Book uploads per month (last 6 months)
    new Promise((resolve) => {
      db.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
         FROM books
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
         GROUP BY month ORDER BY month ASC`,
        (err, rows) => resolve(err ? [] : rows)
      );
    }),
    // Total stats
    new Promise((resolve) => {
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM users) as total_users,
           (SELECT COUNT(*) FROM books WHERE approved = 1) as total_books,
           (SELECT COALESCE(SUM(downloads), 0) FROM books) as total_downloads,
           (SELECT COUNT(*) FROM book_reservations WHERE status IN ('reserved','borrowed')) as active_reservations,
           (SELECT COUNT(*) FROM course_enrollments) as total_enrollments,
           (SELECT COUNT(*) FROM messages WHERE subject LIKE '[Support:%') as total_tickets`,
        (err, rows) => resolve(err ? {} : rows[0])
      );
    })
  ]).then(([topBooks, topDiplomas, usersByRole, booksByFaculty, ticketsByCategory, newUsers, bookUploads, totals]) => {
    res.json({ topBooks, topDiplomas, usersByRole, booksByFaculty, ticketsByCategory, newUsers, bookUploads, totals });
  }).catch(() => res.status(500).json({ error: "Analytics failed" }));
});

// ==========================
// AUDIT LOG
// ==========================

// Log helper function
const logAudit = (userId, userName, userRole, action, targetType, targetId, details, ip) => {
  db.query(
    "INSERT INTO audit_log (user_id, user_name, user_role, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [userId, userName, userRole, action, targetType || null, targetId || null, details || null, ip || null],
    (err) => { if (err) console.error("Audit log error:", err.message); }
  );
};

// Admin: view audit log
app.get("/admin/audit-log", verifyToken, isAdmin, (req, res) => {
  const { limit = 100, offset = 0, action, user_id } = req.query;
  let query = "SELECT * FROM audit_log";
  const params = [];
  const conditions = [];

  if (action) { conditions.push("action LIKE ?"); params.push(`%${action}%`); }
  if (user_id) { conditions.push("user_id = ?"); params.push(user_id); }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  db.query(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

// Middleware to auto-log important actions — wrap existing endpoints by calling logAudit after key operations
// (Login audit)
app.post("/audit/login", verifyToken, (req, res) => {
  logAudit(req.user.id, req.user.name, req.user.role, "LOGIN", null, null, "User logged in", req.ip);
  res.json({ ok: true });
});

// ==========================
// MESSAGES INBOX
// ==========================

// Get inbox (messages sent to user's email)
app.get("/messages/inbox", verifyToken, (req, res) => {
  db.query(
    `SELECT m.*, u.name as sender_name, u.role as sender_role
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     WHERE m.recipient_email = ?
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [req.user.email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Get sent messages
app.get("/messages/sent", verifyToken, (req, res) => {
  db.query(
    `SELECT m.*, u.name as recipient_name
     FROM messages m
     LEFT JOIN users u ON u.email = m.recipient_email
     WHERE m.sender_id = ?
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Mark message as read
app.put("/messages/:id/read", verifyToken, (req, res) => {
  db.query(
    "UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_email = ?",
    [req.params.id, req.user.email],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ message: "Marked as read" });
    }
  );
});

// Unread message count
app.get("/messages/unread-count", verifyToken, (req, res) => {
  db.query(
    "SELECT COUNT(*) as count FROM messages WHERE recipient_email = ? AND is_read = 0",
    [req.user.email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ count: rows[0].count });
    }
  );
});

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log("📚 University Digital Library API");
  console.log(`📡 OAI-PMH endpoint: http://localhost:${PORT}/oai?verb=Identify`);
});

// List distinct event groups for calendar filters
app.get("/events/groups", (req, res) => {
  try {
    db.query(
      "SELECT DISTINCT target_group FROM calendar_events WHERE target_group IS NOT NULL AND target_group <> '' AND target_group <> 'all' ORDER BY target_group ASC",
      (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to fetch groups" });
        res.json(results.map((row) => row.target_group));
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});