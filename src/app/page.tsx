// app/page.tsx
"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileGuard } from "@/hooks/useProfileGuard";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  doc,
  getDoc,
  where,
  Timestamp,
} from "firebase/firestore";

// ── 型定義 ─────────────────────────────────────────────────
type OffkaiEvent = {
  id: string;
  title: string;
  date: string;
  createdAt?: Timestamp;
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
  targetOshi?: string;
  oshi?: string;
  oshis?: string[];
};

type Notice = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  pinned?: boolean;
  createdAt: Timestamp | null;
};

// ── 定数 ───────────────────────────────────────────────────
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
  other: "bg-gray-300",
};

// ── ユーティリティ ──────────────────────────────────────────
function getDetailLink(e: OffkaiEvent): string {
  switch (e.genre) {
    case "shop": return `/events/${e.id}/shop`;
    case "karaoke": return `/events/${e.id}/karaoke`;
    case "food": return `/events/${e.id}/food`;
    default: return `/events/${e.id}`;
  }
}

function getLocalDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function scoreEvent(e: OffkaiEvent, oshi: string, prefecture: string): number {
  let score = 0;
  if (oshi) {
    const targets = [e.targetOshi, e.oshi, ...(e.oshis ?? [])].filter(Boolean).join(" ").toLowerCase();
    if (targets.includes(oshi.toLowerCase())) score += 30;
  }
  if (prefecture && (e.prefectures ?? []).includes(prefecture)) score += 20;
  const diffDays = (new Date(`${e.date}T00:00`).getTime() - Date.now()) / 86400000;
  if (diffDays >= 0 && diffDays <= 7) score += 15;
  else if (diffDays <= 30) score += 10;
  else if (diffDays <= 90) score += 5;
  return score;
}

