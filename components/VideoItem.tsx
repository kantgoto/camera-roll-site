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

  // “srcをセットしてよいか” の判定（先読みゾーン）
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

    // ✅ 10個先読み（GAP_Y=500想定 → 5000px）+ ちょい余裕
    // iOSは先読みが弱いのでさらに広めでもOK
    const PRELOAD_MARGIN = isMobile ? "6000px 0px 6000px 0px" : "3000px 0px 3000px 0px";

    // 再生判定：あまり遠くで再生しない（音無しでもデコード重い）
    const PLAY_MARGIN = isMobile ? "1200px 0px 1200px 0px" : "800px 0px 800px 0px";

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
  }, [downloaded, isMobile]);

  /* ----------------------------------------------------
   * src の管理：
   * - near の間は src をセット（先読み）
   * - PCだけ：near から外れたら src を外して解放
   * - スマホ：src を外さない（付け直しが間に合わない原因になりやすい）
   * ---------------------------------------------------- */
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

    if (near) {
      try {
        // srcが無ければセット
        if (!v.getAttribute("src")) {
          v.setAttribute("src", videoUrl);
          // ✅ iOSは metadata だと全然先読みしないことがある
          v.preload = isMobile ? "auto" : "metadata";
          v.load();
        }
      } catch {}
    } else {
      // ✅ PCだけ解放する（スマホは保持）
      if (!isMobile) {
        try {
          v.pause();
          v.currentTime = 0;
          v.removeAttribute("src");
          v.load();
        } catch {}
      } else {
        // スマホ：軽く止めるだけ（src保持）
        try {
          v.pause();
        } catch {}
      }
    }
  }, [near, videoUrl, downloaded, isMobile]);

  /* ----------------------------------------------------
   * inView に応じて play/pause
   * （src は near で管理）
   * ---------------------------------------------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!videoUrl || downloaded) return;

    const run = async () => {
      if (inView) {
        try {
          // iOSはplayが弾かれることがあるのでcatch
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
              // ✅ iOS優先で auto（ただしiOSが無視することもある）
              preload={isMobile ? "auto" : "metadata"}
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