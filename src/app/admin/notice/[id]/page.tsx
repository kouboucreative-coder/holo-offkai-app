// app/admin/notice/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Notice = {
  title: string;
  body: string;
  published: boolean;
  pinned: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function formatTs(ts?: Timestamp): string {
  if (!ts) return "-";
  try {
    return ts.toDate().toLocaleString("ja-JP");
  } catch {
    return "-";
  }
}

export default function AdminNoticeDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  // フォームの状態
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        if (ok) { setMeIsAdmin(true); }
        else { setMeIsAdmin(false); router.push("/"); }
      } catch { setMeIsAdmin(false); router.push("/"); }
    });
    return () => unsub();
  }, [router]);

  // ── お知らせ取得 ────────────────────────────────────────
  useEffect(() => {
    if (!id || meIsAdmin !== true) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "notices", id as string));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const n: Notice = {
            title: (data.title as string) || "",
            body: (data.body as string) || "",
            published: data.published === true || (data.isVisible as boolean) === true,
            pinned: data.pinned === true,
            createdAt: data.createdAt as Timestamp | undefined,
            updatedAt: data.updatedAt as Timestamp | undefined,
          };
          setNotice(n);
          setTitle(n.title);
          setBody(n.body);
          setPublished(n.published);
          setPinned(n.pinned);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, meIsAdmin]);

  // ── 保存 ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!id || !title.trim() || !body.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, "notices", id as string), {
        title: title.trim(),
        body: body.trim(),
        published,
        pinned,
        isVisible: published, // 後方互換
        updatedAt: serverTimestamp(),
      });
      setNotice((prev) => prev ? { ...prev, title, body, published, pinned } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  // ── 削除 ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id || !confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return;
    try {
      await deleteDoc(doc(db, "notices", id as string));
      router.push("/admin/notice");
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
    }
  };

  // ── ガード ──────────────────────────────────────────────
  if (meIsAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-yellow-50/30 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-yellow-50/30">
        <Navbar />
        <div className="max-w-2xl mx-auto p-6">
          <p className="text-gray-500">お知らせが見つかりません。</p>
          <Link href="/admin/notice" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            ← 一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-800 text-sm bg-white";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-yellow-50/30 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 sm:px-6">

        {/* パンくず */}
        <Link
          href="/admin/notice"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
        >
          ← お知らせ一覧へ戻る
        </Link>

        {/* ヘッダ */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex-1">お知らせ編集</h1>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              published
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            }`}
          >
            {published ? "● 公開中" : "○ 下書き"}
          </span>
          {pinned && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full border border-amber-200">
              📌 ピン留め
            </span>
          )}
        </div>

        <div className="space-y-4">

          {/* 編集フォーム */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

            {/* タイトル */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                本文 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{body.length} 文字</p>
            </div>

            {/* 公開 / ピン留め */}
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="published"
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-emerald-600">公開</span> する
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="pinned"
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-amber-600">📌 ピン留め</span>（上部に固定）
                </span>
              </label>
            </div>
          </div>

          {/* メタ情報 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
              <div>
                <span className="font-medium text-gray-400">作成日時</span>
                <div className="text-gray-600 mt-0.5">{formatTs(notice.createdAt)}</div>
              </div>
              <div>
                <span className="font-medium text-gray-400">最終更新</span>
                <div className="text-gray-600 mt-0.5">{formatTs(notice.updatedAt)}</div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !body.trim()}
              className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-400 text-white rounded-xl font-bold text-base hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {saving ? "保存中..." : saved ? "✅ 保存しました！" : "💾 保存する"}
            </button>
          </div>

          {/* 削除（危険操作） */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
            <h3 className="font-bold text-red-700 text-sm mb-1">🗑 このお知らせを削除</h3>
            <p className="text-xs text-red-400 mb-4">削除すると元に戻せません。</p>
            <button
              onClick={handleDelete}
              className="w-full sm:w-auto px-6 py-2.5 border-2 border-red-400 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
            >
              削除する
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
