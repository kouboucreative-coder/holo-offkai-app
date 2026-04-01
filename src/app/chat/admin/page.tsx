// app/chat/admin/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

type Msg = {
  id: string;
  uid: string;
  name?: string;
  text: string;
  createdAt?: any;
};

export default function AdminChatPage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAllowed(false);
        setReady(true);
        return;
      }
      setDisplayName(u.displayName || "管理者");
      setAllowed(true);
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const col = collection(db, "adminChats", "main", "messages");
    const qy = query(col, orderBy("createdAt", "asc"), limit(200));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setMsgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
      (err) => {
        console.error("admin chat subscribe error:", err);
        setAllowed(false);
      }
    );
    return () => unsub();
  }, [allowed]);

  const send = async () => {
    const u = auth.currentUser;
    if (!u) return alert("ログインしてください。");
    const content = text.trim();
    if (!content) return;
    try {
      await addDoc(collection(db, "adminChats", "main", "messages"), {
        uid: u.uid,
        name: u.displayName || displayName || "管理者",
        text: content,
        createdAt: serverTimestamp(),
      });
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました（管理者権限が必要です）。");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-2.5 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full">Admin</span>
            <h1 className="font-bold text-gray-900">管理者チャット</h1>
          </div>
          <Link href="/chat" className="shrink-0">
            <div className="text-sm text-gray-500 hover:text-gray-700 transition">← 一覧へ</div>
          </Link>
        </div>

        {!ready ? (
          <p className="text-center text-gray-400 mt-8">読み込み中...</p>
        ) : allowed ? (
          <>
            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4" style={{ minHeight: 0, maxHeight: "60vh" }}>
              {msgs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-8">まだメッセージはありません。</p>
              ) : (
                msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`mb-3 flex ${m.uid === auth.currentUser?.uid ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm ${
                        m.uid === auth.currentUser?.uid
                          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${
                        m.uid === auth.currentUser?.uid ? "text-white/80" : "text-blue-600"
                      }`}>
                        {m.name ?? "管理者"}
                      </p>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      <p className="text-[10px] opacity-60 text-right mt-1">
                        {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* 入力欄 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex gap-2 items-center">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="メッセージを入力..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all disabled:opacity-50"
              >
                送信
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500 text-sm">このページは管理者のみ利用できます。</p>
          </div>
        )}
      </main>
    </div>
  );
}
