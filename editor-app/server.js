const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, "..");
const dbPath = path.join(ROOT, "stamps.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

app.use(express.json());
app.use("/images", express.static(path.join(ROOT, "images")));
app.use(express.static(path.join(__dirname, "public")));

function ensureStampsForeignKeyTargetsBlocks() {
  const foreignKeys = db.prepare("PRAGMA foreign_key_list(stamps)").all();
  const hasBrokenBlocksReference = foreignKeys.some(
    (row) => row.table === "blocks_old",
  );

  if (!hasBrokenBlocksReference) {
    return;
  }

  const migrate = db.transaction(() => {
    db.prepare("ALTER TABLE stamps RENAME TO stamps_old").run();
    db.prepare(
      `CREATE TABLE stamps (
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
        stamp_order INTEGER,
        FOREIGN KEY (block_id) REFERENCES blocks(block_id)
      )`,
    ).run();
    db.prepare(
      `INSERT INTO stamps (
        stamp_id,
        block_id,
        catalog_number,
        nvph_number,
        denomination,
        color,
        height,
        width,
        image_path,
        stamp_type,
        stamp_order
      )
      SELECT
        stamp_id,
        block_id,
        catalog_number,
        nvph_number,
        denomination,
        color,
        height,
        width,
        image_path,
        stamp_type,
        stamp_order
      FROM stamps_old`,
    ).run();
    db.prepare("DROP TABLE stamps_old").run();
  });

  migrate();
}

function normalizeBlockOrders() {
  const rows = db
    .prepare(
      `SELECT block_id
       FROM blocks
       ORDER BY (block_order IS NULL) ASC, block_order ASC, block_id ASC`,
    )
    .all();

  const stmt = db.prepare(
    "UPDATE blocks SET block_order = ? WHERE block_id = ?",
  );
  rows.forEach((row, idx) => {
    stmt.run(idx, row.block_id);
  });
}

function normalizeStampOrdersForBlock(blockId) {
  const rows = db
    .prepare(
      `SELECT stamp_id
       FROM stamps
       WHERE block_id = ?
       ORDER BY (stamp_order IS NULL) ASC, stamp_order ASC, stamp_id ASC`,
    )
    .all(blockId);

  const stmt = db.prepare(
    "UPDATE stamps SET stamp_order = ? WHERE stamp_id = ? AND block_id = ?",
  );
  rows.forEach((row, idx) => {
    stmt.run(idx, row.stamp_id, blockId);
  });
}

function nextBlockOrder() {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(block_order), -1) + 1 AS next_order FROM blocks",
    )
    .get();
  return row.next_order;
}

function nextStampOrder(blockId) {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(stamp_order), -1) + 1 AS next_order FROM stamps WHERE block_id = ?",
    )
    .get(blockId);
  return row.next_order;
}

function normalizeImagePath(imagePath) {
  if (!imagePath) {
    return "";
  }

  let normalized = imagePath.replace(/\\/g, "/");
  if (normalized.startsWith("images/images/")) {
    normalized = normalized.slice("images".length);
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

function blockWithStamps(block) {
  const stamps = db
    .prepare(
      `SELECT
        stamp_id,
        block_id,
        catalog_number,
        nvph_number,
        denomination,
        color,
        height,
        width,
        image_path,
        stamp_type,
        stamp_order
      FROM stamps
      WHERE block_id = ?
      ORDER BY (stamp_order IS NULL) ASC, stamp_order ASC, stamp_id ASC`,
    )
    .all(block.block_id)
    .map((stamp) => ({
      ...stamp,
      image_url: normalizeImagePath(stamp.image_path),
    }));

  return {
    ...block,
    stamps,
  };
}

function getBlocks() {
  const blocks = db
    .prepare(
      `SELECT
        block_id,
        year,
        title,
        block_order
      FROM blocks
      ORDER BY (block_order IS NULL) ASC, block_order ASC, block_id ASC`,
    )
    .all();
  return blocks.map(blockWithStamps);
}

function toExportCollection(blocks) {
  return {
    country: "Netherlands",
    blocks: blocks.map((block) => ({
      metadata: {
        year: block.year || "",
        title: block.title || "",
        nrOfStamps: String(block.stamps?.length ?? 0),
      },
      stamps: (block.stamps || []).map((stamp) => {
        let image = (stamp.image_path || "").replace(/\\/g, "/");
        if (image.startsWith("/")) {
          image = image.slice(1);
        }
        if (image.startsWith("images/images/")) {
          image = image.slice("images/".length);
        }

        return {
          height: Number(stamp.height || 0),
          width: Number(stamp.width || 0),
          denomination: stamp.denomination || "",
          color: stamp.color || "",
          catalogNumber: stamp.catalog_number || "",
          nvphNumber: stamp.nvph_number || "",
          image,
          type: stamp.stamp_type || "",
        };
      }),
      startingStamp: block.stamps?.[0]?.catalog_number || "",
      nextBlockStartingStamp:
        block.stamps?.[block.stamps.length - 1]?.catalog_number || "",
    })),
  };
}
// Update block order
app.post("/api/blocks/reorder", (req, res) => {
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: "ordered_ids must be an array" });
  }
  const tx = db.transaction((ids) => {
    const stmt = db.prepare(
      "UPDATE blocks SET block_order = ? WHERE block_id = ?",
    );
    ids.forEach((id, idx) => {
      stmt.run(idx, id);
    });
    normalizeBlockOrders();
  });
  tx(ordered_ids);
  res.json({ ok: true });
});

