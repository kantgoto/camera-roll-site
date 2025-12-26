// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PhotoItem from "@/components/PhotoItem";
import { supabase } from "@/lib/supabaseClient";

type DateJson =
  | Record<string, string>
  | Record<string, { takenAt?: string; label?: string }>;

type UrlMap = Record<string, string>; // key = photo_id ("2025/001.jpg")
type DlMap = Record<string, boolean>; // key = photo_id

const BUCKET = "photos";
const FOLDER = "2025";
const GREEN = "#78FF6E";

// figma 基準
const BASE = {
  frameW: 390,

  title: { left: 30, top: 66, width: 330, height: 120 },
  bodyPrimary2: { left: 30, top: 211, width: 330, height: 156 },

  toggleBtn: { left: 30, top: 398, width: 15, height: 17 },
  bodySecondary4: { left: 30, top: 423, width: 195, height: 230 },

  photo: { left: 30, top: 424, width: 330, height: 440 },
  date: { left: 123, top: 629, width: 145, height: 31 },
  btn: { left: 260, top: 869, width: 100, height: 20 },
};

const GAP_Y = 440 + 60; // 500

const pad3 = (n: number) => String(n).padStart(3, "0");
const getName = (i: number) => `${pad3(i)}.jpg`;

export default function Page() {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [dateJson, setDateJson] = useState<DateJson>({});
  const [urlMap, setUrlMap] = useState<UrlMap>({});
  const [downloadedMap, setDownloadedMap] = useState<DlMap>({});

  const [showSecondary4, setShowSecondary4] = useState(false);
  const [fixedBaseLeft, setFixedBaseLeft] = useState(0);

  const N = 95;

  const names = useMemo(
    () => Array.from({ length: N }, (_, i) => getName(i + 1)),
    []
  );

  const photoIds = useMemo(
    () => names.map((name) => `${FOLDER}/${name}`),
    [names]
  );

  /* -----------------------------
   * 日付JSON + 画像URL
   * ----------------------------- */
  useEffect(() => {
    const run = async () => {
      // dates
      try {
        const res = await fetch("/photo-dates.json", { cache: "no-store" });
        if (res.ok) setDateJson(await res.json());
      } catch {}

      // public urls (key = photo_id)
      const next: UrlMap = {};
      for (const photo_id of photoIds) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(photo_id);
        next[photo_id] = data.publicUrl;
      }
      setUrlMap(next);
    };
    run();
  }, [photoIds]);

  /* -----------------------------
   * ✅ downloads を読む
   * ----------------------------- */
  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("downloads")
        .select("photo_id, downloaded");

      if (error) {
        console.error("[downloads select error]", error);
        return;
      }

      const next: DlMap = {};
      for (const row of data ?? []) {
        if (row.downloaded) next[row.photo_id] = true;
      }
      setDownloadedMap(next);
    };
    run();
  }, []);

  /* -----------------------------
   * 日付取得（旧/新対応）
   * ----------------------------- */
  const getDateLabelFor = (name: string) => {
    const keyNew = `${FOLDER}/${name}`; // "2025/001.jpg"
    const keyOld = name; // "001.jpg"

    const anyJson = dateJson as any;
    const raw = anyJson[keyNew] ?? anyJson[keyOld];
    if (!raw) return "";

    const label = typeof raw === "string" ? raw : raw?.label;
    if (!label) return "";

    if (/^\d{4},\d{2},\d{2}$/.test(label)) return label;

    const m = String(label).match(/^(\d{4})[-:\/,](\d{1,2})[-:\/,](\d{1,2})/);
    if (!m) return String(label);

    return `${m[1]},${String(m[2]).padStart(2, "0")},${String(m[3]).padStart(
      2,
      "0"
    )}`;
  };

  /* -----------------------------
   * ✅ ダウンロード完了 → downloads に upsert
   * ----------------------------- */
  const handleDownloaded = async (name: string) => {
    const photo_id = `${FOLDER}/${name}`;

    // UI 即反映
    setDownloadedMap((prev) => ({ ...prev, [photo_id]: true }));

    // デバッグ：クリックが発火してるか確認
    console.log("[DL] onDownloaded fired:", photo_id);

    const { error } = await supabase
      .from("downloads")
      .upsert(
        {
          photo_id,
          downloaded: true,
          downloaded_at: new Date().toISOString(),
        },
        { onConflict: "photo_id" }
      );

    if (error) {
      console.error("[downloads upsert error]", error);

      // 失敗したら戻す
      setDownloadedMap((prev) => {
        const copy = { ...prev };
        delete copy[photo_id];
        return copy;
      });
    }
  };

  /* -----------------------------
   * fixed UI の left 補正
   * ----------------------------- */
  const frameH = BASE.btn.top + BASE.btn.height + (N - 1) * GAP_Y + 60;

  useEffect(() => {
    const measure = () => {
      const r = frameRef.current?.getBoundingClientRect();
      if (r) setFixedBaseLeft(r.left);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white py-10">
      {/* ===== 固定UI（★クリック吸わないようにする） ===== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          pointerEvents: "none", // ★これが超重要：下のクリックを通す
        }}
      >
        <button
          onClick={() => setShowSecondary4((v) => !v)}
          style={{
            position: "fixed",
            left: fixedBaseLeft + BASE.toggleBtn.left,
            top: BASE.toggleBtn.top,
            width: BASE.toggleBtn.width,
            height: BASE.toggleBtn.height,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            pointerEvents: "auto", // ★このボタンだけ押せるようにする
          }}
        >
          <img
            src="/SVG/button.svg"
            style={{ width: "100%", transform: "rotate(90deg)" }}
            alt=""
            draggable={false}
          />
        </button>

        {showSecondary4 && (
          <img
            src="/SVG/body-secondary4.svg"
            style={{
              position: "fixed",
              left: fixedBaseLeft + BASE.bodySecondary4.left,
              top: BASE.bodySecondary4.top,
              width: BASE.bodySecondary4.width,
              height: BASE.bodySecondary4.height,
              pointerEvents: "none", // 表示だけなので none のままでOK
            }}
            alt=""
            draggable={false}
          />
        )}
      </div>

      {/* ===== フレーム ===== */}
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: BASE.frameW,
          height: frameH,
          margin: "0 auto",
        }}
      >
        <img
          src="/SVG/title.svg"
          style={{ position: "absolute", ...BASE.title }}
          alt=""
          draggable={false}
        />
        <img
          src="/SVG/body-primary2.svg"
          style={{ position: "absolute", ...BASE.bodyPrimary2 }}
          alt=""
          draggable={false}
        />

        {names.map((name, idx) => {
          const y = idx * GAP_Y;
          const photo_id = `${FOLDER}/${name}`;

          return (
            <PhotoItem
              key={name}
              name={name}
              imageUrl={urlMap[photo_id] ?? ""}
              dateText={getDateLabelFor(name)}
              photoRect={{ ...BASE.photo, top: BASE.photo.top + y }}
              dateRect={{ ...BASE.date, top: BASE.date.top + y }}
              buttonSvg="/SVG/button-download.svg"
              buttonRect={{ ...BASE.btn, top: BASE.btn.top + y }}
              downloaded={!!downloadedMap[photo_id]}
              onDownloaded={() => handleDownloaded(name)}
              green={GREEN}
            />
          );
        })}
      </div>
    </main>
  );
}