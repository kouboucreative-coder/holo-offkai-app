// app/page.tsx
"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

type OffkaiEvent = {
  id: string;
  title: string;
  date: string;
  description?: string;
  createdAt?: any;
  timeStart?: string;
  timeEnd?: string;
  prefecture?: string;
  prefectures?: string[];
  capacity?: number;
  participants?: { uid: string; name: string }[];
  createdBy?: string;
  creatorName?: string;
  genre?: string;
  isHidden?: boolean;
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

export default function HomePage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendedEvents, setRecommendedEvents] = useState<OffkaiEvent[]>([]);
  const [latestEvents, setLatestEvents] = useState<OffkaiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const getDetailLink = (e: OffkaiEvent) => {
    switch (e.genre) {
      case "shop": return `/events/${e.id}/shop`;
      case "karaoke": return `/events/${e.id}/karaoke`;
      case "food": return `/events/${e.id}/food`;
      default: return `/events/${e.id}`;
    }
  };

  const resolveCreators = async (events: OffkaiEvent[]) => {
    return Promise.all(
      events.map(async (e) => {
        let creatorName = "不明";
        if (e.createdBy) {
          try {
            const usnap = await getDoc(doc(db, "users", e.createdBy));
            if (usnap.exists()) {
              const u = usnap.data() as any;
              creatorName = u.name ?? u.displayName ?? "不明";
            }
          } catch { /* noop */ }
        }
        return { ...e, creatorName } as OffkaiEvent;
      })
    );
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsRef = collection(db, "events");
        const [recSnap, latSnap] = await Promise.all([
          getDocs(query(eventsRef, orderBy("createdAt", "desc"), limit(4))),
          getDocs(query(eventsRef, orderBy("createdAt", "desc"), limit(6))),
        ]);
        const recRaw = recSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as OffkaiEvent))
          .filter((e) => !e.isHidden);
        const latRaw = latSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as OffkaiEvent))
          .filter((e) => !e.isHidden);
        const [rec, lat] = await Promise.all([resolveCreators(recRaw), resolveCreators(latRaw)]);
        setRecommendedEvents(rec);
        setLatestEvents(lat);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`/events?search=${encodeURIComponent(searchTerm)}`);
  };

  const EventCard = ({ e }: { e: OffkaiEvent }) => {
    const people = e.participants?.length ?? 0;
    const cap = e.capacity ?? "–";
    const place = e.prefectures?.length ? e.prefectures.join(", ") : (e.prefecture || "未設定");
    const timeRange = e.timeStart ? `${e.timeStart}${e.timeEnd ? ` – ${e.timeEnd}` : ""}` : "";
    const genre = e.genre ? GENRE_LABELS[e.genre] ?? e.genre : null;
    const genreColor = e.genre ? (GENRE_COLORS[e.genre] ?? "bg-gray-100 text-gray-600") : null;
    const isFull = typeof e.capacity === "number" && people >= e.capacity;

    return (
      <Link href={getDetailLink(e)} className="block group h-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
          {genre && genreColor && (
            <span className={`text-xs font-semibold px-2.5 py-1 ${genreColor} rounded-full self-start mb-3`}>
              {genre}
            </span>
          )}
          <h3 className="text-base font-bold text-gray-900 mb-3 line-clamp-2 flex-1 leading-snug">
            {e.title}
          </h3>
          <div className="space-y-1.5 text-sm text-gray-500 mb-4">
            <p className="flex items-center gap-1.5">
              <span className="text-base">📅</span>
              <span>{e.date}{timeRange ? `　${timeRange}` : ""}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-base">📍</span>
              <span>{place}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-base">👥</span>
              <span>{people} / {cap} 人
                {isFull && <span className="ml-1 text-xs text-red-500 font-semibold">（満員）</span>}
              </span>
            </p>
          </div>
          <div className={`w-full py-2.5 rounded-xl text-sm font-bold text-center transition-all ${
            isFull
              ? "bg-gray-100 text-gray-400"
              : "bg-orange-500 text-white group-hover:bg-orange-600"
          }`}>
            {isFull ? "満員" : "詳細を見る →"}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* ===== Hero ===== */}
        <section className="relative overflow-hidden rounded-3xl mb-14 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-6 py-20 text-center">
          {/* 装飾ブロブ */}
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-96 h-40 bg-indigo-300/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="relative z-10">
            <p className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-3">
              Hololive Fan Meetup
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
              推し活オフ会を<br />もっと楽しく
            </h1>
            <p className="text-white/80 mb-10 text-lg max-w-md mx-auto">
              仲間とオフ会を探して、作って、楽しもう！
            </p>

            <form onSubmit={handleSearch} className="flex justify-center gap-2 max-w-lg mx-auto mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="イベントを検索..."
                className="flex-1 px-5 py-3.5 rounded-2xl border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-800 bg-white text-sm"
              />
              <button
                type="submit"
                className="px-6 py-3.5 bg-white text-blue-700 rounded-2xl font-bold shadow-lg hover:bg-blue-50 transition text-sm"
              >
                検索
              </button>
            </form>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href="/events/create">
                <button className="px-8 py-3.5 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-400 hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-lg text-sm">
                  ＋ イベントを作成する
                </button>
              </Link>
              <Link href="/events">
                <button className="px-8 py-3.5 bg-white/15 text-white border border-white/30 rounded-2xl font-semibold hover:bg-white/25 transition text-sm backdrop-blur-sm">
                  イベント一覧を見る →
                </button>
              </Link>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="text-center text-gray-400 py-12">読み込み中...</p>
        ) : (
          <>
            {/* ===== おすすめ ===== */}
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">おすすめのオフ会</h2>
                  <p className="text-sm text-gray-400 mt-0.5">最近追加された注目イベント</p>
                </div>
                <Link href="/events" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                  すべて見る →
                </Link>
              </div>
              {recommendedEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <p className="text-gray-400 text-sm">イベントはまだありません。</p>
                  <Link href="/events/create" className="mt-4 inline-block">
                    <button className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition mt-3">
                      最初のイベントを作る
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                  {recommendedEvents.map((e) => (
                    <div key={e.id} className="min-w-[280px] max-w-[280px] snap-start">
                      <EventCard e={e} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ===== 新着 ===== */}
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">新着のオフ会</h2>
                  <p className="text-sm text-gray-400 mt-0.5">みんなが作ったイベント</p>
                </div>
                <Link href="/events" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
                  すべて見る →
                </Link>
              </div>
              {latestEvents.length === 0 ? (
                <p className="text-gray-400 text-sm">イベントはまだありません。</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {latestEvents.map((e) => (
                    <EventCard key={e.id} e={e} />
                  ))}
                </div>
              )}
            </section>

            {/* ===== CTA バナー ===== */}
            <section className="mb-8">
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-8 text-white text-center">
                <h3 className="text-xl font-bold mb-2">あなたもオフ会を開こう</h3>
                <p className="text-white/80 text-sm mb-5">好きな推しを持つ仲間を集めて、最高の思い出を作ろう</p>
                <Link href="/events/create">
                  <button className="px-8 py-3 bg-white text-orange-600 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
                    ＋ イベントを作成する
                  </button>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-gray-100 bg-white py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            OffKai
          </span>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-800 transition">利用規約</Link>
            <Link href="/privacy" className="hover:text-gray-800 transition">プライバシーポリシー</Link>
          </div>
          <p className="text-xs text-gray-400">© 2025 OffKai App</p>
        </div>
      </footer>
    </div>
  );
}
