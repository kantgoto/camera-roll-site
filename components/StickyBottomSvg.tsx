"use client";

import { useEffect, useRef, useState } from "react";

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  src: string;
  alt?: string;
  rect: Rect; // フレーム基準 (X30 Y1505 etc)
  frameRef: React.RefObject<HTMLDivElement | null>;
  zIndex?: number;

  // デバッグ用（必要ならtrue）
  debug?: boolean;
};

export default function StickyBottomSvg({
  src,
  alt = "sticky-svg",
  rect,
  frameRef,
  zIndex = 9999,
  debug = false,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [locked, setLocked] = useState(false);
  const [fixedLeft, setFixedLeft] = useState(rect.left);

  const update = () => {
    const frame = frameRef.current;
    const sentinel = sentinelRef.current;
    if (!frame || !sentinel) return;

    const frameRect = frame.getBoundingClientRect();
    const sRect = sentinel.getBoundingClientRect();

    // ✅ 発火を少し早める（px）
// 例：30 なら「画面下に到達する30px手前」で固定になる
const OFFSET = 30;

// ✅ 判定は「本来の位置(sentinel)の底」が画面底 + OFFSET を下回ったら固定
const shouldLock = sRect.bottom <= window.innerHeight + OFFSET;

    setLocked(shouldLock);

    // fixed時のleftをフレーム基準に揃える（横ズレ防止）
    setFixedLeft(frameRect.left + rect.left);

    if (debug) {
      // eslint-disable-next-line no-console
      console.log("[StickyBottomSvg]", { shouldLock, sBottom: sRect.bottom, vh: window.innerHeight });
    }
  };

  useEffect(() => {
    update();

    const onScroll = () => update();
    const onResize = () => update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // rect.left/top は固定前提
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* ✅ 本来の位置を示すダミー（これで lock/unlock を判定する） */}
      <div
        ref={sentinelRef}
        style={{
          position: "absolute",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          pointerEvents: "none",
          // debug時だけ見える
          outline: debug ? "2px solid red" : "none",
          background: debug ? "rgba(255,0,0,0.08)" : "transparent",
          zIndex: -1,
        }}
      />

      {/* ✅ 実体 */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={
          locked
            ? {
                position: "fixed",
                left: fixedLeft,
                bottom: 0,
                width: rect.width,
                height: rect.height,
                zIndex,
                pointerEvents: "none",
                // debug時だけ
                outline: debug ? "2px solid blue" : "none",
              }
            : {
                position: "absolute",
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                zIndex,
                pointerEvents: "none",
                outline: debug ? "2px solid blue" : "none",
              }
        }
      />
    </>
  );
}
