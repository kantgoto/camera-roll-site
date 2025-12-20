import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toFigmaDateString(date) {
  // Figma見た感じ: "2025,12,19" 形式
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y},${m},${d}`;
}

function parseExifDate(s) {
  // exiftoolは "YYYY:MM:DD HH:MM:SS" が多い
  // 例: "2025:12:19 18:03:14"
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, Y, Mo, D, h, mi, se] = m;
  // ローカル時間として扱う
  return new Date(Number(Y), Number(Mo) - 1, Number(D), Number(h), Number(mi), Number(se));
}

function getExifDateFromJpg(jpgPath) {
  // DateTimeOriginal があればそれ優先、なければ CreateDate / MediaCreateDate を拾う
  // JSONで返させる
  const out = execFileSync("exiftool", [
    "-j",
    "-DateTimeOriginal",
    "-CreateDate",
    "-MediaCreateDate",
    jpgPath,
  ], { encoding: "utf8" });

  const arr = JSON.parse(out);
  const meta = arr?.[0] ?? {};
  const raw =
    meta.DateTimeOriginal ??
    meta.CreateDate ??
    meta.MediaCreateDate ??
    null;

  const dt = parseExifDate(raw);
  return dt;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node scripts/make-photos-json.mjs /path/to/camera-roll-jpg");
    process.exit(1);
  }

  const jpgDir = args[0];
  if (!fs.existsSync(jpgDir)) {
    console.error("Folder not found:", jpgDir);
    process.exit(1);
  }

  const files = fs.readdirSync(jpgDir)
    .filter((f) => f.toLowerCase().endsWith(".jpg"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const map = {};
  let ok = 0;
  let ng = 0;

  for (const file of files) {
    const full = path.join(jpgDir, file);
    let dt = null;

    try {
      dt = getExifDateFromJpg(full);
    } catch (e) {
      // exiftool失敗
      dt = null;
    }

    // Supabase上のパスに合わせる（あなたは photos/2025/001.jpg 形式）
    const key = `2025/${file}`;

    if (dt) {
      map[key] = {
        takenAt: dt.toISOString(),
        label: toFigmaDateString(dt),
      };
      ok++;
    } else {
      // どうしても無ければ null
      map[key] = {
        takenAt: null,
        label: null,
      };
      ng++;
    }
  }

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/photos.json", JSON.stringify(map, null, 2), "utf8");

  console.log("Wrote public/photos.json");
  console.log("files:", files.length, "ok:", ok, "missing:", ng);
}

main();
