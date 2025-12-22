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

  photoRect: Rect;
  dateRect: Rect;

  buttonSvg: string;
  buttonRect: Rect;

  downloaded: boolean;
  onDownloaded: () => void;

  green: string;

  // ✅ あなたの「写真のみページ」に飛ばす先（今の仕様に合わせて変更してOK）
  // 例: /p/001 みたいに作ってるならそれに合わせる
  singlePhotoPagePath?: (name: string) => string;
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
  singlePhotoPagePath = (n) => `/photo?name=${encodeURIComponent(n)}`, // ←必要ならここ変えて
}: Props) {
  const [downloading, setDownloading] = useState(false);

  const isMobile = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod|Android/i.test(ua);
  };

  const fetchBlobFromSupabase = async (): Promise<Blob> => {
    const path = `${FOLDER}/${name}`;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw error;
    if (!data) throw new Error("No blob returned");
    return data;
  };

  // ✅ PC向け：直ダウンロード
  const downloadToFile = async () => {
    const blob = await fetchBlobFromSupabase();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = name; // PCでは効く
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  // ✅ スマホ向け：共有シート（できるなら files で）
  const shareOrFallback = async () => {
    // まず blob を用意
    const blob = await fetchBlobFromSupabase();

    const nav: any = navigator;
    const canShareFiles =
      typeof nav.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({
        files: [new File([blob], name, { type: blob.type || "image/jpeg" })],
      });

    if (canShareFiles) {
      const file = new File([blob], name, { type: blob.type || "image/jpeg" });
      await nav.share({
        files: [file],
        title: name,
      });
      return; // 共有できた
    }

    // filesが無理でも「URL共有」だけなら通ることがある
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: name,
          url: imageUrl, // 画像URLを共有（保存は共有先アプリ次第）
        });
        return;
      } catch {
        // shareキャンセル/失敗は次のfallbackへ
      }
    }

    // ✅ 最終fallback：写真単体ページへ（ここがあなたの“方式B”）
    window.location.href = singlePhotoPagePath(name);
  };

  const handleDownload = async () => {
    // ✅ ダウンロード済みは押せない
    if (downloaded) return;
    if (downloading) return;

    setDownloading(true);
    try {
      if (isMobile()) {
        await shareOrFallback();
        // 「共有が出た / 写真ページに飛んだ」時点で “保存したい意思” は成立なので消す運用ならここでOK
        // もし「実際に保存できた時だけ消す」にしたいなら、単体ページ側で完了後に onDownloaded を呼ぶ設計にする
        onDownloaded();
      } else {
        await downloadToFile();
        onDownloaded();
      }
    } catch (e) {
      console.error("[DL] failed", name, e);
      alert("保存/共有に失敗（ネットワーク/権限/対応状況）");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* 写真枠 */}
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

        {/* 写真（downloaded=false の時だけ表示に戻したいならこのまま） */}
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
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {dateText}
        </div>
      </div>

      {/* download/share button（downloadedでも“表示はしていい”けど押せない） */}
      <button
        onClick={handleDownload}
        disabled={downloading || downloaded}
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
          opacity: 1, // ✅ 薄くしない
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