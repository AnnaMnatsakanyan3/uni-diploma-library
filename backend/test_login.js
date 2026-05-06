const db = require("./db");

console.log("Testing login query...");

db.query("SELECT * FROM users WHERE email = ?", ["admin@nuaca.am"], (err, result) => {
  if (err) {
    console.error("ERROR:", err.code, err.message);
  } else {
    console.log("Success! Rows found:", result.length);
    if (result.length > 0) {
      console.log("User:", result[0].id, result[0].name, result[0].role);
      console.log("Has password:", !!result[0].password);
    }
  }
  db.end();
  process.exit(0);
});
