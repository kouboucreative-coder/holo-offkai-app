"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Message = {
  id: string;
  text: string;
  uid: string;
  name: string;
  createdAt: any;
};

export default function PersonalChatPage() {
  const { uid: otherUserId } = useParams();
  const user = auth.currentUser;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
        <Navbar />
        <p className="text-center mt-20 text-gray-500">ログインしてください。</p>
      </div>
    );
  }

  const chatId = [user.uid, otherUserId].sort().join("_");

  useEffect(() => {
    const q = query(
      collection(db, "personalChats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await setDoc(
        doc(db, "personalChats", chatId),
        { users: [user.uid, otherUserId] },
        { merge: true }
      );
      await addDoc(collection(db, "personalChats", chatId, "messages"), {
        text: newMessage,
        uid: user.uid,
        name: user.displayName || "名無し",
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, "personalChats", chatId, "messages", messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;
    try {
      for (const id of selectedMessages) {
        await deleteDoc(doc(db, "personalChats", chatId, "messages", id));
      }
      setSelectedMessages(new Set());
      setSelectionMode(false);
    } catch (err) {
      console.error("Error deleting selected messages:", err);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedMessages);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMessages(newSet);
  };

  const startLongPress = (id: string) => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    longPressTimeout.current = setTimeout(() => {
      setSelectionMode(true);
      toggleSelect(id);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">個人チャット</p>
            <h1 className="font-bold text-gray-900">メッセージ</h1>
          </div>
          <Link href="/chat" className="shrink-0">
            <div className="text-sm text-gray-500 hover:text-gray-700 transition">← 一覧へ</div>
          </Link>
        </div>

        {/* メッセージ一覧 */}
        <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4" style={{ minHeight: 0 }}>
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-8">まだメッセージはありません。</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (msg.uid === user.uid) {
                    setSelectionMode(true);
                    toggleSelect(msg.id);
                  }
                }}
                onTouchStart={() => msg.uid === user.uid && startLongPress(msg.id)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                className={`mb-3 flex ${msg.uid === user.uid ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    msg.uid === user.uid
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  <Link href={`/profile/${msg.uid}`}>
                    <p className={`text-xs font-semibold mb-1 hover:underline ${
                      msg.uid === user.uid ? "text-white/80" : "text-blue-600"
                    }`}>
                      {msg.name}
                    </p>
                  </Link>
                  <p className="leading-relaxed">{msg.text}</p>
                  <div className="flex justify-end items-center gap-2 mt-1">
                    <p className="text-[10px] opacity-60">{formatTime(msg.createdAt)}</p>
                    {msg.uid === user.uid && (
                      <>
                        {!selectionMode ? (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="text-[10px] opacity-50 hover:opacity-100 transition"
                          >
                            🗑
                          </button>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedMessages.has(msg.id)}
                            onChange={() => toggleSelect(msg.id)}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* 一括削除バー */}
        {selectionMode && selectedMessages.size > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-3 flex justify-end gap-2">
            <button
              onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
            <button
              onClick={deleteSelectedMessages}
              className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
            >
              削除 ({selectedMessages.size})
            </button>
          </div>
        )}

        {/* 入力フォーム */}
        <form onSubmit={sendMessage} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex gap-2 items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all"
          >
            送信
          </button>
        </form>
      </main>
    </div>
  );
}
