// app/chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  arrayUnion,
  orderBy,
  limit,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type EventChat = {
  id: string;
  title: string;
  lastMessage?: string;
  lastMessageTime?: any;
};

type PersonalChat = {
  id: string;
  users: string[];
  otherUserId?: string;
  otherUserName?: string;
  hiddenFor?: string[];
  lastMessage?: string;
  lastMessageTime?: any;
};

function formatChatTime(timestamp: any): string {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "今";
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function ChatListPage() {
  const user = auth.currentUser;

  const [eventChats, setEventChats] = useState<EventChat[]>([]);
  const [personalChats, setPersonalChats] = useState<PersonalChat[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchMeta = async () => {
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchMeta();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const qEvents = query(collection(db, "events"));
    const unsubEvents = onSnapshot(qEvents, async (snap) => {
      const list: EventChat[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        const participants = (data.participants ?? []) as Array<{ uid?: string } | string>;
        const createdBy = data.createdBy as string | undefined;
        const isParticipant = participants.some((p) =>
          typeof p === "string" ? p === user.uid : p?.uid === user.uid
        );
        if (createdBy === user.uid || isParticipant) {
          let lastMessage: string | undefined;
          let lastMessageTime: any;
          try {
            const msgSnap = await getDocs(
              query(
                collection(db, "events", d.id, "messages"),
                orderBy("createdAt", "desc"),
                limit(1)
              )
            );
            if (!msgSnap.empty) {
              const msg = msgSnap.docs[0].data() as any;
              lastMessage = msg.text;
              lastMessageTime = msg.createdAt;
            }
          } catch { /* noop */ }
          list.push({
            id: d.id,
            title: (data.title as string) || "無題のイベント",
            lastMessage,
            lastMessageTime,
          });
        }
      }
      setEventChats(list);
    });

    const qPersonal = query(
      collection(db, "personalChats"),
      where("users", "array-contains", user.uid)
    );
    const unsubPersonal = onSnapshot(qPersonal, async (snap) => {
      const chats: PersonalChat[] = [];
      for (const d of snap.docs) {
        const data = d.data() as PersonalChat;
        if (Array.isArray((data as any).hiddenFor) && (data as any).hiddenFor!.includes(user.uid)) {
          continue;
        }
        const otherUid = data.users.find((u) => u !== user.uid);
        let otherUserName = "不明なユーザー";
        if (otherUid) {
          try {
            const ref = doc(db, "users", otherUid);
            const snapUser = await getDoc(ref);
            if (snapUser.exists()) {
              const u = snapUser.data() as any;
              otherUserName = u.displayName || u.name || "名無し";
            }
          } catch { /* noop */ }
        }
        let lastMessage: string | undefined;
        let lastMessageTime: any;
        try {
          const chatId = [user.uid, otherUid].filter(Boolean).sort().join("_");
          const msgSnap = await getDocs(
            query(
              collection(db, "personalChats", chatId, "messages"),
              orderBy("createdAt", "desc"),
              limit(1)
            )
          );
          if (!msgSnap.empty) {
            const msg = msgSnap.docs[0].data() as any;
            lastMessage = msg.text;
            lastMessageTime = msg.createdAt;
          }
        } catch { /* noop */ }
        chats.push({
          id: d.id,
          users: data.users,
          otherUserId: otherUid,
          otherUserName,
          hiddenFor: (data as any).hiddenFor || [],
          lastMessage,
          lastMessageTime,
        });
      }
      setPersonalChats(chats);
    });

    return () => {
      unsubEvents();
      unsubPersonal();
    };
  }, [user]);

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-500">ログインしてください</p>
    </div>
  );

  const removePersonalChat = async (chatId: string) => {
    if (!confirm("この個人チャットを削除しますか？")) return;
    try {
      const msgsSnap = await getDocs(collection(db, "personalChats", chatId, "messages"));
      await Promise.all(msgsSnap.docs.map((m) => deleteDoc(m.ref)));
      await deleteDoc(doc(db, "personalChats", chatId));
      setPersonalChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch {
      try {
        await updateDoc(doc(db, "personalChats", chatId), { hiddenFor: arrayUnion(user.uid) });
        setPersonalChats((prev) => prev.filter((c) => c.id !== chatId));
      } catch (e2) {
        console.error(e2);
        alert("削除できませんでした。");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">チャット</h1>
          <p className="text-sm text-gray-400 mt-0.5">メッセージのやりとり</p>
        </div>

        {/* 管理者チャット */}
        {!loadingMeta && isAdmin && (
          <div className="mb-5">
            <Link href="/chat/admin" className="block">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-lg shrink-0">
                  🛡
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900 text-sm">管理者チャット</span>
                    <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold">Admin</span>
                  </div>
                  <p className="text-xs text-gray-400">管理者専用のチャットルーム</p>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </div>
            </Link>
          </div>
        )}

        {/* イベントチャット */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gray-800">イベントチャット</h2>
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{eventChats.length}</span>
          </div>
          {eventChats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">参加中のイベントチャットはありません。</p>
              <Link href="/events" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 font-semibold">
                イベントを探す →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {eventChats.map((chat) => (
                <Link key={chat.id} href={`/events/${chat.id}/chat`} className="block">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                      💬
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate mb-0.5">{chat.title}</p>
                      {chat.lastMessage ? (
                        <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                      ) : (
                        <p className="text-xs text-gray-300">メッセージはまだありません</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {chat.lastMessageTime && (
                        <p className="text-xs text-gray-400">{formatChatTime(chat.lastMessageTime)}</p>
                      )}
                      <span className="text-gray-300 text-lg">›</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 個人チャット */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gray-800">個人チャット</h2>
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{personalChats.length}</span>
          </div>
          {personalChats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">個人チャットはまだありません。</p>
              <Link href="/events" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700 font-semibold">
                イベントで仲間を見つける →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {personalChats.map((chat) => (
                <div key={chat.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4 hover:shadow-md transition-all">
                  {chat.otherUserId ? (
                    <Link href={`/personal-chat/${chat.otherUserId}`} className="flex-1 flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                        {(chat.otherUserName ?? "?").charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate mb-0.5">
                          {chat.otherUserName}
                        </p>
                        {chat.lastMessage ? (
                          <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                        ) : (
                          <p className="text-xs text-gray-300">メッセージはまだありません</p>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="flex-1 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">?</div>
                      <span className="text-sm text-gray-400">相手ユーザーが見つかりません</span>
                    </div>
                  )}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {chat.lastMessageTime && (
                      <p className="text-xs text-gray-400">{formatChatTime(chat.lastMessageTime)}</p>
                    )}
                    <button
                      onClick={() => removePersonalChat(chat.id)}
                      className="text-xs px-2.5 py-1 border border-red-200 text-red-400 rounded-lg hover:bg-red-50 transition"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
