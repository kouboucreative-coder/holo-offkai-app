// app/events/[id]/karaoke/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type KaraokeEvent = {
  id: string;
  title: string;
  date: string;
  timeStart?: string;
  timeEnd?: string;
  description?: string;
  capacity?: number;
  karaokeShop?: string;
  address?: string;
  prefecture?: string;
  payment?: string;
  amount?: string | null;
  createdBy?: string;
  createdByName?: string;
  participants?: { uid: string; name: string }[];
};

export default function KaraokeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = auth.currentUser;
  const [event, setEvent] = useState<KaraokeEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = async () => {
    if (!id) return;
    try {
      const ref = doc(db, "events", id as string);
      const snap = await getDoc(ref);
      if (snap.exists()) setEvent({ id: snap.id, ...snap.data() } as KaraokeEvent);
    } catch (err) {
      console.error("Error fetching karaoke event:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvent(); }, [id]);

  const joinEvent = async () => {
    if (!user || !id) return alert("ログインしてください");
    try {
      await updateDoc(doc(db, "events", id as string), {
        participants: arrayUnion({ uid: user.uid, name: user.displayName || "名無し" }),
      });
      fetchEvent();
    } catch (err) { console.error(err); }
  };

  const leaveEvent = async () => {
    if (!user || !id) return;
    try {
      await updateDoc(doc(db, "events", id as string), {
        participants: arrayRemove({ uid: user.uid, name: user.displayName || "名無し" }),
      });
      fetchEvent();
    } catch (err) { console.error(err); }
  };

  const deleteEvent = async () => {
    if (!user || !id || !event || event.createdBy !== user.uid) return;
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "events", id as string));
      alert("イベントを削除しました");
      router.push("/events");
    } catch (err) { console.error(err); }
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
      <p className="text-center mt-20 text-gray-500">イベントが見つかりません。</p>
    </div>
  );

  const isOwner = user && event.createdBy === user.uid;
  const isParticipant = user && event.participants?.some((p) => p.uid === user.uid);
  const isFull = typeof event.capacity === "number" && (event.participants?.length ?? 0) >= event.capacity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          ← イベント一覧に戻る
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            カラオケ
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-5">{event.title}</h1>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">日付</p>
              <p className="text-sm font-semibold text-gray-800">{event.date}</p>
            </div>
            {(event.timeStart || event.timeEnd) && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">時間</p>
                <p className="text-sm font-semibold text-gray-800">
                  {event.timeStart ?? ""}{event.timeEnd ? ` – ${event.timeEnd}` : ""}
                </p>
              </div>
            )}
            {typeof event.capacity === "number" && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">参加人数</p>
                <p className="text-sm font-semibold text-gray-800">
                  {event.participants?.length ?? 0} / {event.capacity} 人
                </p>
              </div>
            )}
            {event.payment && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">支払い方法</p>
                <p className="text-sm font-semibold text-gray-800">
                  {event.payment === "self" ? "自腹" : "割り勘"}
                  {event.payment === "split" && event.amount ? `（${event.amount}円）` : ""}
                </p>
              </div>
            )}
          </div>

          {event.karaokeShop && <p className="text-sm text-gray-600 mb-2">🎤 {event.karaokeShop}</p>}
          {event.address && <p className="text-sm text-gray-600 mb-2">📍 {event.address}</p>}
          {event.prefecture && <p className="text-sm text-gray-600 mb-2">🗾 {event.prefecture}</p>}
          {event.description && (
            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{event.description}</p>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              作成者:{" "}
              {event.createdBy ? (
                <Link href={`/profile/${event.createdBy}`} className="text-blue-600 hover:underline">
                  {event.createdByName || "不明"}
                </Link>
              ) : "不明"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          {!isOwner ? (
            !isParticipant ? (
              <button
                onClick={joinEvent}
                disabled={isFull}
                className="w-full py-3.5 bg-orange-500 text-white rounded-xl font-bold text-base hover:bg-orange-600 hover:-translate-y-0.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFull ? "満員です" : "このイベントに参加する"}
              </button>
            ) : (
              <button
                onClick={leaveEvent}
                className="w-full py-3 border border-red-300 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition"
              >
                参加を取り消す
              </button>
            )
          ) : (
            <div className="flex gap-3">
              <Link href={`/events/${event.id}/edit/karaoke`} className="flex-1">
                <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all">
                  編集する
                </button>
              </Link>
              <button
                onClick={deleteEvent}
                className="flex-1 py-3 border border-red-300 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition"
              >
                削除する
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href={`/events/${event.id}/report`} className="text-xs text-gray-400 hover:text-red-500 transition">
            🚨 このイベントを通報する
          </Link>
        </div>
      </main>
    </div>
  );
}
