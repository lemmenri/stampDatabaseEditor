#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Edit this value when you want to process a different export file.
const INPUT_FILE = "exports/collection-export-2026-05-20.json";

// Set this to a specific path if you want a fixed output file.
// Leave as null to auto-generate: <input-name>-sizes.txt
const OUTPUT_FILE = null;

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function main() {
  const inputPath = path.resolve(process.cwd(), INPUT_FILE);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(`Failed to read input file: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse JSON: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const counts = new Map();
  let invalidStampCount = 0;

  for (const block of blocks) {
    const stamps = Array.isArray(block?.stamps) ? block.stamps : [];

    for (const stamp of stamps) {
      const width = toNumber(stamp?.width);
      const height = toNumber(stamp?.height);

      if (width === null || height === null) {
        invalidStampCount += 1;
        continue;
      }

      const key = `${width} x ${height}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const outputPath = OUTPUT_FILE
    ? path.resolve(process.cwd(), OUTPUT_FILE)
    : path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}-sizes.txt`,
      );

  const sortedEntries = [...counts.entries()].sort((a, b) => {
    const [aW, aH] = a[0].split(" x ").map(Number);
    const [bW, bH] = b[0].split(" x ").map(Number);

    if (aW !== bW) return aW - bW;
    return aH - bH;
  });

  const lines = [
    `Input: ${path.basename(inputPath)}`,
    `Total valid stamps: ${[...counts.values()].reduce((sum, n) => sum + n, 0)}`,
    `Invalid/missing size entries skipped: ${invalidStampCount}`,
    "",
    "Size (width x height) | Count",
    "------------------------|------",
    ...sortedEntries.map(
      ([size, count]) => `${size.padEnd(23, " ")} | ${count}`,
    ),
  ];

  try {
    fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  } catch (err) {
    console.error(`Failed to write output file: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Wrote size counts to: ${outputPath}`);
}

main();
