const mysql = require('./backend/node_modules/mysql2');
const bcrypt = require('./backend/node_modules/bcrypt');

const db = mysql.createConnection({ host:'localhost', port:3307, user:'root', password:'', database:'uni_diploma' });

db.connect(err => {
  if (err) { console.error('DB connect error:', err.message); process.exit(1); }

  // Check if admin exists
  db.query("SELECT id, name, email, role FROM users WHERE role='admin'", (err, rows) => {
    if (err) { console.error('Query error:', err.message); db.end(); return; }

    if (rows.length > 0) {
      console.log('Admin user(s) found:', rows);
      // Reset password to admin123
      const hash = bcrypt.hashSync('admin123', 10);
      db.query("UPDATE users SET password = ? WHERE email = 'admin@nuaca.am'", [hash], (err2) => {
        if (err2) console.error('Password reset error:', err2.message);
        else console.log('Admin password reset to: admin123');
        db.end();
      });
    } else {
      console.log('No admin found. Creating one...');
      const hash = bcrypt.hashSync('admin123', 10);
      db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Admin User', 'admin@nuaca.am', ?, 'admin')",
        [hash],
        (err2) => {
          if (err2) console.error('Create error:', err2.message);
          else console.log('Admin created: admin@nuaca.am / admin123');
          db.end();
        }
      );
    }
  });
});
