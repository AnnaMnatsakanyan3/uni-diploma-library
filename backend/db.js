
const mysql = require("mysql2");

// Use a pool so requests can recover from dropped/stale single connections.
const db = mysql.createPool({
  host: "localhost",
  user: "root",         // default XAMPP user
  password: "",         // default XAMPP password (blank)
  database: "uni_diploma",
  port: 3307,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("MySQL pool connection failed:", err.code, err.message);
    return;
  }
  console.log("MySQL pool connected successfully!");
  connection.release();
});

module.exports = db;