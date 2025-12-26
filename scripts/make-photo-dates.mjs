// scripts/make-photo-dates.mjs
import fs from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";

const FOLDER = "2025";
const PHOTOS_DIR = path.join(process.cwd(), "public", "photos", FOLDER);
const OUT_PATH = path.join(process.cwd(), "public", "photo-dates.json");

// JSTで日付文字列にする（YYYY,MM,DD）
function toLabelJST(date) {
  if (!date) return "";
  const d = new Date(date);
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const yyyy = parts.find((p) => p.type === "year")?.value ?? "";
  const mm = parts.find((p) => p.type === "month")?.value ?? "";
  const dd = parts.find((p) => p.type === "day")?.value ?? "";
  return `${yyyy},${mm},${dd}`;
}

async function main() {
  const files = (await fs.readdir(PHOTOS_DIR))
    .filter((f) => f.toLowerCase().endsWith(".jpg"))
    .sort((a, b) => a.localeCompare(b, "en"));

  const out = {}; // {"001.jpg": {takenAt, label}} 形式で出す（Page側がこの形式OK）

  for (const name of files) {
    const fp = path.join(PHOTOS_DIR, name);

    // EXIFから撮影日時を取る（DateTimeOriginal / CreateDate など）
    let takenAt = null;
    try {
      const exif = await exifr.parse(fp, {
        tiff: true,
        exif: true,
        xmp: true,
        icc: false,
        gps: false,
      });

      takenAt =
        exif?.DateTimeOriginal ??
        exif?.CreateDate ??
        exif?.ModifyDate ??
        exif?.DateCreated ??
        null;
    } catch {
      takenAt = null;
    }

    const label = toLabelJST(takenAt);

    // ✅ キーは「001.jpg」形式（あなたのconsoleで keys[0] が 001.jpg だったのでこれに合わせる）
    out[name] = {
      takenAt: takenAt ? new Date(takenAt).toISOString() : undefined,
      label: label || undefined,
    };
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log(`✅ wrote ${OUT_PATH} (${files.length} files)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});