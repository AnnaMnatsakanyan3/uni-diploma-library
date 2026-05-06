const db = require("./db");
const fs = require("fs");
const path = require("path");

const setupDatabase = () => {
  // Read the SQL setup file
  const sqlFile = path.join(__dirname, "../database_setup.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");

  // Split by semicolons and execute each statement
  const statements = sql.split(";").filter(stmt => stmt.trim());

  let executed = 0;

  const executeNext = (index) => {
    if (index >= statements.length) {
      console.log(`\n✓ Database setup complete. ${executed} statements executed.`);
      db.end();
      process.exit(0);
      return;
    }

    const statement = statements[index].trim();
    if (!statement) {
      executeNext(index + 1);
      return;
    }

    db.query(statement + ";", (err, result) => {
      if (err) {
        // Some errors are OK (like "duplicate key" for insert on duplicate)
        if (err.code === "ER_DUP_ENTRY" || err.code === "ER_TABLE_EXISTS_ERROR" || err.message.includes("already exists")) {
          console.log(`⚠ Skipped (already exists): ${statement.substring(0, 60)}...`);
        } else {
          console.error(`✗ Error: ${err.message}`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      } else {
        executed++;
        console.log(`✓ Executed: ${statement.substring(0, 60)}...`);
      }
      executeNext(index + 1);
    });
  };

  executeNext(0);
};

console.log("Setting up database...");
setupDatabase();
