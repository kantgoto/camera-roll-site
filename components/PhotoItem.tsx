// components/PhotoItem.tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  name: string;
  imageUrl: string;
  dateText: string;

  photoRect: Rect; // フレーム基準
  dateRect: Rect;  // フレーム基準

  buttonSvg: string;
  buttonRect: Rect; // フレーム基準

  downloaded: boolean;
  onDownloaded: () => void;

  green: string;
};

const BUCKET = "photos";
const FOLDER = "2025";

export default function PhotoItem({
  name,
  imageUrl,
  dateText,
  photoRect,
  dateRect,
  buttonSvg,
  buttonRect,
  downloaded,
  onDownloaded,
  green,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  const downloadViaSupabase = async () => {
    const path = `${FOLDER}/${name}`;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw error;
    if (!data) throw new Error("No blob returned");

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      await downloadViaSupabase();
      onDownloaded(); // ✅ 成功：写真を消す（保持もpage側で）
    } catch (e) {
      console.error("[DL] failed", name, e);
      alert("ダウンロード失敗（Supabase/ネットワーク/権限）");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* 写真枠：フレーム基準で固定 */}
      <div
        style={{
          position: "absolute",
          left: photoRect.left,
          top: photoRect.top,
          width: photoRect.width,
          height: photoRect.height,
        }}
      >
        {/* ✅ 写真の裏にある枠（常に表示） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "white",
            border: `1px solid ${green}`,
            boxSizing: "border-box",
            zIndex: 0,
          }}
        />

        {/* 写真（未ダウンロード時だけ表示） */}
        {!downloaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="330px"
              className="object-cover"
              loading="eager"
            />
          </div>
        )}
      </div>

      {/* 日付：フレーム基準で固定 */}
      <div
        style={{
          position: "absolute",
          left: dateRect.left,
          top: dateRect.top,
          width: dateRect.width,
          height: dateRect.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-cinzel-decorative)",
            fontSize: 32,
            lineHeight: 1,
            color: green,
            textShadow: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {dateText}
        </div>
      </div>

      {/* ✅ download：downloadedでも消さない */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          position: "absolute",
          left: buttonRect.left,
          top: buttonRect.top,
          width: buttonRect.width,
          height: buttonRect.height,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          opacity: downloading ? 0.6 : 1,
          zIndex: 40,
        }}
        aria-label="download"
      >
        <img
          src={buttonSvg}
          alt="download"
          style={{ width: "100%", height: "100%", display: "block" }}
          draggable={false}
        />
      </button>
    </>
  );
}
