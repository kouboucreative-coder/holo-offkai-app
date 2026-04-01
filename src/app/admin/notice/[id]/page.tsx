// app/admin/notice/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Notice = {
  title: string;
  body: string;
  published: boolean;
  createdAt?: unknown;
};

export default function AdminNoticeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const me = auth.currentUser;
      if (!me) { router.push("/"); return; }
      const snap = await getDoc(doc(db, "admins", me.uid));
      if (!snap.exists()) { router.push("/"); return; }
      setMeIsAdmin(true);
    })();
  }, [router]);

  useEffect(() => {
    if (!id || meIsAdmin !== true) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "notices", id as string));
        if (snap.exists()) {
          const data = snap.data() as Notice;
          setNotice(data);
          setTitle(data.title);
          setBody(data.body);
          setPublished(data.published ?? false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, meIsAdmin]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "notices", id as string), {
        title,
        body,
        published,
        updatedAt: serverTimestamp(),
      });
      alert("保存しました。");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("このお知らせを削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "notices", id as string));
      alert("削除しました。");
      router.push("/admin/notice");
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
    }
  };

  if (meIsAdmin === null || loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-400">読み込み中...</p>
    </div>
  );

  if (!notice) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-500">お知らせが見つかりません。</p>
    </div>
  );

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <Link href="/admin/notice" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          ← お知らせ一覧へ戻る
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">お知らせ編集</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={inputCls} />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="published" className="text-sm text-gray-700">公開する</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md transition disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
            <button
              onClick={handleDelete}
              className="px-5 py-3 border border-red-300 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition"
            >
              削除
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