// Update stamp order within a block
app.post("/api/blocks/:blockId/stamps/reorder", (req, res) => {
  const blockId = Number(req.params.blockId);
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: "ordered_ids must be an array" });
  }
  const tx = db.transaction((ids) => {
    const stmt = db.prepare(
      "UPDATE stamps SET stamp_order = ? WHERE stamp_id = ? AND block_id = ?",
    );
    ids.forEach((id, idx) => {
      stmt.run(idx, id, blockId);
    });
    normalizeStampOrdersForBlock(blockId);
  });
  tx(ordered_ids);
  res.json({ ok: true });
});

function updateBlockStampCounts(blockId) {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM stamps WHERE block_id = ?")
    .get(blockId);

  // removed: update nr_of_stamps
}

app.get("/api/blocks", (req, res) => {
  res.json({ blocks: getBlocks() });
});

app.get("/api/export/json", (req, res) => {
  const blocks = getBlocks();
  const collection = toExportCollection(blocks);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(collection);
});

app.post("/api/blocks", (req, res) => {
  const { year, title } = req.body;

  const result = db
    .prepare(
      `INSERT INTO blocks (year, title, block_order)
       VALUES (?, ?, ?)`,
    )
    .run(year || "", title || "", nextBlockOrder());

  const created = db
    .prepare(
      `SELECT
        block_id,
        year,
        title
       FROM blocks
       WHERE block_id = ?`,
    )
    .get(result.lastInsertRowid);

  res.status(201).json(blockWithStamps(created));
});

app.put("/api/blocks/:blockId", (req, res) => {
  const blockId = Number(req.params.blockId);
  const { year, title } = req.body;

  db.prepare(
    `UPDATE blocks
       SET year = ?,
           title = ?
     WHERE block_id = ?`,
  ).run(year || "", title || "", blockId);

  const updated = db
    .prepare(
      `SELECT
        block_id,
        year,
        title
       FROM blocks
       WHERE block_id = ?`,
    )
    .get(blockId);

  if (!updated) {
    return res.status(404).json({ error: "Block not found" });
  }

  return res.json(blockWithStamps(updated));
});

app.delete("/api/blocks/:blockId", (req, res) => {
  const blockId = Number(req.params.blockId);

  const deletedStamps = db
    .prepare("DELETE FROM stamps WHERE block_id = ?")
    .run(blockId).changes;
  const deletedBlocks = db
    .prepare("DELETE FROM blocks WHERE block_id = ?")
    .run(blockId).changes;

  if (!deletedBlocks) {
    return res.status(404).json({ error: "Block not found" });
  }

  return res.json({ deletedBlocks, deletedStamps });
});

