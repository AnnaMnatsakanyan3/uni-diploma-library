const mysql = require('./backend/node_modules/mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: '',
  database: 'uni_diploma'
});

db.connect((err) => {
  if (err) {
    console.error('DB connect error:', err.message);
    process.exit(1);
  }

  console.log('Connected to DB');

  const queries = [
    "ALTER TABLE users ADD COLUMN course_code VARCHAR(30) NULL",
    "ALTER TABLE users ADD INDEX idx_course_code (course_code)"
  ];

  let done = 0;
  queries.forEach((query, index) => {
    db.query(query, (queryErr) => {
      if (queryErr) {
        if (queryErr.message.includes('Duplicate column') || queryErr.message.includes('Duplicate key name')) {
          console.log(`Query ${index + 1} SKIPPED (${queryErr.message})`);
        } else {
          console.error(`Query ${index + 1} error:`, queryErr.message);
        }
      } else {
        console.log(`Query ${index + 1} OK`);
      }

      done += 1;
      if (done === queries.length) {
        console.log('Users course migration done!');
        db.end();
      }
    });
  });
});
