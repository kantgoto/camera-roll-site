// components/VideoItem.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
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

  // “再生するか” の判定（画面内に入った）
  const [inView, setInView] = useState(false);

  // “srcを解放してよいか” の判定（かなり遠い）
  const [near, setNear] = useState(false);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod|Android/i.test(ua);
  }, []);

  /* ----------------------------------------------------
   * ①② IntersectionObserver を2段にする
   * - near: 先読みゾーン（srcをセットしておく）
   * - inView: 再生ゾーン（play/pause）
   * ---------------------------------------------------- */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    if (downloaded) {
      setInView(false);
      setNear(false);
      return;
    }

    // ① 先読みを増やす：500px/item × 5個 = 約2500px → 安全に3000px
    const PRELOAD_MARGIN = "25000px 0px 25000px 0px";

    // ② 再生判定はちょい厳しめ（これでチラつき防止）
    const PLAY_MARGIN = "800px 0px 800px 0px";

    const nearObs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setNear(!!e?.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: PRELOAD_MARGIN }
    );

    const playObs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setInView(!!e?.isIntersecting && (e.intersectionRatio ?? 0) >= 0.25);
      },
      { root: null, threshold: [0, 0.25, 0.5, 1], rootMargin: PLAY_MARGIN }
    );

    nearObs.observe(el);
    playObs.observe(el);

    return () => {
      nearObs.disconnect();
      playObs.disconnect();
    };
  }, [downloaded]);

  /* ----------------------------------------------------
   * ② srcの管理：
   * - near の間は src を保持（先読み）
   * - near から外れたら src を外して解放
   * ---------------------------------------------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // URL無い / downloaded は安全側で解放
    if (!videoUrl || downloaded) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {}
      return;
    }

    if (near) {
      // 先読みゾーンに入ったら src をセット（すでにあれば何もしない）
      try {
        if (!v.getAttribute("src")) {
          v.setAttribute("src", videoUrl);
          // preloadは metadata にして “最初の一瞬” を早くする
          v.preload = "metadata";
          v.load();
        }
      } catch {}
    } else {
      // かなり遠くまで離れたら解放（毎回ガチャガチャしないよう near で制御）
      try {
        v.pause();
        v.currentTime = 0;
        v.removeAttribute("src");
        v.load();
      } catch {}
    }
  }, [near, videoUrl, downloaded]);

  /* ----------------------------------------------------
   * inView に応じて play/pause
   * （src は near で管理してるので、ここでは触らない）
   * ---------------------------------------------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!videoUrl || downloaded) return;

    const run = async () => {
      if (inView) {
        try {
          // iOSは play() が弾かれることがあるのでcatch
          await v.play();
        } catch {}
      } else {
        try {
          v.pause();
        } catch {}
      }
    };

    run();
  }, [inView, videoUrl, downloaded]);

  /* ----------------------------------------------------
   * DL処理（そのまま）
   * ---------------------------------------------------- */
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
              // preloadは near で上書きするけど保険で
              preload="metadata"
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