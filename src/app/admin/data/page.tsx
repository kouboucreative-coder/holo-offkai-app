// app/admin/data/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

/* =========================
   Types
   ========================= */
type SurveyResponse = {
  id: string;
  userId: string;
  userName?: string;
  eventId?: string;
  eventTitle?: string;
  type: "5scale" | string;
  score?: number; // 1..5
  comment?: string;
  createdAt?: any; // Timestamp
};

type EventItem = {
  id: string;
  title?: string;
  date?: string;
};

/* =========================
   Helpers
   ========================= */
function toDateVal(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate() as Date;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  return `${y}-${m}-${da}`;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = (c ?? "").toString().replace(/"/g, '""');
          if (s.search(/[",\n]/g) >= 0) return `"${s}"`;
          return s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   Page
   ========================= */
export default function AdminDataPage() {
  const me = auth.currentUser;

  // auth / role
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [tab, setTab] = useState<"surveys" | "metrics">("surveys");
  const [eventId, setEventId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // ===== Check admin =====
  useEffect(() => {
    const run = async () => {
      if (!me) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const s = await getDoc(doc(db, "users", me.uid));
        const role = s.exists() ? (s.data() as any).role : undefined;
        setIsAdmin(role === "admin");
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [me]);

  // ===== Load master lists =====
  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        // events (for filter)
        const es = await getDocs(query(collection(db, "events"), orderBy("date", "desc"), limit(500)));
        const eventList = es.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
        setEvents(eventList);

        // survey responses (recent 2000)
        const rs = await getDocs(
          query(collection(db, "surveyResponses"), orderBy("createdAt", "desc"), limit(2000))
        );
        const rows = rs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SurveyResponse[];
        setResponses(rows);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  // ===== Defaults for date range (last 30d) =====
  useEffect(() => {
    if (dateFrom || dateTo) return;
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    setDateFrom(toLocalInputValue(from));
    setDateTo(toLocalInputValue(now));
  }, [dateFrom, dateTo]);

  // ===== Filtered dataset =====
  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return responses.filter((r) => {
      if (r.type !== "5scale") return false;
      if (eventId !== "all" && r.eventId !== eventId) return false;
      const at = toDateVal(r.createdAt);
      if (from && at && at < from) return false;
      if (to && at && at > to) return false;
      return true;
    });
  }, [responses, eventId, dateFrom, dateTo]);

  // ===== Aggregations =====
  const { count, avg, dist } = useMemo(() => {
    const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let c = 0;
    filtered.forEach((r) => {
      const s = Number(r.score ?? 0);
      if (s >= 1 && s <= 5) {
        d[s] += 1;
        c += 1;
        sum += s;
      }
    });
    return {
      count: c,
      avg: c ? Math.round((sum / c) * 10) / 10 : 0,
      dist: d,
    };
  }, [filtered]);

  // ===== Export CSV =====
  const exportCSV = () => {
    const rows: string[][] = [
      ["responseId", "eventId", "eventTitle", "userId", "score", "comment", "createdAt"],
    ];
    filtered.forEach((r) => {
      const at = toDateVal(r.createdAt)?.toISOString() ?? "";
      rows.push([
        r.id,
        r.eventId ?? "",
        r.eventTitle ?? "",
        r.userId ?? "",
        (r.score ?? "").toString(),
        r.comment ?? "",
        at,
      ]);
    });
    const evTitle =
      (events.find((e) => e.id === eventId)?.title ?? "all").replace(/[^\w-]+/g, "_");
    downloadCSV(`survey_${evTitle}_${dateFrom}_${dateTo}.csv`, rows);
  };

  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p>読み込み中…</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-center text-red-600">このページは管理者のみ利用できます。</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 データ管理</h1>
            <p className="text-gray-600 text-sm">メトリクス確認、エクスポート、アンケート集計。</p>
          </div>
          <Link
            href="/admin"
            className="px-3 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            ← 管理メニュー
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            className={`px-4 py-2 rounded border ${
              tab === "surveys"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-gray-200 text-gray-700"
            }`}
            onClick={() => setTab("surveys")}
          >
            アンケート結果
          </button>
          <button
            className={`px-4 py-2 rounded border ${
              tab === "metrics"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-gray-200 text-gray-700"
            }`}
            onClick={() => setTab("metrics")}
          >
            基本メトリクス
          </button>
        </div>

        {tab === "surveys" ? (
          <section className="space-y-6">
            {/* Filters */}
            <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">イベント</label>
                  <select
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-black"
                  >
                    <option value="all">すべて</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title || "(無題)"} {ev.date ? `- ${ev.date}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">期間（開始）</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">期間（終了）</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-black"
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  CSVエクスポート
                </button>
                <button
                  onClick={() => {
                    setEventId("all");
                    const now = new Date();
                    const from = new Date();
                    from.setDate(now.getDate() - 30);
                    setDateFrom(toLocalInputValue(from));
                    setDateTo(toLocalInputValue(now));
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  リセット
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
                <div className="text-sm text-gray-500">回答数</div>
                <div className="text-3xl font-bold">{count}</div>
              </div>
              <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
                <div className="text-sm text-gray-500">平均スコア</div>
                <div className="text-3xl font-bold">{avg.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
                <div className="text-sm text-gray-500">対象イベント</div>
                <div className="text-lg font-semibold truncate">
                  {eventId === "all"
                    ? "すべて"
                    : events.find((e) => e.id === eventId)?.title || "(無題)"}
                </div>
              </div>
            </div>

            {/* Histogram */}
            <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">スコア分布</h3>
              <div className="grid grid-cols-5 gap-4 items-end">
                {[1, 2, 3, 4, 5].map((s) => {
                  const max = Math.max(1, ...Object.values(dist));
                  const h = Math.round(((dist[s] ?? 0) / max) * 140);
                  return (
                    <div key={s} className="flex flex-col items-center">
                      <div
                        className="w-10 bg-indigo-500 rounded-t"
                        style={{ height: `${h}px` }}
                        title={`${s}: ${dist[s] ?? 0}`}
                      />
                      <div className="text-sm text-gray-700 mt-1">{s}</div>
                      <div className="text-xs text-gray-500">{dist[s] ?? 0}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">回答一覧</h3>
              {filtered.length === 0 ? (
                <p className="text-gray-600">該当する回答はありません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="px-3 py-2 text-left">日時</th>
                        <th className="px-3 py-2 text-left">イベント</th>
                        <th className="px-3 py-2 text-left">ユーザー</th>
                        <th className="px-3 py-2 text-left">スコア</th>
                        <th className="px-3 py-2 text-left">コメント</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {toDateVal(r.createdAt)?.toLocaleString() ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {r.eventTitle || r.eventId || "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {r.userName || r.userId || "-"}
                          </td>
                          <td className="px-3 py-2 font-semibold">{r.score ?? "-"}</td>
                                                    <td className="px-3 py-2 text-gray-700 whitespace-pre-wrap">
                            {r.comment || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-xl bg-white/90 border border-gray-100 shadow p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">基本メトリクス</h3>
              <p className="text-gray-700 text-sm">
                今後、ユーザー数・イベント数・成長率・直近アクティブなどのダッシュボードをここに表示します。
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}