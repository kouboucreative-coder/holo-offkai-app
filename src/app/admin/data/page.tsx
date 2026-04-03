// app/admin/data/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

/* ================================================================
   Types
   ================================================================ */
type SurveyResponse = {
  id: string;
  userId: string;
  userName?: string;
  eventId?: string;
  eventTitle?: string;
  type: "5scale" | string;
  score?: number;
  comment?: string;
  createdAt?: Timestamp | string | null;
};

type EventItem = {
  id: string;
  title?: string;
  date?: string;
};

type Metrics = {
  userCount: number | null;
  eventCount: number | null;
  reportCount: number | null;
  responseCount: number | null;
};

/* ================================================================
   Helpers
   ================================================================ */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof (v as Timestamp).toDate === "function")
    return (v as Timestamp).toDate();
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

function toInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(d: Date | null, short = false): string {
  if (!d) return "-";
  if (short)
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = (c ?? "").toString().replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================
   Sub‑components
   ================================================================ */

/** スコア横バーグラフ */
function ScoreBar({ score, count, max }: { score: number; count: number; max: number }) {
  const COLORS = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-500", "bg-emerald-500"];
  const LABELS = ["", "😞 最悪", "😕 残念", "😐 普通", "😊 良い", "🤩 最高"];
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-14 shrink-0 text-right">
        <span className="text-sm font-bold text-gray-700">{score}</span>
        <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{LABELS[score]}</span>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${COLORS[score]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-semibold text-gray-700">
        {count}
      </div>
      <div className="w-9 shrink-0 text-right text-xs text-gray-400">{pct}%</div>
    </div>
  );
}

/** スコアバッジ */
function ScoreBadge({ score }: { score: number }) {
  const cls = [
    "",
    "bg-red-100 text-red-700",
    "bg-orange-100 text-orange-700",
    "bg-yellow-100 text-yellow-700",
    "bg-lime-100 text-lime-700",
    "bg-emerald-100 text-emerald-700",
  ];
  const stars = "★".repeat(score) + "☆".repeat(5 - score);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls[score] ?? "bg-gray-100 text-gray-600"}`}
    >
      {score} <span className="text-[10px] opacity-70">{stars}</span>
    </span>
  );
}

/* ================================================================
   Page
   ================================================================ */
export default function AdminDataPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    userCount: null,
    eventCount: null,
    reportCount: null,
    responseCount: null,
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [tab, setTab] = useState<"surveys" | "metrics">("surveys");
  const [eventId, setEventId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── 管理者チェック ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/"); return; }
      try {
        const [userSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "admins", user.uid)),
        ]);
        const ok =
          (userSnap.exists() && (userSnap.data() as { role?: string }).role === "admin") ||
          adminSnap.exists();
        setIsAdmin(ok);
      } catch { setIsAdmin(false); }
      finally { setLoading(false); }
    });
    return () => unsub();
  }, [router]);

  // ── データ取得 ──────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        const [es, rs, us, rpts] = await Promise.all([
          getDocs(query(collection(db, "events"), orderBy("date", "desc"), limit(500))),
          getDocs(query(collection(db, "surveyResponses"), orderBy("createdAt", "desc"), limit(2000))),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "reports")),
        ]);
        setEvents(es.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem)));
        setResponses(rs.docs.map((d) => ({ id: d.id, ...d.data() } as SurveyResponse)));
        setMetrics({
          userCount: us.size,
          eventCount: es.size,
          reportCount: rpts.size,
          responseCount: rs.size,
        });
      } finally { setLoading(false); }
    };
    load();
  }, [isAdmin]);

  // ── 日付デフォルト（直近30日）──────────────────────────
  useEffect(() => {
    if (dateFrom || dateTo) return;
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    setDateFrom(toInputValue(from));
    setDateTo(toInputValue(now));
  }, [dateFrom, dateTo]);

  // ── フィルタリング ──────────────────────────────────────
  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to   = dateTo   ? new Date(`${dateTo}T23:59:59`)   : null;
    return responses.filter((r) => {
      if (r.type !== "5scale") return false;
      if (eventId !== "all" && r.eventId !== eventId) return false;
      const at = toDate(r.createdAt);
      if (from && at && at < from) return false;
      if (to   && at && at > to)   return false;
      return true;
    });
  }, [responses, eventId, dateFrom, dateTo]);

  // ── 集計 ───────────────────────────────────────────────
  const { count, avg, dist } = useMemo(() => {
    const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0, c = 0;
    filtered.forEach((r) => {
      const s = Number(r.score ?? 0);
      if (s >= 1 && s <= 5) { d[s]++; c++; sum += s; }
    });
    return { count: c, avg: c ? Math.round((sum / c) * 10) / 10 : 0, dist: d };
  }, [filtered]);

  const distMax = Math.max(1, ...Object.values(dist));
  const hasDistData = Object.values(dist).some((v) => v > 0);

  // ── フィルター条件ラベル ────────────────────────────────
  const conditionLabel = useMemo(() => {
    const ev =
      eventId === "all"
        ? "すべてのイベント"
        : `「${events.find((e) => e.id === eventId)?.title ?? "..."}」`;
    const range =
      dateFrom && dateTo
        ? `${fmtDate(toDate(`${dateFrom}T00:00`), true)} 〜 ${fmtDate(toDate(`${dateTo}T00:00`), true)}`
        : "全期間";
    return `${ev} / ${range}`;
  }, [eventId, events, dateFrom, dateTo]);

  // ── リセット ───────────────────────────────────────────
  const handleReset = () => {
    setEventId("all");
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    setDateFrom(toInputValue(from));
    setDateTo(toInputValue(now));
  };

  // ── CSV ─────────────────────────────────────────────────
  const exportCSV = () => {
    const rows: string[][] = [
      ["responseId", "eventId", "eventTitle", "userId", "userName", "score", "comment", "createdAt"],
    ];
    filtered.forEach((r) => {
      rows.push([
        r.id,
        r.eventId ?? "",
        r.eventTitle ?? "",
        r.userId ?? "",
        r.userName ?? "",
        (r.score ?? "").toString(),
        r.comment ?? "",
        toDate(r.createdAt)?.toISOString() ?? "",
      ]);
    });
    const evTitle = (events.find((e) => e.id === eventId)?.title ?? "all").replace(/[^\w-]+/g, "_");
    downloadCSV(`survey_${evTitle}_${dateFrom}_${dateTo}.csv`, rows);
  };

  // ── 削除 ───────────────────────────────────────────────
  const handleDelete = async (r: SurveyResponse) => {
    if (!confirm(`この回答を削除しますか？\n「${r.userName ?? r.userId}」のスコア: ${r.score}\n\nこの操作は取り消せません。`)) return;
    setDeletingId(r.id);
    try {
      await deleteDoc(doc(db, "surveyResponses", r.id));
      setResponses((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  };

  // ── ガード ──────────────────────────────────────────────
  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Navbar />
        <p className="text-center mt-20 text-red-600 font-bold">このページは管理者のみ利用できます。</p>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:px-6">

        {/* ── ヘッダ ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 データ管理</h1>
            <p className="text-gray-500 text-sm mt-1">アンケート集計・メトリクス確認・CSVエクスポート</p>
          </div>
          <Link href="/admin">
            <button className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm shrink-0">
              ← 管理トップ
            </button>
          </Link>
        </div>

        {/* ── タブ ── */}
        <div className="flex gap-2 mb-5">
          {(["surveys", "metrics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition border ${
                tab === t
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t === "surveys" ? "📋 アンケート結果" : "📈 基本メトリクス"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            アンケートタブ
        ══════════════════════════════════════════ */}
        {tab === "surveys" && (
          <section className="space-y-5">

            {/* フィルターカード */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">絞り込み条件</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">イベント</label>
                  <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
                    <option value="all">すべてのイベント</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title || "(無題)"}{ev.date ? ` (${ev.date})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">期間（開始）</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">期間（終了）</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={exportCSV}
                  disabled={count === 0}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⬇ CSVエクスポート
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200"
                >
                  リセット
                </button>
                {/* フィルター状態表示 */}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl">
                  <span>📍</span>
                  <span>{conditionLabel}</span>
                  <span className="text-gray-400">|</span>
                  <span className="font-semibold text-indigo-600">{count} 件</span>
                </div>
              </div>
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-xs font-medium text-gray-500 mb-1">回答数</div>
                <div className="text-3xl font-bold text-gray-900">{count}</div>
                {count === 0 && (
                  <div className="text-xs text-gray-400 mt-1">条件内の回答なし</div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-xs font-medium text-gray-500 mb-1">平均スコア</div>
                <div className="text-3xl font-bold text-gray-900">
                  {count > 0 ? avg.toFixed(1) : "-"}
                </div>
                {count > 0 && (
                  <div className="text-xs text-gray-400 mt-1">/ 5点満点</div>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 col-span-2 sm:col-span-1">
                <div className="text-xs font-medium text-gray-500 mb-1">対象イベント</div>
                <div className="text-sm font-semibold text-gray-900 leading-snug truncate">
                  {eventId === "all"
                    ? "すべて"
                    : events.find((e) => e.id === eventId)?.title || "(無題)"}
                </div>
              </div>
            </div>

            {/* スコア分布 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">
                スコア分布
                {hasDistData && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    （合計 {count} 件）
                  </span>
                )}
              </h3>
              {hasDistData ? (
                <div className="space-y-1">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <ScoreBar key={s} score={s} count={dist[s] ?? 0} max={distMax} />
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-3xl mb-2">📊</p>
                  <p className="text-sm font-medium text-gray-500">まだ集計できるデータがありません</p>
                  <p className="text-xs text-gray-400 mt-1">期間やイベント条件を変更してください</p>
                </div>
              )}
            </div>

            {/* 回答一覧 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">回答一覧</h3>
                {count > 0 && (
                  <span className="text-xs text-gray-400">{count} 件</span>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm font-medium text-gray-500">
                    この条件では回答データがありません
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    期間やイベント条件を変更してください
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100"
                  >
                    条件をリセットする
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((r) => (
                    <div
                      key={r.id}
                      className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition"
                    >
                      {/* ヘッダ行 */}
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <ScoreBadge score={r.score ?? 0} />
                          {/* ユーザーリンク */}
                          <Link
                            href={`/admin/users/${r.userId}`}
                            className="text-sm font-semibold text-blue-700 hover:underline"
                          >
                            👤 {r.userName || r.userId || "不明"}
                          </Link>
                          {/* イベントリンク */}
                          {r.eventId && (
                            <Link
                              href={`/admin/events/${r.eventId}`}
                              className="text-xs text-purple-600 hover:underline bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100"
                            >
                              📅 {r.eventTitle || r.eventId}
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">
                            {fmtDate(toDate(r.createdAt))}
                          </span>
                          {/* 削除ボタン */}
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === r.id}
                            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg border border-red-100 transition disabled:opacity-50"
                            title="この回答を削除"
                          >
                            {deletingId === r.id ? "削除中…" : "🗑"}
                          </button>
                        </div>
                      </div>
                      {/* コメント */}
                      {r.comment ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg px-3 py-2">
                          {r.comment}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">コメントなし</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════
            基本メトリクスタブ
        ══════════════════════════════════════════ */}
        {tab === "metrics" && (
          <section className="space-y-5">

            {/* カウントカード */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "登録ユーザー", value: metrics.userCount, icon: "👤", href: "/admin/users", color: "text-blue-600" },
                { label: "総イベント", value: metrics.eventCount, icon: "📅", href: "/admin/events", color: "text-purple-600" },
                { label: "アンケート回答", value: metrics.responseCount, icon: "📋", href: null, color: "text-indigo-600" },
                { label: "通報", value: metrics.reportCount, icon: "🚨", href: "/admin/reports", color: "text-red-500" },
              ].map(({ label, value, icon, href, color }) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                >
                  <div className="text-2xl mb-2">{icon}</div>
                  <div className={`text-3xl font-bold ${color}`}>
                    {value === null ? "…" : value.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                  {href && (
                    <Link
                      href={href}
                      className="inline-block mt-2 text-xs text-indigo-600 hover:underline"
                    >
                      管理ページへ →
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* アンケートサマリー */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4">📋 アンケート全体サマリー</h3>
              {(() => {
                // 全回答の集計
                const all = responses.filter((r) => r.type === "5scale");
                if (all.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400">まだアンケート回答がありません</p>
                    </div>
                  );
                }
                const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                let sum = 0;
                all.forEach((r) => {
                  const s = Number(r.score ?? 0);
                  if (s >= 1 && s <= 5) { d[s]++; sum += s; }
                });
                const allAvg = all.length ? Math.round((sum / all.length) * 10) / 10 : 0;
                const allMax = Math.max(1, ...Object.values(d));
                return (
                  <div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-4xl font-bold text-indigo-600">{allAvg.toFixed(1)}</span>
                      <span className="text-gray-400 text-sm">/ 5点  ({all.length} 件)</span>
                    </div>
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map((s) => (
                        <ScoreBar key={s} score={s} count={d[s] ?? 0} max={allMax} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2">今後追加予定のメトリクス</h3>
              <ul className="text-sm text-gray-500 space-y-1.5">
                {["月別ユーザー登録数の推移", "月別イベント開催数の推移", "直近30日のアクティブユーザー", "都道府県別ユーザー分布"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
