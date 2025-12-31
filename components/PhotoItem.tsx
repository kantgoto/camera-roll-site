// components/PhotoItem.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  index: number;
  onVisible: (index: number) => void;

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

  singlePhotoPagePath?: (name: string) => string;
};

const BUCKET = "photos";
const FOLDER = "2025";

export default function PhotoItem({
  index,
  onVisible,
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
  singlePhotoPagePath = (n) => `/photo?name=${encodeURIComponent(n)}`,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ✅ 見えたら activeIndex を進める（動画と同じ）
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) onVisible(index);
      },
      {
        root: null,
        threshold: 0.01,
        rootMargin: "1200px 0px 1200px 0px",
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible]);

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

  const downloadToFile = async () => {
    const blob = await fetchBlobFromSupabase();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const shareOrFallback = async () => {
    const blob = await fetchBlobFromSupabase();

    const nav: any = navigator;
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });

    const canShareFiles =
      typeof nav.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] });

    if (canShareFiles) {
      await nav.share({ files: [file], title: name });
      return;
    }

    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: name, url: imageUrl });
        return;
      } catch {
        // fallthrough
      }
    }

    window.location.href = singlePhotoPagePath(name);
  };

  const handleDownload = async () => {
    if (downloaded) return;
    if (downloading) return;

    setDownloading(true);
    try {
      if (isMobile()) {
        await shareOrFallback();
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

  const canShowImage =
    !downloaded && typeof imageUrl === "string" && imageUrl.length > 0;

  return (
    <>
      {/* 写真枠 */}
      <div
        ref={wrapperRef}
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

        {/* 写真（downloaded=false のときだけ表示） */}
        {canShowImage ? (
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
              // ✅ “eager”は全件だと重いので外す（先読みは page.tsx 側でやる）
              loading="lazy"
            />
          </div>
        ) : null}
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

      {/* ボタン */}
      <button
        onClick={handleDownload}
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
          opacity: 1,
          zIndex: 40,
          pointerEvents: downloading ? "none" : "auto",
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