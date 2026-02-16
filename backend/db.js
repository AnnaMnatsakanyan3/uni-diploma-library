
const mysql = require("mysql2");

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",         // default XAMPP user
  password: "",         // default XAMPP password (blank)
  database: "uni_diploma"
});

db.connect(err => {
  if (err) throw err;
  console.log("MySQL connected successfully!");
});

module.exports = db;