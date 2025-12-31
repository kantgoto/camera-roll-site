// components/VideoItem.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  index: number;
  onVisible: (index: number) => void;

  // ✅ 先読みウィンドウに入ったら metadata を取りに行く
  shouldPreload: boolean;

  name: string;
  videoUrl: string;
  dateText: string;

  videoRect: Rect;
  dateRect: Rect;

  buttonSvg: string;
  buttonRect: Rect;

  downloaded: boolean;
  onDownloaded: () => void;

  green: string;

  bucket: string; // "videos"
  path: string;   // "2025/v001.mp4"
};

export default function VideoItem({
  index,
  onVisible,
  shouldPreload,
  name,
  videoUrl,
  dateText,
  videoRect,
  dateRect,
  buttonSvg,
  buttonRect,
  downloaded,
  onDownloaded,
  green,
  bucket,
  path,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [inView, setInView] = useState(false);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod|Android/i.test(ua);
  }, []);

  // ===== 見えてきたら activeIndex を進める（軽めに rootMargin 付ける）=====
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
        // “見える少し前”で反応
        rootMargin: "300px 0px 300px 0px",
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onVisible]);

  // ===== 画面内判定（再生用）=====
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    if (downloaded) {
      setInView(false);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setInView(!!e?.isIntersecting && (e.intersectionRatio ?? 0) >= 0.25);
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 1],
        rootMargin: "200px 0px 200px 0px",
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [downloaded]);

  // ===== 先読み（metadataだけ）=====
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!videoUrl || downloaded) return;

    // 画面内は play制御があるのでここでは触らない
    if (inView) return;

    if (shouldPreload) {
      try {
        if (!v.src) v.src = videoUrl;
        // metadata だけ先に読む（重すぎない）
        v.preload = "metadata";
        v.load();
      } catch {}
    } else {
      // 先読み範囲から外れたら解放
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {}
    }
  }, [shouldPreload, videoUrl, downloaded, inView]);

  // ===== inView に応じて play/pause =====
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!videoUrl || downloaded) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {}
      return;
    }

    const run = async () => {
      if (inView) {
        try {
          if (!v.src) v.src = videoUrl;
          v.preload = "auto";
          await v.play();
        } catch {
          // 自動再生制限などは握りつぶす
        }
      } else {
        try {
          v.pause();
          v.currentTime = 0;

          // 先読み範囲に入ってるなら src は残して metadata だけ維持
          if (shouldPreload) {
            v.preload = "metadata";
            v.load();
          } else {
            v.removeAttribute("src");
            v.load();
          }
        } catch {}
      }
    };

    run();
  }, [inView, videoUrl, downloaded, shouldPreload]);

  // ===== DL処理 =====
  const fetchBlobFromSupabase = async (): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
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
    const file = new File([blob], name, { type: blob.type || "video/mp4" });

    const canShareFiles =
      typeof nav.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] });

    if (canShareFiles) {
      await nav.share({ files: [file], title: name });
      return;
    }

    window.open(videoUrl, "_blank");
  };

  const handleDownload = async () => {
    if (downloaded) return;
    if (downloading) return;

    setDownloading(true);
    try {
      if (isMobile) {
        await shareOrFallback();
        onDownloaded();
      } else {
        await downloadToFile();
        onDownloaded();
      }
    } catch (e) {
      console.error("[VIDEO DL] failed", name, e);
      alert("保存/共有に失敗（ネットワーク/権限/対応状況）");
    } finally {
      setDownloading(false);
    }
  };

  const canShowVideo =
    !downloaded && typeof videoUrl === "string" && videoUrl.length > 0;

  return (
    <>
      {/* 動画枠 */}
      <div
        ref={wrapperRef}
        style={{
          position: "absolute",
          left: videoRect.left,
          top: videoRect.top,
          width: videoRect.width,
          height: videoRect.height,
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

        {/* 動画 */}
        {canShowVideo ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              loop
              // srcは effect で付け外し
              preload="none"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
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
          opacity: 1,
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