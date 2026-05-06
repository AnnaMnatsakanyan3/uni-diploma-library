const mysql = require("./backend/node_modules/mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "uni_diploma",
  port: 3307
});

db.connect((err) => {
  if (err) {
    console.error("Connection error:", err);
    process.exit(1);
  }
  console.log("Connected to database.");

  // Get admin user id
  db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1", (err, rows) => {
    if (err || rows.length === 0) {
      console.error("No admin user found:", err);
      db.end();
      return;
    }

    const adminId = rows[0].id;

    const event = {
      title: "Thesis Defence Week",
      description: "Final thesis defence presentations for graduating students.",
      start_date: "2026-05-25 09:00:00",
      end_date: "2026-05-29 18:00:00",
      category: "general",
      color: "#9b59b6",
      location: "Main Auditorium",
      target_group: "all",
      created_by: adminId,
      send_reminders: 1,
      reminder_days: 3
    };

    db.query(
      "INSERT INTO calendar_events (title, description, start_date, end_date, category, color, location, target_group, created_by, send_reminders, reminder_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [event.title, event.description, event.start_date, event.end_date, event.category, event.color, event.location, event.target_group, event.created_by, event.send_reminders, event.reminder_days],
      (err, result) => {
        if (err) {
          console.error("Failed to insert event:", err);
        } else {
          console.log("Thesis Defence Week event added successfully! ID:", result.insertId);
        }
        db.end();
      }
    );
  });
});
