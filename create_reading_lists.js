const mysql = require("./backend/node_modules/mysql2");
const db = mysql.createConnection({ host: "localhost", port: 3307, user: "root", password: "", database: "uni_diploma" });

db.connect((err) => {
  if (err) { console.error("Connection error:", err.message); process.exit(1); }
  console.log("Connected.");

  const sql1 = `CREATE TABLE IF NOT EXISTS reading_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
  )`;

  const sql2 = `CREATE TABLE IF NOT EXISTS bookmark_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reading_list_id INT NOT NULL,
    material_id INT NOT NULL,
    material_type ENUM('book','diploma_work') NOT NULL DEFAULT 'book',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reading_list_id) REFERENCES reading_lists(id) ON DELETE CASCADE,
    UNIQUE KEY unique_item (reading_list_id, material_id, material_type),
    INDEX idx_list (reading_list_id)
  )`;

  db.query(sql1, (err) => {
    if (err) { console.error("reading_lists error:", err.message); db.end(); return; }
    console.log("reading_lists table created OK.");
    db.query(sql2, (err) => {
      if (err) { console.error("bookmark_items error:", err.message); }
      else { console.log("bookmark_items table created OK."); }
      db.end();
    });
  });
});
