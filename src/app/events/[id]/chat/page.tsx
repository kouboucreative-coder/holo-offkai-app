"use client";

import { useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Message = {
  id: string;
  text: string;
  uid: string;
  name?: string;
  createdAt: any;
};

type Event = {
  id: string;
  title: string;
  createdBy?: string;
  participants?: { uid: string; name: string }[];
};

export default function EventChatPage() {
  const { id: eventId } = useParams();
  const user = auth.currentUser;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId as string);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setEvent({ id: snapshot.id, ...snapshot.data() } as Event);
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const q = query(
      collection(db, "events", eventId as string, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message)));
    });
    return () => unsubscribe();
  }, [eventId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) {
      alert("ログインしてください");
      return;
    }
    const isParticipant =
      event.createdBy === user.uid ||
      event.participants?.some((p) => p.uid === user.uid);
    if (!isParticipant) {
      alert("このイベントに参加していません");
      return;
    }
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, "events", eventId as string, "messages"), {
        text: newMessage,
        uid: user.uid,
        name: user.displayName || "名無し",
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-400">読み込み中...</p>
    </div>
  );
  if (!event) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-500">イベントが見つかりませんでした。</p>
    </div>
  );

  const isParticipant =
    user &&
    (event.createdBy === user.uid ||
      event.participants?.some((p) => p.uid === user.uid));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">イベントチャット</p>
            <h1 className="font-bold text-gray-900 truncate">{event.title}</h1>
          </div>
          <Link href="/chat" className="shrink-0">
            <div className="text-sm text-gray-500 hover:text-gray-700 transition">← 一覧へ</div>
          </Link>
        </div>

        {!isParticipant ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 text-sm">このイベントに参加してください。</p>
          </div>
        ) : (
          <>
            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4" style={{ minHeight: 0 }}>
              {messages.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-8">まだメッセージはありません。</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-3 flex ${msg.uid === user?.uid ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm ${
                        msg.uid === user?.uid
                          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}
                    >
                      <Link href={`/profile/${msg.uid}`}>
                        <p className={`text-xs font-semibold mb-1 hover:underline ${
                          msg.uid === user?.uid ? "text-white/80" : "text-blue-600"
                        }`}>
                          {msg.name || "名無し"}
                        </p>
                      </Link>
                      <p className="leading-relaxed">{msg.text}</p>
                      <p className="text-[10px] opacity-60 text-right mt-1">
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

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
          </>
        )}
      </main>
    </div>
  );
}
