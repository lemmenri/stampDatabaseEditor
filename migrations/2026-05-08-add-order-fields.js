const Database = require("better-sqlite3");
const db = new Database("stamps.db");

// Add block_order to blocks
try {
  db.prepare("ALTER TABLE blocks ADD COLUMN block_order INTEGER").run();
  console.log("Added block_order to blocks");
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}

// Add stamp_order to stamps
try {
  db.prepare("ALTER TABLE stamps ADD COLUMN stamp_order INTEGER").run();
  console.log("Added stamp_order to stamps");
} catch (e) {
  if (!/duplicate column/i.test(e.message)) throw e;
}

// Set block_order for all blocks (by block_id ascending)
const blocks = db
  .prepare("SELECT block_id FROM blocks ORDER BY block_id ASC")
  .all();
blocks.forEach((b, i) => {
  db.prepare("UPDATE blocks SET block_order = ? WHERE block_id = ?").run(
    i,
    b.block_id,
  );
});

// Set stamp_order for all stamps within each block (by stamp_id ascending)
const blockIds = blocks.map((b) => b.block_id);
blockIds.forEach((blockId) => {
  const stamps = db
    .prepare(
      "SELECT stamp_id FROM stamps WHERE block_id = ? ORDER BY stamp_id ASC",
    )
    .all(blockId);
  stamps.forEach((s, i) => {
    db.prepare("UPDATE stamps SET stamp_order = ? WHERE stamp_id = ?").run(
      i,
      s.stamp_id,
    );
  });
});

console.log("Order columns initialized.");