function formatNoticeDate(ts: Timestamp | null): string {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

// ── EventCard（モジュールレベル） ───────────────────────────
function EventCard({ e }: { e: OffkaiEvent }) {
  const people = e.participants?.length ?? 0;
  const cap = typeof e.capacity === "number" ? e.capacity : null;
  const place = e.prefectures?.length ? e.prefectures.join(", ") : (e.prefecture || "未設定");
  const timeRange = e.timeStart ? `${e.timeStart}${e.timeEnd ? ` – ${e.timeEnd}` : ""}` : "";
  const genre = e.genre ? GENRE_LABELS[e.genre] ?? e.genre : null;
  const genreColor = e.genre ? (GENRE_COLORS[e.genre] ?? "bg-gray-100 text-gray-600") : null;
  const stripe = e.genre ? (GENRE_STRIPE[e.genre] ?? "bg-gray-300") : "bg-gray-300";
  const isFull = cap !== null && people >= cap;

  return (
    <Link href={getDetailLink(e)} className="block group h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 h-full flex flex-col overflow-hidden">
        <div className={`h-1.5 w-full ${stripe}`} />
        <div className="p-5 flex flex-col flex-1">
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
              <span>📅</span>
              <span className="font-medium text-gray-700">{e.date}</span>
              {timeRange && <span className="text-xs text-gray-400">{timeRange}</span>}
            </p>
            <p className="flex items-center gap-1.5">
              <span>📍</span>
              <span>{place}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span>👥</span>
              <span>
                {people} / {cap !== null ? `${cap} 人` : "–"}
                {isFull && <span className="ml-1 text-xs text-red-500 font-semibold">満員</span>}
              </span>
            </p>
            {e.creatorName && (
              <p className="text-xs text-gray-400">作成者: {e.creatorName}</p>
            )}
          </div>
          <div className={`w-full py-3 rounded-xl text-sm font-bold text-center transition-all ${
            isFull
              ? "bg-gray-100 text-gray-400"
              : "bg-orange-500 text-white group-hover:bg-orange-600"
          }`}>
            {isFull ? "満員" : "詳細を見る →"}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── メインページ ────────────────────────────────────────────
export default function HomePage() {
  useProfileGuard();
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [searchTerm, setSearchTerm] = useState("");
  const [allEvents, setAllEvents] = useState<OffkaiEvent[]>([]);
  const [latestEvents, setLatestEvents] = useState<OffkaiEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [userOshi, setUserOshi] = useState("");
  const [userPrefecture, setUserPrefecture] = useState("");
  const [loading, setLoading] = useState(true);

  // 認証状態
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  // ユーザープロフィール（おすすめ用）
  useEffect(() => {
    if (!authUser) { setUserOshi(""); setUserPrefecture(""); return; }
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", authUser.uid));
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          setUserOshi((d.oshi as string) || "");
          setUserPrefecture((d.prefecture as string) || "");
        }
      } catch { /* noop */ }
    };
    fetchProfile();
  }, [authUser]);

  // イベント・お知らせ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = getLocalDateStr();

        // 並列取得
        const [futureSnap, latestSnap, noticeSnap] = await Promise.all([
          getDocs(query(collection(db, "events"), orderBy("date", "asc"))),
          getDocs(query(collection(db, "events"), orderBy("createdAt", "desc"), limit(6))),
          getDocs(query(
            collection(db, "notices"),
            where("published", "==", true),
            orderBy("createdAt", "desc"),
            limit(5)
          )),
        ]);

        // 今日以降のイベント
        const futureRaw = futureSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<OffkaiEvent, "id">) }))
          .filter((e) => !e.isHidden && e.date >= today);

        // 新着（作成日順）
        const latestRaw = latestSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<OffkaiEvent, "id">) }))
          .filter((e) => !e.isHidden && e.date >= today);

        // 作成者名を並列解決（重複排除）
        const allRaw = [...futureRaw, ...latestRaw];
        const uniqueUids = [...new Set(
          allRaw.map((e) => e.createdBy).filter((id): id is string => Boolean(id))
        )];
        const creatorMap = new Map<string, string>();
        await Promise.all(uniqueUids.map(async (uid) => {
          try {
            const usnap = await getDoc(doc(db, "users", uid));
            if (usnap.exists()) {
              const u = usnap.data() as Record<string, unknown>;
              creatorMap.set(uid, (u.name ?? u.displayName ?? "不明") as string);
            }
          } catch { /* noop */ }
        }));

        const withCreator = (e: OffkaiEvent) => ({
          ...e,
          creatorName: e.createdBy ? (creatorMap.get(e.createdBy) ?? "不明") : "不明",
        });

        setAllEvents(futureRaw.map(withCreator));
        setLatestEvents(latestRaw.map(withCreator));

        // お知らせ（ピン留め優先）
        const noticeList = noticeSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Notice, "id">),
        }));
        noticeList.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });
        setNotices(noticeList.slice(0, 3));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // おすすめスコアリング
  const recommendedEvents = useMemo(() => {
    if (allEvents.length === 0) return [];
    const uid = authUser?.uid;
    const scored = allEvents
      .filter((e) => {
        if (!uid) return true;
        const isCreated = e.createdBy === uid;
        const isJoined = e.participants?.some((p) => p.uid === uid) ?? false;
        return !isCreated && !isJoined;
      })
      .map((e) => ({ e, score: scoreEvent(e, userOshi, userPrefecture) }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 6).map((x) => x.e);
  }, [allEvents, authUser, userOshi, userPrefecture]);

  const handleSearch = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!searchTerm.trim()) { router.push("/events"); return; }
    router.push(`/events?search=${encodeURIComponent(searchTerm.trim())}`);
  };

  // おすすめセクションのサブタイトル
  const recommendSubtitle = useMemo(() => {
    if (!authUser) return "新着のオフ会をピックアップ";
    const parts: string[] = [];
    if (userOshi) parts.push(userOshi);
    if (userPrefecture) parts.push(userPrefecture);
    return parts.length > 0 ? `${parts.join(" · ")} などを基にピックアップ` : "あなた向けにピックアップ";
  }, [authUser, userOshi, userPrefecture]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            1. ヒーローセクション
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-6 py-20 sm:py-28 text-center">
          {/* 装飾ブロブ */}
          <div className="absolute top-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-[500px] h-48 bg-indigo-300/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">
              Hololive Fan Meetup Platform
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              推し活オフ会を<br />もっと楽しく
            </h1>
            <p className="text-white/75 mb-10 text-base sm:text-lg max-w-sm mx-auto leading-relaxed">
              同じ推しの仲間を見つけて、<br className="hidden sm:block" />一緒にオフ会を楽しもう
            </p>

            {/* 検索バー */}
            <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mx-auto mb-8">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="イベント名・場所で検索..."
                  className="w-full pl-10 pr-4 py-4 rounded-2xl border-0 shadow-xl focus:outline-none focus:ring-2 focus:ring-white/60 text-gray-800 bg-white text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-4 bg-white text-blue-700 rounded-2xl font-bold shadow-xl hover:bg-blue-50 transition text-sm shrink-0"
              >
                検索
              </button>
            </form>

            {/* CTAボタン */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/events">
                <button className="w-full sm:w-auto px-10 py-4 bg-white text-blue-700 rounded-2xl font-bold hover:bg-blue-50 hover:shadow-2xl hover:-translate-y-0.5 transition-all shadow-xl text-base">
                  オフ会を探す →
                </button>
              </Link>
              <Link href="/events/create">
                <button className="w-full sm:w-auto px-8 py-4 bg-white/15 text-white border border-white/30 rounded-2xl font-semibold hover:bg-white/25 transition text-sm backdrop-blur-sm">
                  ＋ イベントを作る
                </button>
              </Link>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 py-10 space-y-16">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              2. お知らせ
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {notices.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                  <span className="text-lg">📢</span> お知らせ
                </h2>
                <Link href="/admin/notice" className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition">
                  すべて見る →
                </Link>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {notices.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50/60 transition">
                    {n.pinned && (
                      <span className="mt-0.5 shrink-0 text-xs font-bold px-2 py-0.5 bg-red-50 text-red-500 rounded-full">
                        重要
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.body}</p>
                      )}
                    </div>
                    {n.createdAt && (
                      <time className="text-xs text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">
                        {formatNoticeDate(n.createdAt)}
                      </time>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              3. おすすめオフ会
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">✨ おすすめのオフ会</h2>
                <p className="text-sm text-gray-400 mt-0.5">{recommendSubtitle}</p>
              </div>
              <Link href="/events" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition whitespace-nowrap">
                すべて見る →
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : recommendedEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <p className="text-3xl mb-3">🎉</p>
                <p className="text-gray-700 font-semibold mb-1">まだイベントがありません</p>
                <p className="text-gray-400 text-sm mb-6">あなたが最初のオフ会を作ってみよう！</p>
                <Link href="/events/create">
                  <button className="px-6 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-sm">
                    ＋ 最初のイベントを作る
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recommendedEvents.map((e) => <EventCard key={e.id} e={e} />)}
              </div>
            )}
          </section>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              4. 新着オフ会
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">🆕 新着のオフ会</h2>
                <p className="text-sm text-gray-400 mt-0.5">最近作成されたイベント</p>
              </div>
              <Link href="/events" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition whitespace-nowrap">
                すべて見る →
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : latestEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <p className="text-3xl mb-3">✨</p>
                <p className="text-gray-700 font-semibold mb-1">新着イベントはまだありません</p>
                <p className="text-gray-400 text-sm">第一号のオフ会を立ち上げよう！</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {latestEvents.map((e) => <EventCard key={e.id} e={e} />)}
              </div>
            )}
          </section>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              5. CTAセクション
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section>
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 rounded-3xl px-8 py-12 text-center text-white">
              <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full blur-2xl translate-x-1/4 -translate-y-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-300/20 rounded-full blur-2xl -translate-x-1/4 translate-y-1/4 pointer-events-none" />
              <div className="relative z-10">
                <p className="text-3xl mb-4">🎊</p>
                <h3 className="text-2xl font-extrabold mb-2">あなたもオフ会を開こう</h3>
                <p className="text-white/80 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                  好きな推しを持つ仲間を集めて、最高の思い出を作ろう。<br />
                  イベント作成は無料・かんたん！
                </p>
                <Link href="/events/create">
                  <button className="inline-flex items-center gap-2 px-10 py-4 bg-white text-orange-600 rounded-2xl font-bold hover:shadow-2xl hover:-translate-y-0.5 transition-all shadow-lg text-base">
                    ＋ イベントを作成する
                  </button>
                </Link>
              </div>
            </div>
          </section>

        </div>{/* /max-w-6xl */}
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
