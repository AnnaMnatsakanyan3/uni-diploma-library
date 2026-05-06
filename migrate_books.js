const mysql = require('./backend/node_modules/mysql2');
const db = mysql.createConnection({ host: 'localhost', port: 3307, user: 'root', password: '', database: 'uni_diploma' });

db.connect(err => {
  if (err) { console.error('DB connect error:', err.message); process.exit(1); }
  console.log('Connected to DB');

  const queries = [
    "ALTER TABLE books ADD COLUMN book_type ENUM('online','physical','both') NOT NULL DEFAULT 'online'",
    "ALTER TABLE books ADD COLUMN total_copies INT DEFAULT 0",
    "ALTER TABLE books ADD COLUMN available_copies INT DEFAULT 0",
    `CREATE TABLE IF NOT EXISTS book_reservations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      book_id INT NOT NULL,
      status ENUM('reserved','borrowed','returned','overdue','cancelled') NOT NULL DEFAULT 'reserved',
      reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      borrowed_at DATETIME DEFAULT NULL,
      due_date DATETIME DEFAULT NULL,
      returned_at DATETIME DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      INDEX idx_user (user_id),
      INDEX idx_book (book_id),
      INDEX idx_status (status)
    )`
  ];

  let done = 0;
  queries.forEach((q, i) => {
    db.query(q, (err) => {
      if (err) {
        if (err.message.includes('Duplicate column')) {
          console.log('Query ' + (i+1) + ' SKIPPED (column already exists)');
        } else {
          console.error('Query ' + (i+1) + ' error:', err.message);
        }
      } else {
        console.log('Query ' + (i+1) + ' OK');
      }
      done++;
      if (done === queries.length) { console.log('Migration done!'); db.end(); }
    });
  });
});
