// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PhotoItem from "@/components/PhotoItem";
import VideoItem from "@/components/VideoItem";
import { supabase } from "@/lib/supabaseClient";
import * as exifr from "exifr";

type UrlMap = Record<string, string>;        // key = media_id ("photos/2025/001.jpg" etc)
type DlMap = Record<string, boolean>;        // key = media_id
type DateLabelMap = Record<string, string>;  // key = media_id -> "YYYY,MM,DD"

type MediaItem = {
  kind: "photo" | "video";
  bucket: "photos" | "videos";
  folder: string; // "2025"
  name: string;   // "001.jpg" / "v001.mp4"
  path: string;   // "2025/001.jpg" / "2025/v001.mp4"
  id: string;     // "photos/2025/001.jpg" or "videos/2025/v001.mp4"
  createdAt?: string;
};

const PHOTO_BUCKET = "photos" as const;
const VIDEO_BUCKET = "videos" as const;
const FOLDER = "2025";
const GREEN = "#78FF6E";

// figma 基準
const BASE = {
  frameW: 390,

  title: { left: 30, top: 66, width: 330, height: 120 },
  bodyPrimary2: { left: 30, top: 211, width: 330, height: 156 },

  toggleBtn: { left: 30, top: 398, width: 15, height: 17 },
  bodySecondary4: { left: 30, top: 423, width: 195, height: 230 },

  photo: { left: 30, top: 424, width: 330, height: 440 },
  date: { left: 123, top: 629, width: 145, height: 31 },
  btn: { left: 260, top: 869, width: 100, height: 20 },
};

// 写真/動画間の間隔
const GAP_Y = 440 + 60; // 500

// Fisher–Yates shuffle
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isPhoto = (name: string) => {
  const n = name.toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg");
};

const isVideo = (name: string) => {
  const n = name.toLowerCase();
  return n.endsWith(".mp4"); // いま全部 mp4 前提
};

