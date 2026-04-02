// app/events/page.tsx
"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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

// ── 日付ユーティリティ ────────────────────────────────────
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

// ── 定数 ────────────────────────────────────────────────
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

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  "オンライン",
];

// ── 型定義 ────────────────────────────────────────────
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
  description?: string;
  location?: string;
  targetOshi?: string;
  oshi?: string;
  oshis?: string[];
  joinOpen?: boolean;
};

type EventStatus = "open" | "full" | "stopped";
type DateFilter = "all" | "today" | "week" | "month";
type StatusFilter = "all" | EventStatus;
type MyEventsFilter = "all" | "created" | "joined" | "not-joined";

// ── ヘルパー関数（モジュールレベル） ─────────────────────
function getEventStatus(event: Event): EventStatus {
  if (event.joinOpen === false) return "stopped";
  const people = event.participants?.length ?? 0;
  const cap = typeof event.capacity === "number" ? event.capacity : null;
  if (cap !== null && people >= cap) return "full";
  return "open";
}

function getDetailLink(event: Event): string {
  switch (event.genre) {
    case "shop": return `/events/${event.id}/shop`;
    case "karaoke": return `/events/${event.id}/karaoke`;
    case "food": return `/events/${event.id}/food`;
    default: return `/events/${event.id}`;
  }
}

// ── EventCard（モジュールレベル） ──────────────────────
type EventCardProps = {
  event: Event;
  authUser: User | null;
  finishingId: string | null;
  onFinish: (ev: Event) => void;
};

function EventCard({ event, authUser, finishingId, onFinish }: EventCardProps) {
  const mine = event.createdBy === authUser?.uid;
  const over = (() => {
    const end = toLocalDate(event.date, event.timeEnd ?? "23:59");
    return end ? end.getTime() < Date.now() : false;
  })();
  const people = event.participants?.length ?? 0;
  const cap = typeof event.capacity === "number" ? event.capacity : null;
  const status = getEventStatus(event);
  const isFull = status === "full";
  const isStopped = status === "stopped";
  const place = event.prefectures?.length ? event.prefectures.join(", ") : "未設定";
  const timeRange = event.timeStart
    ? `${event.timeStart}${event.timeEnd ? ` – ${event.timeEnd}` : ""}`
    : "";
  const genre = event.genre ? GENRE_LABELS[event.genre] ?? event.genre : null;
  const genreColor = event.genre ? (GENRE_COLORS[event.genre] ?? "bg-gray-100 text-gray-600") : null;
  const stripe = event.genre ? (GENRE_STRIPE[event.genre] ?? "bg-gray-300") : "bg-gray-300";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden">
      <div className={`h-1.5 w-full ${stripe}`} />
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
              {isStopped && <span className="ml-1.5 text-xs font-bold text-gray-500">受付停止</span>}
            </span>
          </p>
          <p className="text-xs text-gray-400">作成者: {event.creatorName ?? "不明"}</p>
        </div>

        {mine && over ? (
          <button
            onClick={() => onFinish(event)}
            disabled={finishingId === event.id}
            className="w-full py-3.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 hover:-translate-y-0.5 transition-all disabled:opacity-60"
          >
            {finishingId === event.id ? "終了処理中..." : "イベントを終了"}
          </button>
        ) : (
          <Link href={getDetailLink(event)} className="block">
            <div className={`w-full py-3.5 rounded-xl font-bold text-sm text-center transition-all ${
              isFull || isStopped
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600 hover:-translate-y-0.5"
            }`}>
              {isFull ? "満員です" : isStopped ? "受付停止中" : "詳細を見る →"}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Section（モジュールレベル） ────────────────────────
type SectionProps = {
  title: string;
  subtitle?: string;
  items: Event[];
  emptyIcon?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  cardProps: Omit<EventCardProps, "event">;
};

function Section({ title, subtitle, items, emptyIcon, emptyMessage, emptyAction, cardProps }: SectionProps) {
  return (
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
          {items.map((e) => <EventCard key={e.id} event={e} {...cardProps} />)}
        </div>
      )}
    </section>
  );
}

// ── ピルボタン（モジュールレベル） ────────────────────────
function PillButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      {children}
    </button>
  );
}

