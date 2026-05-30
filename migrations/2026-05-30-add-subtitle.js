const Database = require("better-sqlite3");
const db = new Database("stamps.db");

// Add sub_title to blocks
try {
    db.prepare("ALTER TABLE blocks ADD COLUMN sub_title TEXT").run();
    console.log("Added sub_title to blocks");
} catch (e) {
    if (!/duplicate column/i.test(e.message)) throw e;
    console.log("sub_title column already exists");
}

console.log("Migration complete.");
