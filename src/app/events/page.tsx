// app/events/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useProfileGuard } from "@/hooks/useProfileGuard";
import { db, auth } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function toLocalDate(dateStr?: string, timeStr?: string) {
  if (!dateStr) return null;
  const time = (timeStr ?? "23:59").trim();
  const dt = new Date(`${dateStr}T${time}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

const GENRE_LABELS: Record<string, string> = {
  shop: "ショップ巡り",
  karaoke: "カラオケ",
  food: "飲食",
  social: "交流会",
  viewing: "観賞会",
  "small-hall": "小規模会場",
  "large-hall": "大規模会場",
  "goods-exchange": "グッズ交換",
  other: "その他",
};

const GENRE_COLORS: Record<string, string> = {
  shop: "bg-pink-50 text-pink-600",
  karaoke: "bg-indigo-50 text-indigo-600",
  food: "bg-green-50 text-green-600",
  social: "bg-orange-50 text-orange-600",
  viewing: "bg-rose-50 text-rose-600",
  "small-hall": "bg-sky-50 text-sky-600",
  "large-hall": "bg-purple-50 text-purple-600",
  "goods-exchange": "bg-amber-50 text-amber-600",
  other: "bg-gray-100 text-gray-600",
};

type Participant = { uid: string; name?: string } | string;

type Event = {
  id: string;
  title: string;
  date: string;
  timeStart?: string;
  timeEnd?: string;
  capacity?: number;
  participants?: Participant[];
  createdBy?: string;
  prefectures?: string[];
  genre?: string;
  creatorName?: string;
};

function EventsContent() {
  useProfileGuard();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [finishingId, setFinishingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsRef = collection(db, "events");
        const qy = query(eventsRef, orderBy("date", "asc"));
        const snapshot = await getDocs(qy);
        const raw = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const todayLocal = getLocalDateStr();
        const future = raw.filter((e) => (e.date ?? "") >= todayLocal);
        const withCreator = await Promise.all(
          future.map(async (e) => {
            let creatorName = "不明";
            if (e.createdBy) {
              try {
                const usnap = await getDoc(doc(db, "users", e.createdBy as string));
                if (usnap.exists()) {
                  const u = usnap.data() as any;
                  creatorName = u.name ?? u.displayName ?? "不明";
                }
              } catch { /* noop */ }
            }
            return { ...e, creatorName } as Event;
          })
        );
        setEvents(withCreator);
      } catch (err) {
        console.error("Error fetching events:", err);
      }
    };
    fetchEvents();
  }, []);

  const getDetailLink = (event: Event) => {
    switch (event.genre) {
      case "shop": return `/events/${event.id}/shop`;
      case "karaoke": return `/events/${event.id}/karaoke`;
      case "food": return `/events/${event.id}/food`;
      default: return `/events/${event.id}`;
    }
  };

  const filteredEvents = useMemo(() => {
    const q = (searchTerm || "").toLowerCase();
    return events.filter((event) => {
      const prefText = (event.prefectures ?? []).join(",").toLowerCase();
      return (event.title ?? "").toLowerCase().includes(q) || prefText.includes(q);
    });
  }, [events, searchTerm]);

  const createdEvents = useMemo(
    () => filteredEvents.filter((e) => e.createdBy === authUser?.uid),
    [filteredEvents, authUser]
  );
  const joinedEvents = useMemo(
    () => filteredEvents.filter(
      (e) =>
        e.createdBy !== authUser?.uid &&
        e.participants?.some((p: Participant) => (typeof p === "string" ? p : p.uid) === authUser?.uid)
    ),
    [filteredEvents, authUser]
  );
  const otherEvents = useMemo(
    () => filteredEvents.filter(
      (e) =>
        e.createdBy !== authUser?.uid &&
        !e.participants?.some((p: Participant) => (typeof p === "string" ? p : p.uid) === authUser?.uid)
    ),
    [filteredEvents, authUser]
  );

  const isEventOver = (e: Event) => {
    const end = toLocalDate(e.date, e.timeEnd ?? "23:59");
    if (!end) return false;
    return end.getTime() < Date.now();
  };

  async function sendSurveyAssignments(ev: Event) {
    const snap = await getDoc(doc(db, "events", ev.id));
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const rawParticipants: Participant[] = data.participants ?? [];
    const participantUids = rawParticipants.map((p) => (typeof p === "string" ? p : p.uid));
    const userIds = Array.from(new Set([data.createdBy, ...participantUids].filter(Boolean)));
    const assignCol = collection(db, "surveyAssignments");
    for (const uid of userIds) {
      await addDoc(assignCol, {
        userId: uid,
        eventId: ev.id,
        eventTitle: ev.title,
        type: "5scale",
        status: "pending",
        assignedAt: serverTimestamp(),
      });
    }
  }

  const finishEvent = async (ev: Event) => {
    if (!authUser) return alert("ログインしてください。");
    if (!ev.id) return;
    const ok = confirm(
      "このイベントを終了しますか？\n・イベントのチャットを削除\n・イベント情報を削除\n・5段階評価アンケートを配布"
    );
    if (!ok) return;
    try {
      setFinishingId(ev.id);
      const latest = await getDoc(doc(db, "events", ev.id));
      if (!latest.exists()) throw new Error("イベントが見つかりませんでした。");
      const eventData = latest.data() as any;
      await sendSurveyAssignments({ ...ev, ...eventData, id: ev.id });
      const batch = writeBatch(db);
      batch.delete(doc(db, "chats", ev.id));
      batch.delete(doc(db, "events", ev.id));
      await batch.commit();
      alert("イベントを終了しました。");
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } catch (e) {
      console.error(e);
      alert("終了処理に失敗しました。");
    } finally {
      setFinishingId(null);
    }
  };

  const EventCard = ({ event }: { event: Event }) => {
    const mine = event.createdBy === authUser?.uid;
    const over = isEventOver(event);
    const people = event.participants?.length ?? 0;
    const cap = typeof event.capacity === "number" ? event.capacity : null;
    const isFull = cap !== null && people >= cap;
    const place = event.prefectures?.length ? event.prefectures.join(", ") : "未設定";
    const timeRange = event.timeStart
      ? `${event.timeStart}${event.timeEnd ? ` – ${event.timeEnd}` : ""}`
      : "";
    const genre = event.genre ? GENRE_LABELS[event.genre] ?? event.genre : null;
    const genreColor = event.genre ? (GENRE_COLORS[event.genre] ?? "bg-gray-100 text-gray-600") : null;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden">
        {/* ジャンル色帯 */}
        <div className={`h-1.5 w-full ${
          event.genre === "shop" ? "bg-pink-400" :
          event.genre === "karaoke" ? "bg-indigo-400" :
          event.genre === "food" ? "bg-green-400" :
          event.genre === "social" ? "bg-orange-400" :
          event.genre === "viewing" ? "bg-rose-400" :
          event.genre === "small-hall" ? "bg-sky-400" :
          event.genre === "large-hall" ? "bg-purple-400" :
          event.genre === "goods-exchange" ? "bg-amber-400" :
          "bg-gray-300"
        }`} />

        <div className="p-5 flex flex-col flex-1">
          {genre && genreColor && (
            <span className={`text-xs font-semibold px-2.5 py-1 ${genreColor} rounded-full self-start mb-3`}>
              {genre}
            </span>
          )}
          <h3 className="text-base font-bold text-gray-900 mb-3 line-clamp-2 leading-snug">{event.title}</h3>

          <div className="space-y-1.5 text-sm text-gray-500 flex-1 mb-4">
            <p className="flex items-center gap-2">
              <span>📅</span>
              <span className="font-medium text-gray-700">{event.date ?? "日付未設定"}</span>
              {timeRange && <span className="text-xs text-gray-400">{timeRange}</span>}
            </p>
            <p className="flex items-center gap-2">
              <span>📍</span>
              <span>{place}</span>
            </p>
            <p className="flex items-center gap-2">
              <span>👥</span>
              <span>
                {people} / {cap !== null ? `${cap} 人` : "–"}
                {isFull && <span className="ml-1.5 text-xs font-bold text-red-500">満員</span>}
              </span>
            </p>
            <p className="text-xs text-gray-400">作成者: {event.creatorName ?? "不明"}</p>
          </div>

          {mine && over ? (
            <button
              onClick={() => finishEvent(event)}
              disabled={finishingId === event.id}
              className="w-full py-3.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {finishingId === event.id ? "終了処理中..." : "イベントを終了"}
            </button>
          ) : (
            <Link href={getDetailLink(event)} className="block">
              <div className={`w-full py-3.5 rounded-xl font-bold text-sm text-center transition-all ${
                isFull
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-orange-500 text-white hover:bg-orange-600 hover:-translate-y-0.5"
              }`}>
                {isFull ? "満員です" : "詳細を見る →"}
              </div>
            </Link>
          )}
        </div>
      </div>
    );
  };

  const Section = ({
    title, subtitle, items, emptyIcon, emptyMessage, emptyAction,
  }: {
    title: string; subtitle?: string; items: Event[];
    emptyIcon?: string; emptyMessage?: string; emptyAction?: React.ReactNode;
  }) => (
    <section className="mb-12">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          {emptyIcon && <p className="text-3xl mb-3">{emptyIcon}</p>}
          <p className="text-gray-500 text-sm font-medium">{emptyMessage ?? "イベントはありません。"}</p>
          {emptyAction && <div className="mt-5">{emptyAction}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">イベント一覧</h1>
            <p className="text-sm text-gray-400 mt-0.5">参加したいオフ会を見つけよう</p>
          </div>
          <Link href="/events/create">
            <button className="px-5 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 hover:-translate-y-0.5 transition-all shadow-sm min-h-[48px]">
              ＋ 作成
            </button>
          </Link>
        </div>

        {/* 検索バー */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-10">
          <p className="text-sm font-semibold text-gray-700 mb-3">🔍 イベントを探す</p>
          <div className="relative flex items-center">
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="タイトル・都道府県で検索..."
              className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
                aria-label="クリア"
              >
                ×
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2.5 text-xs text-gray-400">
              「{searchTerm}」の検索結果: <span className="font-semibold text-gray-600">{filteredEvents.length} 件</span>
            </p>
          )}
        </div>

        <Section
          title="自分が作成したイベント"
          subtitle="あなたが主催するイベント"
          items={createdEvents}
          emptyIcon="📋"
          emptyMessage="まだイベントを作っていません。最初のオフ会を開いてみよう！"
          emptyAction={
            <Link href="/events/create">
              <button className="px-6 py-3.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-sm">
                ＋ イベントを作る
              </button>
            </Link>
          }
        />
        <Section
          title="参加しているイベント"
          subtitle="参加登録済みのイベント"
          items={joinedEvents}
          emptyIcon="🤝"
          emptyMessage="まだ参加しているイベントはありません。気になるオフ会を探してみよう！"
        />
        <Section
          title="その他のイベント"
          subtitle="参加者を募集中のイベント"
          items={otherEvents}
          emptyIcon="🔍"
          emptyMessage="現在募集中のイベントはありません。あなたが最初のイベントを作ってみよう！"
          emptyAction={
            <Link href="/events/create">
              <button className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:shadow-md transition">
                ＋ イベントを作成する
              </button>
            </Link>
          }
        />
      </main>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
        <p className="text-center mt-20 text-gray-400">読み込み中...</p>
      </div>
    }>
      <EventsContent />
    </Suspense>
  );
}
