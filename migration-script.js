const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// 1. Initialize database
const db = new Database("stamps.db");

// 2. Create tables (if they don't exist)
db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    block_id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT,
    year TEXT,
    title TEXT,
    nr_of_stamps INTEGER,
    starting_stamp TEXT,
    next_block_starting_stamp TEXT
  );

  CREATE TABLE IF NOT EXISTS stamps (
    stamp_id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER,
    catalog_number TEXT,
    nvph_number TEXT,
    denomination TEXT,
    color TEXT,
    height REAL,
    width REAL,
    image_path TEXT,
    stamp_type TEXT,
    FOREIGN KEY (block_id) REFERENCES blocks(block_id)
  );
`);

// 3. Load JSON data
const rawData = fs.readFileSync("testdata.json", "utf8");
const collections = JSON.parse(rawData);

// 4. Prepare Statements (Better for performance and security)
const insertBlock = db.prepare(`
  INSERT INTO blocks (country, year, title, nr_of_stamps, starting_stamp, next_block_starting_stamp)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertStamp = db.prepare(`
  INSERT INTO stamps (block_id, catalog_number, nvph_number, denomination, color, height, width, image_path, stamp_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// 5. Run as a Transaction (Much faster and ensures data integrity)
const migrate = db.transaction((data) => {
  for (const collection of data) {
    for (const block of collection.blocks) {
      // Insert Block metadata
      const blockResult = insertBlock.run(
        collection.country,
        block.metadata.year,
        block.metadata.title,
        block.metadata.nrOfStamps,
        block.startingStamp,
        block.nextBlockStartingStamp,
      );

      const blockId = blockResult.lastInsertRowid;

      // Insert each stamp in the block
      for (const stamp of block.stamps) {
        // We prepend 'images/' to the filename to keep paths relative
        const relativeImagePath = path.join("images", stamp.image);

        insertStamp.run(
          blockId,
          stamp.catalogNumber,
          stamp.nvphNumber,
          stamp.denomination,
          stamp.color,
          stamp.height,
          stamp.width,
          relativeImagePath,
          stamp.type,
        );
      }
    }
  }
});

migrate(Array.isArray(collections) ? collections : [collections]);
console.log("Migration complete! Database populated.");
