// app/mypage/page.tsx
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { useProfileGuard } from "@/hooks/useProfileGuard";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query } from "firebase/firestore";
import { getMemberEmoji } from "@/lib/hololiveMembers";

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

type UserData = {
  name?: string;
  email?: string;
  prefecture?: string;
  oshi?: string;
  bio?: string;
  photoURL?: string;
  x?: string;
  youtube?: string;
  instagram?: string;
  tiktok?: string;
  blog?: string;
  other?: string;
};

type Event = {
  id: string;
  title: string;
  date: string;
  timeStart?: string;
  timeEnd?: string;
  capacity?: number;
  participants?: { uid: string; name: string }[];
  createdBy?: string;
  genre?: string;
  prefectures?: string[];
};

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

const GENRE_STRIPE: Record<string, string> = {
  shop: "bg-pink-400",
  karaoke: "bg-indigo-400",
  food: "bg-green-400",
  social: "bg-orange-400",
  viewing: "bg-rose-400",
  "small-hall": "bg-sky-400",
  "large-hall": "bg-purple-400",
  "goods-exchange": "bg-amber-400",
};

function getDetailLink(e: Event): string {
  switch (e.genre) {
    case "shop": return `/events/${e.id}/shop`;
    case "karaoke": return `/events/${e.id}/karaoke`;
    case "food": return `/events/${e.id}/food`;
    default: return `/events/${e.id}`;
  }
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

// ── EventCard（モジュールレベル）────────────────────────
function EventCard({ event }: { event: Event }) {
  const genre = event.genre ? GENRE_LABELS[event.genre] ?? event.genre : null;
  const genreColor = event.genre ? (GENRE_COLORS[event.genre] ?? "bg-gray-100 text-gray-600") : null;
  const stripe = event.genre ? (GENRE_STRIPE[event.genre] ?? "bg-blue-400") : "bg-blue-400";
  const timeRange = event.timeStart
    ? `${event.timeStart}${event.timeEnd ? ` – ${event.timeEnd}` : ""}`
    : "";
  const place = event.prefectures?.length ? event.prefectures.join(", ") : "未設定";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className={`h-1 w-full ${stripe}`} />
      <div className="p-4 flex flex-col gap-2 flex-1">
        {genre && genreColor && (
          <span className={`text-xs font-semibold px-2.5 py-1 ${genreColor} rounded-full self-start`}>
            {genre}
          </span>
        )}
        <h3 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug">{event.title}</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>📅 {event.date}{timeRange ? `　${timeRange}` : ""}</p>
          <p>📍 {place}</p>
          <p>👥 {event.participants?.length ?? 0} / {event.capacity ?? "–"} 人</p>
        </div>
        <Link href={getDetailLink(event)} className="block mt-auto pt-2">
          <div className="w-full py-2 bg-orange-500 text-white rounded-xl text-sm font-bold text-center hover:bg-orange-600 transition">
            詳細を見る →
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Section（モジュールレベル）──────────────────────────
function Section({
  title, events, empty, count,
}: {
  title: string;
  events: Event[];
  empty: string;
  count: number;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{count}</span>
      </div>
      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">{empty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </section>
  );
}

// ── メインページ ─────────────────────────────────────
export default function MyPage() {
  useProfileGuard();
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unSub();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!authUser) {
        setUserData(null);
        setCreatedEvents([]);
        setJoinedEvents([]);
        setPastEvents([]);
        setLoading(false);
        return;
      }
      try {
        const [userSnap, eventsSnap] = await Promise.all([
          getDoc(doc(db, "users", authUser.uid)),
          getDocs(query(collection(db, "events"))),
        ]);

        setUserData((userSnap.exists() ? userSnap.data() : {}) as UserData);

        const todayLocal = getLocalDateStr();
        const events = eventsSnap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })
        ) as Event[];

        setCreatedEvents(
          events.filter((e) => e.createdBy === authUser.uid && (e.date ?? "") >= todayLocal)
        );
        setJoinedEvents(
          events.filter(
            (e) =>
              e.createdBy !== authUser.uid &&
              e.participants?.some((p) => p.uid === authUser.uid) &&
              (e.date ?? "") >= todayLocal
          )
        );
        setPastEvents(events.filter((e) => (e.date ?? "") < todayLocal));
      } catch (e) {
        console.error("Failed to load mypage:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [authUser]);

  const displayName = userData?.name || authUser?.displayName || "名無し";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : !authUser ? (
          <p className="mt-20 text-center text-gray-500">ログインしてください。</p>
        ) : (
          <>
            {/* プロフィールカード */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-start gap-5 flex-wrap">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md shrink-0 border border-gray-100">
                  {userData?.photoURL ? (
                    <Image
                      src={userData.photoURL}
                      alt={displayName}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {getInitials(displayName)}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                      <p className="text-sm text-gray-400 mt-0.5">{userData?.email || authUser.email}</p>
                    </div>
                    <Link href="/profile/edit">
                      <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all">
                        編集
                      </button>
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {userData?.prefecture && (
                      <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full">
                        📍 {userData.prefecture}
                      </span>
                    )}
                    {userData?.oshi && (
                      <span className="text-xs px-3 py-1.5 bg-pink-50 text-pink-600 rounded-full">
                        {getMemberEmoji(userData.oshi)} {userData.oshi}
                      </span>
                    )}
                  </div>

                  {userData?.bio && (
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{userData.bio}</p>
                  )}

                  {(userData?.x || userData?.youtube || userData?.instagram || userData?.tiktok || userData?.blog || userData?.other) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {userData?.x && <a href={userData.x} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">X</a>}
                      {userData?.youtube && <a href={userData.youtube} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">YouTube</a>}
                      {userData?.instagram && <a href={userData.instagram} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">Instagram</a>}
                      {userData?.tiktok && <a href={userData.tiktok} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">TikTok</a>}
                      {userData?.blog && <a href={userData.blog} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">ブログ</a>}
                      {userData?.other && <a href={userData.other} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition">その他</a>}
                    </div>
                  )}
                </div>
              </div>

              {/* 活動統計 */}
              <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {createdEvents.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">作成中</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                    {joinedEvents.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">参加中</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-400">
                    {pastEvents.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">終了済み</p>
                </div>
              </div>
            </div>

            <Section
              title="作成したイベント"
              events={createdEvents}
              empty="まだ作成したイベントはありません。"
              count={createdEvents.length}
            />
            <Section
              title="参加しているイベント"
              events={joinedEvents}
              empty="まだ参加しているイベントはありません。"
              count={joinedEvents.length}
            />
            <Section
              title="終了したイベント"
              events={pastEvents}
              empty="終了したイベントはありません。"
              count={pastEvents.length}
            />
          </>
        )}
      </main>
    </div>
  );
}
