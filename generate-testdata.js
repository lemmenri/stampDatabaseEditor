const fs = require("fs");
const path = require("path");
const jpeg = require("jpeg-js");

const ROOT = __dirname;
const TYPES_FILE = path.join(ROOT, "types.ts");
const OUTPUT_FILE = path.join(ROOT, "testdata.json");
const IMAGE_DIR = path.join(ROOT, "images", "stamps");
const BLOCK_COUNT = 10;
const STAMPS_PER_BLOCK = 10;

function parseTypes(fileContent) {
  const types = {};
  const typeBlockRegex = /export\s+type\s+(\w+)\s*=\s*\{([\s\S]*?)\};/g;

  let match;
  while ((match = typeBlockRegex.exec(fileContent)) !== null) {
    const typeName = match[1];
    const body = match[2];
    const fields = {};

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }

      const fieldMatch = trimmed.match(/^(\w+)\??:\s*([^;]+);$/);
      if (!fieldMatch) {
        continue;
      }

      fields[fieldMatch[1]] = fieldMatch[2].trim();
    }

    types[typeName] = fields;
  }

  return types;
}

function makeStamp(index, blockIndex) {
  const stampId = index + 1;
  return {
    height: 30 + (index % 20),
    width: 24 + (index % 4),
    denomination: `${stampId} cent`,
    color: ["red", "blue", "green", "orange", "brown"][index % 5],
    catalogNumber: `CAT-${String(stampId).padStart(4, "0")}`,
    nvphNumber: `NVPH-${String(1000 + index)}`,
    image: `images/stamps/block-${String(blockIndex + 1).padStart(2, "0")}-stamp-${String(stampId).padStart(4, "0")}.jpg`,
    type: index % 2 === 0 ? "definitive" : "commemorative",
  };
}

function makeBlockMetadata(stampCount, blockIndex) {
  return {
    year: String(2024 + blockIndex),
    title: `Generated Block ${blockIndex + 1}`,
    nrOfStamps: String(stampCount),
  };
}

function makeBlock(blockIndex, startStampIndex) {
  const stamps = Array.from({ length: STAMPS_PER_BLOCK }, (_, i) =>
    makeStamp(startStampIndex + i, blockIndex),
  );

  const startingStamp = stamps[0].catalogNumber;
  const nextBlockStartId = startStampIndex + STAMPS_PER_BLOCK + 1;
  const nextBlockStartingStamp =
    blockIndex < BLOCK_COUNT - 1
      ? `CAT-${String(nextBlockStartId).padStart(4, "0")}`
      : "";

  return {
    metadata: makeBlockMetadata(stamps.length, blockIndex),
    stamps,
    startingStamp,
    nextBlockStartingStamp,
  };
}

function colorForIndex(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  const saturation = 75;
  const lightness = 50;
  return hslToRgb(hue, saturation, lightness);
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h >= 0 && h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h >= 60 && h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h >= 120 && h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h >= 180 && h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h >= 240 && h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

function writeSolidColorJpeg(filePath, width, height, rgb) {
  const data = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = rgb.r;
    data[offset + 1] = rgb.g;
    data[offset + 2] = rgb.b;
    data[offset + 3] = 255;
  }

  const rawImageData = { data, width, height };
  const jpegData = jpeg.encode(rawImageData, 90);
  fs.writeFileSync(filePath, jpegData.data);
}

function ensureImagesForCollection(collection) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  for (const entry of fs.readdirSync(IMAGE_DIR)) {
    if (entry.toLowerCase().endsWith(".jpg")) {
      fs.unlinkSync(path.join(IMAGE_DIR, entry));
    }
  }

  const allStamps = (collection.blocks || []).flatMap(
    (block) => block.stamps || [],
  );

  allStamps.forEach((stamp, index) => {
    const relativeImagePath = stamp.image;
    const imageFilePath = path.join(ROOT, relativeImagePath);
    const rgb = colorForIndex(index, allStamps.length);
    writeSolidColorJpeg(imageFilePath, 100, 100, rgb);
  });
}

function buildCollection(typeMap) {
  if (
    !typeMap.Collection ||
    !typeMap.Block ||
    !typeMap.Stamp ||
    !typeMap.BlockMetadata
  ) {
    throw new Error(
      "Expected Collection, Block, Stamp, and BlockMetadata types in types.ts",
    );
  }

  const blocks = Array.from({ length: BLOCK_COUNT }, (_, blockIndex) =>
    makeBlock(blockIndex, blockIndex * STAMPS_PER_BLOCK),
  );

  return {
    country: "Netherlands",
    blocks,
  };
}

function main() {
  const fileContent = fs.readFileSync(TYPES_FILE, "utf8");
  const typeMap = parseTypes(fileContent);

  if (!typeMap.Collection) {
    throw new Error("Collection type was not found in types.ts");
  }

  const testData = buildCollection(typeMap);
  ensureImagesForCollection(testData);
  fs.writeFileSync(
    OUTPUT_FILE,
    `${JSON.stringify(testData, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated test data at ${OUTPUT_FILE}`);
  console.log(`Generated images in ${IMAGE_DIR}`);
}

main();
