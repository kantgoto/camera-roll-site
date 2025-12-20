// app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import PhotoItem from "@/components/PhotoItem";
import StickyBottomSvg from "@/components/StickyBottomSvg"; // もし使ってるなら
import { supabase } from "@/lib/supabaseClient";

type DateMap = Record<string, string>;
type UrlMap = Record<string, string>;
type DlMap = Record<string, boolean>;

const BUCKET = "photos";
const FOLDER = "2025";
const GREEN = "#78FF6E";

// 001 の figma 基準（あなたがくれた値）
const BASE = {
  frameW: 390,

  title: { left: 30, top: 66, width: 330, height: 120 },
  body: { left: 30, top: 211, width: 330, height: 138 },

  photo: { left: 30, top: 424, width: 330, height: 440 },
  date: { left: 123, top: 629, width: 145, height: 31 },
  btn: { left: 260, top: 869, width: 100, height: 20 },
};

const GAP_Y = 440 + 60; // 写真と写真の間隔 60px

const pad3 = (n: number) => String(n).padStart(3, "0");
const getName = (i: number) => `${pad3(i)}.jpg`;
const dlKey = (name: string) => `camera-roll-downloaded-${FOLDER}-${name}`;

export default function Page() {
  const [dateMap, setDateMap] = useState<DateMap>({});
  const [urlMap, setUrlMap] = useState<UrlMap>({});
  const [downloadedMap, setDownloadedMap] = useState<DlMap>({});

  // ✅ 追加：body-secondary3 の表示トグル
  const [showBodySecondary3, setShowBodySecondary3] = useState(false);

  // ✅ 表示する枚数（必要なら増やしてOK）
  const N = 95;

  const names = useMemo(() => {
    return Array.from({ length: N }, (_, idx) => getName(idx + 1));
  }, [N]);

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

      // public url をまとめて作る（getPublicUrlはローカル計算なので速い）
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

        {/* --- ここからが「スクロールしても固定」レイヤー --- */}
        {/* ✅ fixed専用レイヤー（幅390で中央寄せ。ここ基準でX/Yが効く） */}
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            width: BASE.frameW,
            height: "100vh",
            zIndex: 9999,
            pointerEvents: "none", // ここは基本クリック無効（ボタンだけ有効化する）
          }}
        >
          {/* ✅ body-secondary3（最初は非表示、ボタンで表示） */}
          {showBodySecondary3 && (
            <img
              src="/SVG/body-secondary3.svg"
              alt="body-secondary3"
              draggable={false}
              style={{
                position: "absolute",
                left: 30,
                top: 364,
                width: 207,
                height: 153,
                display: "block",
                pointerEvents: "none",
              }}
            />
          )}

          {/* ✅ button.svg：押せるようにここだけ pointerEvents を戻す */}
          <button
            type="button"
            onClick={() => setShowBodySecondary3((v) => !v)}
            style={{
              position: "absolute",
              left: 11,
              top: 365,
              width: 9,
              height: 10,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
            aria-label="toggle body-secondary3"
          >
            <img
              src="/SVG/button.svg"
              alt="button"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
              }}
            />
          </button>
        </div>
        {/* --- fixedレイヤーここまで --- */}
      </div>
    </main>
  );
}
