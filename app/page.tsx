// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PhotoItem from "@/components/PhotoItem";
import { supabase } from "@/lib/supabaseClient";

type DateMap = Record<string, string>;
type UrlMap = Record<string, string>;
type DlMap = Record<string, boolean>;

const BUCKET = "photos";
const FOLDER = "2025";
const GREEN = "#78FF6E";

// figma 基準
const BASE = {
  frameW: 390,

  title: { left: 30, top: 66, width: 330, height: 120 },

  // スクロールで動く
  bodyPrimary2: { left: 30, top: 211, width: 330, height: 156 },

  // 固定UI（button / body-secondary4）
  toggleBtn: { left: 30, top: 398, width: 15, height: 17 },
  bodySecondary4: { left: 30, top: 423, width: 195, height: 230 },

  photo: { left: 30, top: 424, width: 330, height: 440 },
  date: { left: 123, top: 629, width: 145, height: 31 },
  btn: { left: 260, top: 869, width: 100, height: 20 },
};

// 写真と写真の間隔 60px
const GAP_Y = 440 + 60; // 500

const pad3 = (n: number) => String(n).padStart(3, "0");
const getName = (i: number) => `${pad3(i)}.jpg`;
const dlKey = (name: string) => `camera-roll-downloaded-${FOLDER}-${name}`;

export default function Page() {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [dateMap, setDateMap] = useState<DateMap>({});
  const [urlMap, setUrlMap] = useState<UrlMap>({});
  const [downloadedMap, setDownloadedMap] = useState<DlMap>({});

  // body-secondary4 の表示/非表示
  const [showSecondary4, setShowSecondary4] = useState(false);

  // ✅ 固定UIを「フレーム左基準」で置くための left オフセット
  const [fixedBaseLeft, setFixedBaseLeft] = useState(0);

  // 表示する枚数（001〜095）
  const N = 95;

  const names = useMemo(() => {
    return Array.from({ length: N }, (_, idx) => getName(idx + 1));
  }, []);

  // localStorage 復元
  useEffect(() => {
    const next: DlMap = {};
    for (const name of names) {
      try {
        next[name] = localStorage.getItem(dlKey(name)) === "1";
      } catch {
        next[name] = false;
      }
    }
    setDownloadedMap(next);
  }, [names]);

  // date + url
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/photo-dates.json", { cache: "no-store" });
        if (res.ok) setDateMap((await res.json()) ?? {});
      } catch {}

      const nextUrls: UrlMap = {};
      for (const name of names) {
        const path = `${FOLDER}/${name}`;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        nextUrls[name] = data.publicUrl;
      }
      setUrlMap(nextUrls);
    };

    run();
  }, [names]);

  const normalizeDateText = (s?: string) => {
    if (!s) return "";
    if (/^\d{4},\d{2},\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{4})[-:\/,](\d{1,2})[-:\/,](\d{1,2})/);
    if (!m) return s;
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${yyyy},${mm},${dd}`;
  };

  // download完了 → 保存 + 状態更新
  const handleDownloaded = (name: string) => {
    setDownloadedMap((prev) => ({ ...prev, [name]: true }));
    try {
      localStorage.setItem(dlKey(name), "1");
    } catch {}
  };

  // フレーム高さ
  const frameH = BASE.btn.top + BASE.btn.height + (N - 1) * GAP_Y + 60;

  // ✅ フレーム位置を測って「fixed の left 基準」を作る（resize時だけでOK）
  useEffect(() => {
    const measure = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const r = frame.getBoundingClientRect();
      setFixedBaseLeft(r.left);
    };

    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <main className="min-h-screen bg-white py-10">
      {/* ===== 固定UI（スクロールしない・フレームのleftにだけ追従） ===== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {/* toggle button (button.svg) - 固定 */}
        <button
          type="button"
          onClick={() => setShowSecondary4((v) => !v)}
          aria-label="toggle secondary"
          style={{
            position: "fixed",
            left: fixedBaseLeft + BASE.toggleBtn.left,
            top: BASE.toggleBtn.top,
            width: BASE.toggleBtn.width,
            height: BASE.toggleBtn.height,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            zIndex: 1100,
            pointerEvents: "auto", // ✅ これが無いと押せない
          }}
        >
          <img
            src="/SVG/button.svg"
            alt="toggle"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              transform: "rotate(90deg)",
              transformOrigin: "center",
            }}
          />
        </button>

        {/* body-secondary4 - 固定（buttonで表示/非表示） */}
        {showSecondary4 && (
          <img
            src="/SVG/body-secondary4.svg"
            alt="body-secondary4"
            draggable={false}
            style={{
              position: "fixed",
              left: fixedBaseLeft + BASE.bodySecondary4.left,
              top: BASE.bodySecondary4.top,
              width: BASE.bodySecondary4.width,
              height: BASE.bodySecondary4.height,
              display: "block",
              zIndex: 1050,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* ===== フレーム（スクロールする本体） ===== */}
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: BASE.frameW,
          height: frameH,
          margin: "0 auto",
          background: "white",
        }}
      >
        {/* title svg */}
        <img
          src="/SVG/title.svg"
          alt="title"
          style={{
            position: "absolute",
            left: BASE.title.left,
            top: BASE.title.top,
            width: BASE.title.width,
            height: BASE.title.height,
            display: "block",
            zIndex: 50,
            pointerEvents: "none",
          }}
          draggable={false}
        />

        {/* body-primary2（スクロールで流れる） */}
        <img
          src="/SVG/body-primary2.svg"
          alt="body-primary2"
          style={{
            position: "absolute",
            left: BASE.bodyPrimary2.left,
            top: BASE.bodyPrimary2.top,
            width: BASE.bodyPrimary2.width,
            height: BASE.bodyPrimary2.height,
            display: "block",
            zIndex: 50,
            pointerEvents: "none",
          }}
          draggable={false}
        />

        {/* 001〜095 */}
        {names.map((name, idx) => {
          const y = idx * GAP_Y;

          const imageUrl = urlMap[name];
          if (!imageUrl) return null;

          const dateText = normalizeDateText(dateMap[name]);

          return (
            <PhotoItem
              key={name}
              name={name}
              imageUrl={imageUrl}
              dateText={dateText}
              photoRect={{
                left: BASE.photo.left,
                top: BASE.photo.top + y,
                width: BASE.photo.width,
                height: BASE.photo.height,
              }}
              dateRect={{
                left: BASE.date.left,
                top: BASE.date.top + y,
                width: BASE.date.width,
                height: BASE.date.height,
              }}
              buttonSvg="/SVG/button-download.svg"
              buttonRect={{
                left: BASE.btn.left,
                top: BASE.btn.top + y,
                width: BASE.btn.width,
                height: BASE.btn.height,
              }}
              downloaded={!!downloadedMap[name]}
              onDownloaded={() => handleDownloaded(name)}
              green={GREEN}
            />
          );
        })}
      </div>
    </main>
  );
}