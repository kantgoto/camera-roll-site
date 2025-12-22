"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  name: string;
  imageUrl: string;
  dateText: string;

  photoRect: Rect;
  dateRect: Rect;

  buttonSvg: string;
  buttonRect: Rect;

  downloaded: boolean;        // ← page から渡される
  onDownloaded: () => void;   // ← page に通知

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

  /**
   * PC向け：Supabase download → a.click()
   * （モバイルは別方式で既に解決済み想定）
   */
  const downloadViaSupabase = async () => {
    const path = `${FOLDER}/${name}`;
    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .download(path);

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
    // ✅ すでにDL済み or 処理中なら何もしない
    if (downloading || downloaded) return;

    setDownloading(true);
    try {
      await downloadViaSupabase();
      onDownloaded(); // ← page側で状態＆保存
    } catch (e) {
      console.error("[DL] failed:", name, e);
      alert("ダウンロードに失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* 写真エリア */}
      <div
        style={{
          position: "absolute",
          left: photoRect.left,
          top: photoRect.top,
          width: photoRect.width,
          height: photoRect.height,
        }}
      >
        {/* 枠（常に表示） */}
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

        {/* 写真（未DL時のみ表示） */}
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
            />
          </div>
        )}
      </div>

      {/* 日付 */}
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
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {dateText}
        </div>
      </div>

      {/* ダウンロードボタン */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloaded || downloading}
        aria-label="download"
        style={{
          position: "absolute",
          left: buttonRect.left,
          top: buttonRect.top,
          width: buttonRect.width,
          height: buttonRect.height,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: downloaded ? "default" : "pointer",
          zIndex: 40,
          // ❗ 薄くしない（指定どおり）
          opacity: 1,
        }}
      >
        <img
          src={buttonSvg}
          alt="download"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
          }}
        />
      </button>
    </>
  );
}