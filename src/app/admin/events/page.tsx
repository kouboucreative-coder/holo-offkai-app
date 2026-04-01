// app/admin/events/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

type AdminEvent = {
  id: string;
  title?: string;
  date?: string;
  description?: string;
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  capacity?: number;
  participants?: { uid: string; name: string }[];
  isHidden?: boolean;      // 管理用：非表示
  joinOpen?: boolean;      // 管理用：参加受付
};

export default function AdminEventsPage() {
  const router = useRouter();

  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索UI
  const [keyword, setKeyword] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [onlyClosed, setOnlyClosed] = useState(false);

  // ===== 管理者チェック =====
  useEffect(() => {
    const check = async () => {
      const me = auth.currentUser;
      if (!me) {
        router.push("/");
        return;
      }
      const snap = await getDoc(doc(db, "users", me.uid));
      const role = snap.exists() ? (snap.data() as any).role : undefined;
      if (role === "admin") setMeIsAdmin(true);
      else {
        setMeIsAdmin(false);
        router.push("/");
      }
    };
    check().catch(() => {
      setMeIsAdmin(false);
      router.push("/");
    });
  }, [router]);

  // ===== イベント取得 =====
  useEffect(() => {
    if (!meIsAdmin) return;
    const run = async () => {
      try {
        const ref = collection(db, "events");
        const qy = query(ref, orderBy("createdAt", "desc"), limit(300));
        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AdminEvent[];
        setEvents(list);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [meIsAdmin]);

  // ===== フィルタリング/検索 =====
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return events.filter((e) => {
      if (onlyHidden && !e.isHidden) return false;
      if (onlyClosed && e.joinOpen !== false) return false;
      if (!k) return true;
      const hay = [
        e.id,
        e.title,
        e.date,
        e.createdBy,
        e.createdByName,
        (e.participants?.length ?? 0).toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(k);
    });
  }, [events, keyword, onlyHidden, onlyClosed]);

  if (meIsAdmin === null || loading) {
    return <p className="text-center mt-10">読み込み中...</p>;
  }
  if (!meIsAdmin) {
    return <p className="text-center mt-10">アクセス権限がありません。</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        {/* ヘッダー */}
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📅 イベント管理</h1>
            <p className="text-gray-600 text-sm">検索して詳細（管理）を開けます。</p>
          </div>
          <Link
            href="/admin"
            className="px-3 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            ← 管理メニュー
          </Link>
        </div>

        {/* 検索フォーム */}
        <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-4 mb-6">
          <label className="block text-sm text-gray-700 mb-1">キーワード検索</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="タイトル / ID / 主催者名 / UID …"
            className="w-full px-3 py-2 border rounded text-black"
          />
          <div className="flex items-center gap-6 mt-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-sky-600"
                checked={onlyHidden}
                onChange={(e) => setOnlyHidden(e.target.checked)}
              />
              非表示のみ
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-sky-600"
                checked={onlyClosed}
                onChange={(e) => setOnlyClosed(e.target.checked)}
              />
              参加停止のみ
            </label>
            <button
              onClick={() => {
                setKeyword("");
                setOnlyHidden(false);
                setOnlyClosed(false);
              }}
              className="ml-auto px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300"
            >
              クリア
            </button>
          </div>
        </div>

        {/* 一覧 */}
        {filtered.length === 0 ? (
          <p className="text-gray-600">該当イベントがありません。</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="bg-white/90 rounded-lg border border-gray-100 p-4 shadow-sm flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {e.title || "(無題)"}
                    </h3>
                    {e.isHidden && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        非表示
                      </span>
                    )}
                    {e.joinOpen === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                        参加停止
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    📅 {e.date || "-"} / 👤 {e.createdByName || e.createdBy || "-"} / 👥{" "}
                    {(e.participants?.length ?? 0)}/{e.capacity ?? "-"}
                  </p>
                  <p className="text-[12px] text-gray-500 mt-1">ID: {e.id}</p>
                </div>

                <Link
                  href={`/admin/events/${e.id}`}
                  className="shrink-0 px-3 py-2 bg-sky-600 text-white rounded hover:bg-sky-700"
                >
                  開く
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}