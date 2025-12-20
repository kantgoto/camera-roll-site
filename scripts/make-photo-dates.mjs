import fs from "node:fs";
import path from "node:path";
import exifr from "exifr";

// ====== 設定ここだけ ======
// HEICが入ってるフォルダ（元データ）
const HEIC_DIR = "/Users/kantgoto/Desktop/カメラロール";
// 001.jpg, 002.jpg ... が入ってるフォルダ（変換後）
const JPG_DIR = "/Users/kantgoto/Desktop/camera-roll-jpg";

// 出力先（Nextのpublic配下に置く）
const OUT_PATH = path.resolve("public/photo-dates.json");
// =========================

function listFiles(dir, exts) {
  return fs
    .readdirSync(dir)
    .filter((f) => exts.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y},${m},${day}`; // Figmaと同じ表記
}

async function main() {
  const heics = listFiles(HEIC_DIR, [".heic", ".heif"]);
  const jpgs = listFiles(JPG_DIR, [".jpg", ".jpeg"]);

  if (heics.length === 0) {
    console.error("HEICが見つからない:", HEIC_DIR);
    process.exit(1);
  }
  if (jpgs.length === 0) {
    console.error("JPGが見つからない:", JPG_DIR);
    process.exit(1);
  }

  // 重要：並び順で対応づける（001.jpgが1番目のHEIC、という前提）
  const n = Math.min(heics.length, jpgs.length);

  const map = {};
  for (let i = 0; i < n; i++) {
    const heicPath = path.join(HEIC_DIR, heics[i]);
    const jpgName = jpgs[i]; // 001.jpg みたいなやつ

    let d =
      (await exifr.parse(heicPath, ["DateTimeOriginal", "CreateDate"]))?.DateTimeOriginal ||
      (await exifr.parse(heicPath, ["DateTimeOriginal", "CreateDate"]))?.CreateDate ||
      null;

    // exifrがDateを返すことが多いけど、念のため
    if (d && !(d instanceof Date)) d = new Date(d);

    map[jpgName] = d ? fmt(d) : null;
    process.stdout.write(`mapped: ${heics[i]} -> ${jpgName} -> ${map[jpgName]}\n`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2), "utf-8");
  console.log("\n✅ wrote:", OUT_PATH);
  console.log("例:", Object.entries(map).slice(0, 5));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

