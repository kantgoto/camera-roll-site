// components/PhotoItem.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  name: string;
  imageUrl: string;
  dateText: string;

  photoRect: Rect; // フレーム基準
  dateRect: Rect; // フレーム基準

  buttonSvg: string;
  buttonRect: Rect; // フレーム基準

  downloaded: boolean;
  onDownloaded: () => void;

  green: string;
};

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

  // ✅ 方式B：Web Share API（共有シート）→ ダメなら方式A（新規タブで開く）
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      // 1) まず fetch で blob を作る
      const res = await fetch(imageUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();

      // blob から File を作る（share で files を渡すため）
      const file = new File([blob], name, { type: blob.type || "image/jpeg" });

      // 2) Web Share API が使えるなら共有（スマホで強い）
      const nav: any = navigator;
      const canShareFiles =
        typeof nav?.canShare === "function" && nav.canShare({ files: [file] });

      if (canShareFiles && typeof nav?.share === "function") {
        await nav.share({
          files: [file],
          title: name,
          text: "Save to Photos / Files",
        });

        // ✅ 成功扱い：UI切り替え（写真を消す／localStorage更新はpage側）
        onDownloaded();
        return;
      }

      // 3) share が無理なら、画像を新規タブで開く（長押し保存を誘導）
      // iOS Safariだとこれが一番確実
      window.open(imageUrl, "_blank", "noopener,noreferrer");

      // ✅ ここで「成功扱い」にする（保存したかは判定できないので割り切り）
      onDownloaded();
    } catch (e) {
      console.error("[DL] failed", name, e);

      // 最後の逃げ：とにかくURLを開いて保存させる
      try {
        window.open(imageUrl, "_blank", "noopener,noreferrer");
        onDownloaded();
      } catch {}

      alert("保存画面を開けなかった… もう一回試してみて！");
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