// ── メインコンテンツ ────────────────────────────────────
function EventsContent() {
  useProfileGuard();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishingId, setFinishingId] = useState<string | null>(null);

  // フィルター状態
  const [keyword, setKeyword] = useState(initialSearch);
  const [prefecture, setPrefecture] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [oshiFilter, setOshiFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [myEventsFilter, setMyEventsFilter] = useState<MyEventsFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(query(collection(db, "events"), orderBy("date", "asc")));
        const raw = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })
        ) as (Record<string, unknown> & { id: string })[];

        const todayLocal = getLocalDateStr();
        const future = raw.filter(
          (e) => ((e.date as string | undefined) ?? "") >= todayLocal
        );

        // 重複を排除して作成者を並列取得（N+1 クエリ解消）
        const uniqueCreatorIds = [
          ...new Set(
            future
              .map((e) => e.createdBy as string | undefined)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        const creatorMap = new Map<string, string>();
        await Promise.all(
          uniqueCreatorIds.map(async (uid) => {
            try {
              const usnap = await getDoc(doc(db, "users", uid));
              if (usnap.exists()) {
                const u = usnap.data() as Record<string, unknown>;
                creatorMap.set(uid, (u.name ?? u.displayName ?? "不明") as string);
              }
            } catch { /* noop */ }
          })
        );

        setEvents(
          future.map((e) => ({
            ...e,
            creatorName: e.createdBy
              ? (creatorMap.get(e.createdBy as string) ?? "不明")
              : "不明",
          })) as Event[]
        );
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // ── フィルター判定 ─────────────────────────────────────
  const isFilterActive = useMemo(() => (
    keyword.trim() !== "" ||
    prefecture !== "" ||
    dateFilter !== "all" ||
    oshiFilter.trim() !== "" ||
    statusFilter !== "all" ||
    myEventsFilter !== "all"
  ), [keyword, prefecture, dateFilter, oshiFilter, statusFilter, myEventsFilter]);

  const activeFilterCount = useMemo(() => [
    keyword.trim() !== "",
    prefecture !== "",
    dateFilter !== "all",
    oshiFilter.trim() !== "",
    statusFilter !== "all",
    myEventsFilter !== "all",
  ].filter(Boolean).length, [keyword, prefecture, dateFilter, oshiFilter, statusFilter, myEventsFilter]);

  // ── 統合フィルター ─────────────────────────────────────
  const allFiltered = useMemo(() => {
    const today = getLocalDateStr();
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(now);
    monthEnd.setDate(monthEnd.getDate() + 30);

    return events.filter((event) => {
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const searchTargets = [
          event.title ?? "",
          event.description ?? "",
          event.location ?? "",
          event.creatorName ?? "",
          (event.prefectures ?? []).join(" "),
        ].join(" ").toLowerCase();
        if (!searchTargets.includes(q)) return false;
      }
      if (prefecture) {
        if (!(event.prefectures ?? []).some((p) => p === prefecture)) return false;
      }
      if (dateFilter !== "all") {
        const eDate = event.date;
        if (!eDate) return false;
        if (dateFilter === "today" && eDate !== today) return false;
        if (dateFilter === "week" && new Date(`${eDate}T00:00`) > weekEnd) return false;
        if (dateFilter === "month" && new Date(`${eDate}T00:00`) > monthEnd) return false;
      }
      if (oshiFilter.trim()) {
        const q = oshiFilter.trim().toLowerCase();
        const targets = [event.targetOshi ?? "", event.oshi ?? "", ...(event.oshis ?? [])].join(" ").toLowerCase();
        if (!targets.includes(q)) return false;
      }
      if (statusFilter !== "all" && getEventStatus(event) !== statusFilter) return false;
      if (myEventsFilter !== "all" && authUser) {
        const uid = authUser.uid;
        const isCreated = event.createdBy === uid;
        const isJoined = event.participants?.some(
          (p) => (typeof p === "string" ? p : p.uid) === uid
        ) ?? false;
        if (myEventsFilter === "created" && !isCreated) return false;
        if (myEventsFilter === "joined" && (isCreated || !isJoined)) return false;
        if (myEventsFilter === "not-joined" && (isCreated || isJoined)) return false;
      }
      return true;
    });
  }, [events, keyword, prefecture, dateFilter, oshiFilter, statusFilter, myEventsFilter, authUser]);

  // 3セクション用（フィルターなし時）
  const createdEvents = useMemo(
    () => events.filter((e) => e.createdBy === authUser?.uid),
    [events, authUser]
  );
  const joinedEvents = useMemo(
    () => events.filter(
      (e) =>
        e.createdBy !== authUser?.uid &&
        e.participants?.some((p: Participant) => (typeof p === "string" ? p : p.uid) === authUser?.uid)
    ),
    [events, authUser]
  );
  const otherEvents = useMemo(
    () => events.filter(
      (e) =>
        e.createdBy !== authUser?.uid &&
        !e.participants?.some((p: Participant) => (typeof p === "string" ? p : p.uid) === authUser?.uid)
    ),
    [events, authUser]
  );

  // アンケート配布
  const sendSurveyAssignments = useCallback(async (ev: Event) => {
    const snap = await getDoc(doc(db, "events", ev.id));
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const rawParticipants: Participant[] = (data.participants as Participant[]) ?? [];
    const participantUids = rawParticipants.map((p) => (typeof p === "string" ? p : p.uid));
    const userIds = Array.from(new Set([data.createdBy as string, ...participantUids].filter(Boolean)));
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
  }, []);

  const finishEvent = useCallback(async (ev: Event) => {
    if (!authUser) return alert("ログインしてください。");
    const ok = confirm(
      "このイベントを終了しますか？\n・イベントのチャットを削除\n・イベント情報を削除\n・5段階評価アンケートを配布"
    );
    if (!ok) return;
    try {
      setFinishingId(ev.id);
      const latest = await getDoc(doc(db, "events", ev.id));
      if (!latest.exists()) throw new Error("イベントが見つかりませんでした。");
      const eventData = latest.data() as Record<string, unknown>;
      await sendSurveyAssignments({ ...ev, ...eventData, id: ev.id } as Event);
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
  }, [authUser, sendSurveyAssignments]);

  const resetFilters = useCallback(() => {
    setKeyword("");
    setPrefecture("");
    setDateFilter("all");
    setOshiFilter("");
    setStatusFilter("all");
    setMyEventsFilter("all");
  }, []);

  // EventCard に渡す共通 props（メモ化して参照安定）
  const cardProps = useMemo<Omit<EventCardProps, "event">>(
    () => ({ authUser, finishingId, onFinish: finishEvent }),
    [authUser, finishingId, finishEvent]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6">
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

        {/* 検索・フィルターパネル */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
          {/* 検索バー行 */}
          <div className="p-4 flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="タイトル・説明・場所・作成者で検索..."
                className="w-full pl-9 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
              />
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                  aria-label="検索をクリア"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
              className={`relative flex items-center gap-1.5 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                filterOpen || activeFilterCount > 0
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span>⚙ フィルター</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="px-3 py-3 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 whitespace-nowrap"
              >
                リセット
              </button>
            )}
          </div>

          {/* 折りたたみフィルターパネル */}
          {filterOpen && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
              {/* 都道府県 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">📍 都道府県</span>
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">すべて</option>
                  {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 日程 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">📅 日程</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "all", label: "すべて" },
                    { key: "today", label: "今日" },
                    { key: "week", label: "今週（7日以内）" },
                    { key: "month", label: "今月（30日以内）" },
                  ] as { key: DateFilter; label: string }[]).map(({ key, label }) => (
                    <PillButton key={key} active={dateFilter === key} onClick={() => setDateFilter(key)}>
                      {label}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* 推し */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">⭐ 推し</span>
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    value={oshiFilter}
                    onChange={(e) => setOshiFilter(e.target.value)}
                    placeholder="推しの名前を入力..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  {oshiFilter && (
                    <button
                      onClick={() => setOshiFilter("")}
                      aria-label="推しフィルターをクリア"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* ステータス */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">🔖 状態</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "all", label: "すべて" },
                    { key: "open", label: "✅ 募集中" },
                    { key: "full", label: "🔴 満員" },
                    { key: "stopped", label: "⏸ 受付停止" },
                  ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
                    <PillButton key={key} active={statusFilter === key} onClick={() => setStatusFilter(key)}>
                      {label}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* マイイベント */}
              {authUser && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">👤 参加</span>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: "all", label: "すべて" },
                      { key: "created", label: "自分が作成" },
                      { key: "joined", label: "参加済み" },
                      { key: "not-joined", label: "未参加のみ" },
                    ] as { key: MyEventsFilter; label: string }[]).map(({ key, label }) => (
                      <PillButton key={key} active={myEventsFilter === key} onClick={() => setMyEventsFilter(key)}>
                        {label}
                      </PillButton>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* フィルター適用中サマリー */}
          {isFilterActive && (
            <div className="border-t border-blue-100 px-4 py-2.5 bg-blue-50/40 flex items-center gap-2">
              <span className="text-xs text-blue-700 font-semibold">
                🔍 {allFiltered.length} 件のイベントが見つかりました
              </span>
              <button
                onClick={resetFilters}
                className="ml-auto text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                フィルターを解除
              </button>
            </div>
          )}
        </div>

        {/* ローディング */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : isFilterActive ? (
          /* フィルター適用時: 単一セクション */
          allFiltered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-gray-700 font-semibold mb-1">条件に合うイベントが見つかりませんでした</p>
              <p className="text-gray-400 text-sm mb-6">フィルターを変えるか、条件を緩めてみてください</p>
              <button
                onClick={resetFilters}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
              >
                フィルターをリセット
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {allFiltered.map((e) => <EventCard key={e.id} event={e} {...cardProps} />)}
            </div>
          )
        ) : (
          /* フィルターなし: 3セクション表示 */
          <>
            <Section
              title="自分が作成したイベント"
              subtitle="あなたが主催するイベント"
              items={createdEvents}
              emptyIcon="📋"
              emptyMessage="まだイベントを作っていません。最初のオフ会を開いてみよう！"
              cardProps={cardProps}
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
              cardProps={cardProps}
            />
            <Section
              title="その他のイベント"
              subtitle="参加者を募集中のイベント"
              items={otherEvents}
              emptyIcon="🔍"
              emptyMessage="現在募集中のイベントはありません。あなたが最初のイベントを作ってみよう！"
              cardProps={cardProps}
              emptyAction={
                <Link href="/events/create">
                  <button className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:shadow-md transition">
                    ＋ イベントを作成する
                  </button>
                </Link>
              }
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <EventsContent />
    </Suspense>
  );
}
