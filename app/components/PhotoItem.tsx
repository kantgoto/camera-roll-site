"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  folder: string;     // "2025"
  name: string;       // "003.jpg" みたいな
  createdAt?: string;
  onDownloaded?: () => void;
};

export default function PhotoItem({ folder, name, createdAt, onDownloaded }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      const path = `${folder}/${name}`;

      // サムネ表示用URL（公開 or 署名URL）
      const { data, error } = await supabase.storage
        .from("photos")
        .createSignedUrl(path, 60 * 60); // 1時間

      if (!canceled) {
        if (error) {
          console.error(error);
          setUrl(null);
        } else {
          setUrl(data.signedUrl);
        }
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [folder, name]);

  const handleDownload = async () => {
    const path = `${folder}/${name}`;

    // 1) 実体をDL（blob）
    const { data, error } = await supabase.storage.from("photos").download(path);
    if (error || !data) {
      console.error(error);
      return;
    }

    // 2) ブラウザDL発火
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    // 3) ここで「消していいよ」を親に通知
    onDownloaded?.();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-white/80">
          <div className="text-sm">{folder}/{name}</div>
          {createdAt && <div className="text-xs text-white/50">{createdAt}</div>}
        </div>

        <button
          onClick={handleDownload}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80"
        >
          ダウンロード
        </button>
      </div>

      {url && (
        <div className="mt-4 overflow-hidden rounded-xl">
          <img src={url} alt={name} className="w-full" />
        </div>
      )}
    </div>
  );
}