app.post("/api/stamps", (req, res) => {
  const {
    block_id,
    catalog_number,
    nvph_number,
    denomination,
    color,
    height,
    width,
    image_path,
    stamp_type,
  } = req.body;

  const blockId = Number(block_id);
  const blockExists = db
    .prepare("SELECT block_id FROM blocks WHERE block_id = ?")
    .get(blockId);

  if (!blockExists) {
    return res.status(400).json({ error: "Invalid block_id" });
  }

  const result = db
    .prepare(
      `INSERT INTO stamps
      (block_id, catalog_number, nvph_number, denomination, color, height, width, image_path, stamp_type, stamp_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      blockId,
      catalog_number || "",
      nvph_number || "",
      denomination || "",
      color || "",
      Number(height || 0),
      Number(width || 0),
      image_path || "",
      stamp_type || "",
      nextStampOrder(blockId),
    );

  updateBlockStampCounts(blockId);

  const created = db
    .prepare(
      `SELECT
        stamp_id,
        block_id,
        catalog_number,
        nvph_number,
        denomination,
        color,
        height,
        width,
        image_path,
        stamp_type
       FROM stamps
       WHERE stamp_id = ?`,
    )
    .get(result.lastInsertRowid);

  return res.status(201).json({
    ...created,
    image_url: normalizeImagePath(created.image_path),
  });
});

app.put("/api/stamps/:stampId", (req, res) => {
  const stampId = Number(req.params.stampId);
  const {
    block_id,
    catalog_number,
    nvph_number,
    denomination,
    color,
    height,
    width,
    image_path,
    stamp_type,
  } = req.body;

  const existing = db
    .prepare("SELECT block_id FROM stamps WHERE stamp_id = ?")
    .get(stampId);

  if (!existing) {
    return res.status(404).json({ error: "Stamp not found" });
  }

  const targetBlockId = Number(block_id);
  const blockExists = db
    .prepare("SELECT block_id FROM blocks WHERE block_id = ?")
    .get(targetBlockId);

  if (!blockExists) {
    return res.status(400).json({ error: "Invalid block_id" });
  }

  const isMovingToAnotherBlock = existing.block_id !== targetBlockId;
  if (isMovingToAnotherBlock) {
    db.prepare(
      `UPDATE stamps
       SET block_id = ?,
           stamp_order = ?,
           catalog_number = ?,
           nvph_number = ?,
           denomination = ?,
           color = ?,
           height = ?,
           width = ?,
           image_path = ?,
           stamp_type = ?
       WHERE stamp_id = ?`,
    ).run(
      targetBlockId,
      nextStampOrder(targetBlockId),
      catalog_number || "",
      nvph_number || "",
      denomination || "",
      color || "",
      Number(height || 0),
      Number(width || 0),
      image_path || "",
      stamp_type || "",
      stampId,
    );
    normalizeStampOrdersForBlock(existing.block_id);
    normalizeStampOrdersForBlock(targetBlockId);
  } else {
    db.prepare(
      `UPDATE stamps
       SET block_id = ?,
           catalog_number = ?,
           nvph_number = ?,
           denomination = ?,
           color = ?,
           height = ?,
           width = ?,
           image_path = ?,
           stamp_type = ?
       WHERE stamp_id = ?`,
    ).run(
      targetBlockId,
      catalog_number || "",
      nvph_number || "",
      denomination || "",
      color || "",
      Number(height || 0),
      Number(width || 0),
      image_path || "",
      stamp_type || "",
      stampId,
    );
  }

  updateBlockStampCounts(existing.block_id);
  updateBlockStampCounts(targetBlockId);

  const updated = db
    .prepare(
      `SELECT
        stamp_id,
        block_id,
        catalog_number,
        nvph_number,
        denomination,
        color,
        height,
        width,
        image_path,
        stamp_type
       FROM stamps
       WHERE stamp_id = ?`,
    )
    .get(stampId);

  return res.json({
    ...updated,
    image_url: normalizeImagePath(updated.image_path),
  });
});

app.post("/api/stamps/:stampId/move", (req, res) => {
  const stampId = Number(req.params.stampId);
  const targetBlockId = Number(req.body.block_id);

  const stamp = db
    .prepare("SELECT stamp_id, block_id FROM stamps WHERE stamp_id = ?")
    .get(stampId);
  if (!stamp) {
    return res.status(404).json({ error: "Stamp not found" });
  }

  const targetBlock = db
    .prepare("SELECT block_id FROM blocks WHERE block_id = ?")
    .get(targetBlockId);
  if (!targetBlock) {
    return res.status(400).json({ error: "Invalid target block" });
  }

  db.prepare(
    "UPDATE stamps SET block_id = ?, stamp_order = ? WHERE stamp_id = ?",
  ).run(targetBlockId, nextStampOrder(targetBlockId), stampId);

  normalizeStampOrdersForBlock(stamp.block_id);
  normalizeStampOrdersForBlock(targetBlockId);

  updateBlockStampCounts(stamp.block_id);
  updateBlockStampCounts(targetBlockId);

  return res.json({ ok: true });
});

app.delete("/api/stamps/:stampId", (req, res) => {
  const stampId = Number(req.params.stampId);

  const stamp = db
    .prepare("SELECT block_id FROM stamps WHERE stamp_id = ?")
    .get(stampId);

  if (!stamp) {
    return res.status(404).json({ error: "Stamp not found" });
  }

  db.prepare("DELETE FROM stamps WHERE stamp_id = ?").run(stampId);
  normalizeStampOrdersForBlock(stamp.block_id);
  updateBlockStampCounts(stamp.block_id);

  return res.json({ ok: true });
});

ensureStampsForeignKeyTargetsBlocks();

const server = app.listen(PORT, () => {
  normalizeBlockOrders();
  const blockIds = db
    .prepare("SELECT block_id FROM blocks ORDER BY block_id ASC")
    .all();
  blockIds.forEach((row) => normalizeStampOrdersForBlock(row.block_id));
  console.log(`Stamp editor running at http://localhost:${PORT}`);
});

server.ref();
