// app/admin/notice/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

// ── 型定義 ──────────────────────────────────────────────
type Notice = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  pinned?: boolean;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
};

// ── ユーティリティ ───────────────────────────────────────
function formatDate(ts: Timestamp | null): string {
  if (!ts) return "-";
  try {
    return ts.toDate().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

// ── メインページ ─────────────────────────────────────────
export default function AdminNoticePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);

  // 新規作成フォームの状態
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPublished, setNewPublished] = useState(true);
  const [newPinned, setNewPinned] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // 操作中フラグ
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── 管理者チェック ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/"); return; }
      try {
        const [userSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "admins", user.uid)),
        ]);
        const ok =
          (userSnap.exists() && userSnap.data().role === "admin") ||
          adminSnap.exists();
        if (ok) { setIsAdmin(true); }
        else { setIsAdmin(false); router.push("/"); }
      } catch { setIsAdmin(false); router.push("/"); }
    });
    return () => unsub();
  }, [router]);

  // ── お知らせ取得 ────────────────────────────────────────
  const fetchNotices = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "notices"), orderBy("createdAt", "desc"))
      );
      setNotices(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: (data.title as string) || "(無題)",
            body: (data.body as string) || "",
            published: data.published === true || (data.isVisible as boolean) === true,
            pinned: data.pinned === true,
            createdAt: (data.createdAt as Timestamp) || null,
            updatedAt: (data.updatedAt as Timestamp) || null,
          };
        })
      );
    } catch (e) {
      console.error("Error fetching notices:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ── 新規作成 ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim()) { setCreateError("タイトルを入力してください。"); return; }
    if (!newBody.trim()) { setCreateError("本文を入力してください。"); return; }
    setCreateError("");
    setCreating(true);
    try {
      await addDoc(collection(db, "notices"), {
        title: newTitle.trim(),
        body: newBody.trim(),
        published: newPublished,
        pinned: newPinned,
        isVisible: newPublished, // 後方互換
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTitle("");
      setNewBody("");
      setNewPublished(true);
      setNewPinned(false);
      setShowCreate(false);
      await fetchNotices();
    } catch (e) {
      console.error(e);
      setCreateError("作成に失敗しました。もう一度お試しください。");
    } finally {
      setCreating(false);
    }
  };

  // ── 公開/非公開トグル ───────────────────────────────────
  const togglePublish = async (notice: Notice) => {
    if (busyId) return;
    setBusyId(notice.id);
    try {
      const next = !notice.published;
      await updateDoc(doc(db, "notices", notice.id), {
        published: next,
        isVisible: next,
        updatedAt: serverTimestamp(),
      });
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, published: next } : n))
      );
    } finally {
      setBusyId(null);
    }
  };

  // ── ピン留めトグル ──────────────────────────────────────
  const togglePinned = async (notice: Notice) => {
    if (busyId) return;
    setBusyId(notice.id);
    try {
      const next = !notice.pinned;
      await updateDoc(doc(db, "notices", notice.id), {
        pinned: next,
        updatedAt: serverTimestamp(),
      });
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, pinned: next } : n))
      );
    } finally {
      setBusyId(null);
    }
  };

  // ── 削除 ────────────────────────────────────────────────
  const handleDelete = async (notice: Notice) => {
    if (busyId) return;
    if (!confirm(`「${notice.title}」を削除しますか？この操作は取り消せません。`)) return;
    setBusyId(notice.id);
    try {
      await deleteDoc(doc(db, "notices", notice.id));
      setNotices((prev) => prev.filter((n) => n.id !== notice.id));
    } finally {
      setBusyId(null);
    }
  };

  // ── ガード ──────────────────────────────────────────────
  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50/30 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50/30">
        <Navbar />
        <p className="text-center mt-20 text-rose-700 font-bold">権限がありません。</p>
      </div>
    );
  }

  const publishedCount = notices.filter((n) => n.published).length;
  const draftCount = notices.filter((n) => !n.published).length;
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 text-sm bg-white";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-yellow-50/30">
      <Navbar />
      <main className="max-w-4xl mx-auto w-full px-4 py-6 sm:px-6">

        {/* ── ヘッダ ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📢 お知らせ管理</h1>
            <p className="text-gray-500 text-sm mt-1">
              全 {notices.length} 件
              <span className="ml-2 text-emerald-600 font-medium">公開中 {publishedCount}</span>
              <span className="ml-2 text-gray-400">下書き {draftCount}</span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/admin">
              <button className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm">
                ← 管理トップ
              </button>
            </Link>
            <button
              onClick={() => { setShowCreate((v) => !v); setCreateError(""); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                showCreate
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {showCreate ? "✕ 閉じる" : "＋ 新規作成"}
            </button>
          </div>
        </div>

        {/* ── 新規作成フォーム ── */}
        {showCreate && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6 mb-6 space-y-4">
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              📝 新しいお知らせを作成
            </h2>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                ⚠️ {createError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => { setNewTitle(e.target.value); setCreateError(""); }}
                placeholder="例: システムメンテナンスのお知らせ"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                本文 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={newBody}
                onChange={(e) => { setNewBody(e.target.value); setCreateError(""); }}
                rows={5}
                placeholder="お知らせの内容を入力してください..."
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{newBody.length} 文字</p>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPublished}
                  onChange={(e) => setNewPublished(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-gray-700">
                  作成と同時に <span className="font-semibold text-emerald-600">公開</span> する
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPinned}
                  onChange={(e) => setNewPinned(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-amber-600">📌 ピン留め</span> する（上部に固定表示）
                </span>
              </label>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newBody.trim()}
                className="flex-1 sm:flex-none px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-400 text-white rounded-xl font-bold hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {creating ? "配信中..." : newPublished ? "📢 配信する" : "📄 下書きで保存"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); setNewTitle(""); setNewBody(""); }}
                className="px-6 py-3.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* ── お知らせ一覧 ── */}
        {notices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-20 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 text-sm">お知らせがまだありません。</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600"
            >
              最初のお知らせを作成する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ピン留め済みを上に */}
            {[...notices]
              .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
              })
              .map((notice) => (
                <div
                  key={notice.id}
                  className={`bg-white rounded-2xl shadow-sm border transition ${
                    notice.pinned
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : notice.published
                      ? "border-gray-100"
                      : "border-gray-100 opacity-70"
                  }`}
                >
                  <div className="p-5">
                    {/* タイトル行 */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {notice.pinned && (
                            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                              📌 ピン留め
                            </span>
                          )}
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                              notice.published
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}
                          >
                            {notice.published ? "● 公開中" : "○ 下書き"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(notice.createdAt)}
                          </span>
                        </div>
                        <h2 className="font-bold text-gray-900 text-base leading-snug">
                          {notice.title}
                        </h2>
                      </div>
                    </div>

                    {/* 本文プレビュー */}
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 whitespace-pre-line">
                      {notice.body}
                    </p>

                    {/* アクションボタン */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 公開/非公開トグル */}
                      <button
                        onClick={() => togglePublish(notice)}
                        disabled={busyId === notice.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-60 ${
                          notice.published
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        }`}
                      >
                        {busyId === notice.id
                          ? "処理中..."
                          : notice.published
                          ? "非公開にする"
                          : "📢 公開する"}
                      </button>

                      {/* ピン留めトグル */}
                      <button
                        onClick={() => togglePinned(notice)}
                        disabled={busyId === notice.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-60 ${
                          notice.pinned
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200"
                        }`}
                      >
                        {notice.pinned ? "📌 ピン解除" : "📌 ピン留め"}
                      </button>

                      {/* 編集ボタン */}
                      <Link href={`/admin/notice/${notice.id}`} className="ml-auto">
                        <button className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 border border-blue-200">
                          ✏️ 編集
                        </button>
                      </Link>

                      {/* 削除ボタン */}
                      <button
                        onClick={() => handleDelete(notice)}
                        disabled={busyId === notice.id}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 border border-red-200 disabled:opacity-60"
                      >
                        🗑 削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