const toLabel = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy},${mm},${dd}`;
};

const dateCacheKey = (media_id: string) => `date-label:${media_id}`;

/**
 * 動画の日付 fallback:
 * publicUrl に HEAD → Last-Modified を拾えたらラッキー
 */
const tryGetLastModifiedLabel = async (url: string) => {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const lm = res.headers.get("last-modified");
    if (!lm) return "";
    const d = new Date(lm);
    if (Number.isNaN(d.getTime())) return "";
    return toLabel(d);
  } catch {
    return "";
  }
};

export default function Page() {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [urlMap, setUrlMap] = useState<UrlMap>({});
  const [downloadedMap, setDownloadedMap] = useState<DlMap>({});
  const [dateLabelMap, setDateLabelMap] = useState<DateLabelMap>({});

  const [showSecondary4, setShowSecondary4] = useState(false);
  const [fixedBaseLeft, setFixedBaseLeft] = useState<number | null>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // 日付読み取りの重複防止
  const seenDateRef = useRef<Record<string, true>>({});

  /* ----------------------------------------------------
   * 追加) 動画の撮影日JSON（public/video-dates.json）を読む
   * - JSON key: "2025/v001.mp4"
   * - state key: "videos/2025/v001.mp4" にして入れる
   * - 既に入ってる dateLabelMap は上書きしない
   * ---------------------------------------------------- */
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/video-dates.json", { cache: "no-store" });
        if (!res.ok) {
          console.warn("[video-dates] fetch failed", res.status);
          return;
        }

        const json: Record<string, string> = await res.json();

        setDateLabelMap((prev) => {
          const next = { ...prev };

          for (const [path, label] of Object.entries(json)) {
            const id = `videos/${path}`; // ✅ ここ重要（items の id と一致させる）
            if (!next[id] && label) {
              next[id] = label;
            }
          }

          return next;
        });

        // デバッグしたければ
        // console.log("[video-dates] loaded keys:", Object.keys(json).length);
      } catch (e) {
        console.warn("[video-dates] error", e);
      }
    };

    run();
  }, []);

  /* ----------------------------------------------------
   * 1) ✅ Storageをlistして、写真+動画を統合してシャッフル
   *    ★ videos が 0 にならないよう recursive:true が重要
   * ---------------------------------------------------- */
  useEffect(() => {
    const listAll = async (bucket: "photos" | "videos", folder: string) => {
      const collected: Array<{ name: string; createdAt?: string }> = [];
      let offset = 0;
      const limit = 200;

      while (true) {
        const { data, error } = await supabase.storage.from(bucket).list(folder, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
          recursive: true, // ✅ keep
        });

        console.log("[LIST]", {
          bucket,
          folder,
          offset,
          limit,
          error,
          len: data?.length,
          first: data?.[0],
        });

        if (error) {
          console.error(`[storage list error] bucket=${bucket}`, error);
          break;
        }

        for (const x of data ?? []) {
          if (!x?.name) continue;
          if (x.name.startsWith(".")) continue; // .DS_Store
          collected.push({ name: x.name, createdAt: (x as any).created_at });
        }

        if (!data || data.length < limit) break;
        offset += limit;
      }

      return collected;
    };

    const run = async () => {
      setLoadingItems(true);

      const [photos, videos] = await Promise.all([
        listAll(PHOTO_BUCKET, FOLDER),
        listAll(VIDEO_BUCKET, FOLDER),
      ]);

      // ここ、デバッグ用（必要なら残してOK）
      console.log("photos:", photos?.length ?? 0, "videos:", videos?.length ?? 0);

      const photoItems: MediaItem[] = (photos ?? [])
        .filter((x) => isPhoto(x.name))
        .map((x) => {
          const path = `${FOLDER}/${x.name}`;
          return {
            kind: "photo",
            bucket: PHOTO_BUCKET,
            folder: FOLDER,
            name: x.name,
            path,
            id: `${PHOTO_BUCKET}/${path}`,
            createdAt: x.createdAt,
          };
        });

      const videoItems: MediaItem[] = (videos ?? [])
        .filter((x) => isVideo(x.name))
        .map((x) => {
          const path = `${FOLDER}/${x.name}`;
          return {
            kind: "video",
            bucket: VIDEO_BUCKET,
            folder: FOLDER,
            name: x.name,
            path,
            id: `${VIDEO_BUCKET}/${path}`,
            createdAt: x.createdAt,
          };
        });

      const mixed = shuffle([...photoItems, ...videoItems]);
      setItems(mixed);

      // 動画だけ：createdAt が取れてるなら先に入れる（速い）
      setDateLabelMap((prev) => {
        const next = { ...prev };
        for (const it of mixed) {
          if (it.kind !== "video") continue;
          if (next[it.id]) continue;
          if (it.createdAt) {
            const d = new Date(it.createdAt);
            if (!Number.isNaN(d.getTime())) next[it.id] = toLabel(d);
          }
        }
        return next;
      });

      setLoadingItems(false);
    };

    run();
  }, []);

  const mediaIds = useMemo(() => items.map((it) => it.id), [items]);

  /* ----------------------------------------------------
   * 2) ✅ public URL を作る（key=media_id）
   * ---------------------------------------------------- */
  useEffect(() => {
    if (!items.length) return;

    const next: UrlMap = {};
    for (const it of items) {
      const { data } = supabase.storage.from(it.bucket).getPublicUrl(it.path);
      next[it.id] = data.publicUrl;
    }
    setUrlMap(next);
  }, [items]);

  /* ----------------------------------------------------
   * 3) ✅ downloads を読む（写真も動画も同じテーブル）
   *    photo_id に media_id を入れる運用
   * ---------------------------------------------------- */
  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("downloads")
        .select("photo_id, downloaded");

      if (error) {
        console.error("[downloads select error]", error);
        return;
      }

      const next: DlMap = {};
      for (const row of data ?? []) {
        if (row.downloaded) next[row.photo_id] = true;
      }
      setDownloadedMap(next);
    };

    run();
  }, []);

  /* ----------------------------------------------------
   * 4) ✅ 写真: EXIF 日付を読む（download → exifr）+ cache
   *    動画: publicUrl HEAD Last-Modified fallback + cache
   * ---------------------------------------------------- */
  const readPhotoDateLabel = async (bucket: string, path: string) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) return "";

      const buf = await data.arrayBuffer();
      const exif: any = await exifr.parse(buf, {
        tiff: true,
        exif: true,
        gps: false,
        xmp: false,
        icc: false,
      });

      const dt =
        exif?.DateTimeOriginal ||
        exif?.CreateDate ||
        exif?.ModifyDate ||
        exif?.DateTime;

      if (!dt) return "";

      const date = dt instanceof Date ? dt : new Date(dt);
      if (Number.isNaN(date.getTime())) return "";

      return toLabel(date);
    } catch (e) {
      console.warn("[exif read failed]", path, e);
      return "";
    }
  };

  useEffect(() => {
    if (!items.length) return;

    let cancelled = false;

    const run = async () => {
      for (const it of items) {
        const id = it.id;

        if (seenDateRef.current[id]) continue;

        // state にあるならOK
        if (dateLabelMap[id]) {
          seenDateRef.current[id] = true;
          continue;
        }

        // localStorage cache
        try {
          const cached = localStorage.getItem(dateCacheKey(id));
          if (cached) {
            if (!cancelled) setDateLabelMap((p) => ({ ...p, [id]: cached }));
            seenDateRef.current[id] = true;
            continue;
          }
        } catch {}

        // 写真
        if (it.kind === "photo") {
          const label = await readPhotoDateLabel(it.bucket, it.path);
          if (cancelled) return;

          if (!cancelled) setDateLabelMap((p) => ({ ...p, [id]: label || "" }));
          try {
            if (label) localStorage.setItem(dateCacheKey(id), label);
          } catch {}

          seenDateRef.current[id] = true;
          continue;
        }

        // 動画: createdAt が無い/入ってない場合に HEAD fallback
        const url = urlMap[id];
        if (url) {
          const label = await tryGetLastModifiedLabel(url);
          if (cancelled) return;

          if (label) {
            if (!cancelled) setDateLabelMap((p) => ({ ...p, [id]: label }));
            try {
              localStorage.setItem(dateCacheKey(id), label);
            } catch {}
          }

          seenDateRef.current[id] = true;
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaIds, urlMap]);

  /* ----------------------------------------------------
   * 5) ✅ DL完了 → downloads に upsert（共通）
   * ---------------------------------------------------- */
  const handleDownloaded = async (media_id: string) => {
    setDownloadedMap((prev) => ({ ...prev, [media_id]: true }));

    const { error } = await supabase
      .from("downloads")
      .upsert(
        {
          photo_id: media_id, // ✅ photos/... も videos/... も入れる
          downloaded: true,
          downloaded_at: new Date().toISOString(),
        },
        { onConflict: "photo_id" }
      );

    if (error) {
      console.error("[downloads upsert error]", error);
      setDownloadedMap((prev) => {
        const copy = { ...prev };
        delete copy[media_id];
        return copy;
      });
    }
  };

  /* ----------------------------------------------------
   * 6) fixed UI の left 補正
   * ---------------------------------------------------- */
  const frameH =
    BASE.btn.top + BASE.btn.height + Math.max(0, items.length - 1) * GAP_Y + 60;

  useEffect(() => {
    const measure = () => {
      const r = frameRef.current?.getBoundingClientRect();
      if (r) setFixedBaseLeft(r.left);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white py-10">
      {/* ===== 固定UI ===== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          aria-label="toggle secondary"
          onClick={() => setShowSecondary4((v) => !v)}
          style={{
            position: "fixed",
            left: (fixedBaseLeft ?? 0) + BASE.toggleBtn.left,
            top: BASE.toggleBtn.top,
            width: BASE.toggleBtn.width,
            height: BASE.toggleBtn.height,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            pointerEvents: "auto",
            zIndex: 1000000,
          }}
        >
          <img
            src="/SVG/button.svg"
            alt="toggle"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              transform: "rotate(90deg)",
              pointerEvents: "none",
            }}
          />
        </button>

        {showSecondary4 && (
          <img
            src="/SVG/body-secondary4.svg"
            alt="body-secondary4"
            draggable={false}
            style={{
              position: "fixed",
              left: (fixedBaseLeft ?? 0) + BASE.bodySecondary4.left,
              top: BASE.bodySecondary4.top,
              width: BASE.bodySecondary4.width,
              height: BASE.bodySecondary4.height,
              pointerEvents: "none",
              zIndex: 999999,
            }}
          />
        )}
      </div>

      {/* ===== フレーム ===== */}
      <div
        ref={frameRef}
        style={{
          position: "relative",
          width: BASE.frameW,
          height: frameH,
          margin: "0 auto",
          background: "white",
        }}
      >
        <img
          src="/SVG/title.svg"
          style={{ position: "absolute", ...BASE.title }}
          alt=""
          draggable={false}
        />
        <img
          src="/SVG/body-primary2.svg"
          style={{ position: "absolute", ...BASE.bodyPrimary2 }}
          alt=""
          draggable={false}
        />

        {loadingItems && (
          <div
            style={{
              position: "absolute",
              left: 30,
              top: 430,
              color: GREEN,
              fontFamily: "var(--font-cinzel-decorative)",
            }}
          >
            loading...
          </div>
        )}

        {items.map((it, idx) => {
          const y = idx * GAP_Y;

          if (it.kind === "photo") {
            return (
              <PhotoItem
                key={it.id}
                name={it.name}
                imageUrl={urlMap[it.id] ?? ""}
                dateText={dateLabelMap[it.id] ?? ""}
                photoRect={{ ...BASE.photo, top: BASE.photo.top + y }}
                dateRect={{ ...BASE.date, top: BASE.date.top + y }}
                buttonSvg="/SVG/button-download.svg"
                buttonRect={{ ...BASE.btn, top: BASE.btn.top + y }}
                downloaded={!!downloadedMap[it.id]}
                onDownloaded={() => handleDownloaded(it.id)}
                green={GREEN}
              />
            );
          }

          return (
            <VideoItem
              key={it.id}
              name={it.name}
              videoUrl={urlMap[it.id] ?? ""}
              dateText={dateLabelMap[it.id] ?? ""}
              videoRect={{ ...BASE.photo, top: BASE.photo.top + y }} // 写真と同じ配置
              dateRect={{ ...BASE.date, top: BASE.date.top + y }}
              buttonSvg="/SVG/button-download.svg"
              buttonRect={{ ...BASE.btn, top: BASE.btn.top + y }}
              downloaded={!!downloadedMap[it.id]}
              onDownloaded={() => handleDownloaded(it.id)}
              green={GREEN}
              bucket={it.bucket}
              path={it.path}
            />
          );
        })}
      </div>
    </main>
  );
}