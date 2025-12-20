// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PhotoItem from "@/components/PhotoItem";
import StickyBottomSvg from "@/components/StickyBottomSvg";
import { supabase } from "@/lib/supabaseClient";

type DateMap = Record<string, string>;
type UrlMap = Record<string, string>;
type DlMap = Record<string, boolean>;

const BUCKET = "photos";
const FOLDER = "2025";
const GREEN = "#78FF6E";

// 001 の figma 基準
const BASE = {
  frameW: 390,

  title: { left: 30, top: 66, width: 330, height: 120 },
  body: { left: 30, top: 211, width: 330, height: 138 },

  photo: { left: 30, top: 424, width: 330, height: 440 },
  date: { left: 123, top: 629, width: 145, height: 31 },
  btn: { left: 260, top: 869, width: 100, height: 20 },
};

// 写真と写真の間隔 60px → 440 + 60 = 500
const GAP_Y = 440 + 60;

const pad3 = (n: number) => String(n).padStart(3, "0");
const getName = (i: number) => `${pad3(i)}.jpg`;
const dlKey = (name: string) => `camera-roll-downloaded-${FOLDER}-${name}`;

export default function Page() {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [dateMap, setDateMap] = useState<DateMap>({});
  const [urlMap, setUrlMap] = useState<UrlMap>({});
  const [downloadedMap, setDownloadedMap] = useState<DlMap>({});

  // 表示する枚数（とりあえず 001〜095）
  const N = 95;

  const names = useMemo(() => {
    return Array.from({ length: N }, (_, idx) => getName(idx + 1));
  }, []);

  useEffect(() => {
    // localStorage から復元（全枚数）
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

  useEffect(() => {
    const run = async () => {
      // 日付マップ
      try {
        const res = await fetch("/photo-dates.json", { cache: "no-store" });
        if (res.ok) setDateMap((await res.json()) ?? {});
      } catch {}

      // public url をまとめて作る
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

  const handleDownloaded = (name: string) => {
    setDownloadedMap((prev) => ({ ...prev, [name]: true }));
    try {
      localStorage.setItem(dlKey(name), "1");
    } catch {}
  };

  // フレーム高さ（最後のブロックが全部入るぶん）
  const frameH = BASE.btn.top + BASE.btn.height + (N - 1) * GAP_Y + 40;

  return (
    <main className="min-h-screen bg-white py-10">
      {/* フレーム：390px */}
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
          }}
          draggable={false}
        />

        {/* body-primary svg */}
        <img
          src="/SVG/body-primary.svg"
          alt="body"
          style={{
            position: "absolute",
            left: BASE.body.left,
            top: BASE.body.top,
            width: BASE.body.width,
            height: BASE.body.height,
            display: "block",
          }}
          draggable={false}
        />

        {/* ✅ body-secondary2（指定：W330 H180 X30 Y1505）
            スクロールして「底辺が画面下に来たら」その位置で固定 */}
        <StickyBottomSvg
          frameRef={frameRef}
          src="/SVG/body-secondary2.svg"
          rect={{ left: 30, top: 8869, width: 330, height: 180 }}
          zIndex={99999} // いちばん上に乗せる
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
