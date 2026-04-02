// app/admin/reports/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";

// ── 型定義 ──────────────────────────────────────────────
type ReportStatus = "pending" | "resolved" | "dismissed";
type ReportType = "user" | "event";

type Report = {
  id: string;
  type: ReportType;
  // ユーザー通報
  targetId?: string;
  targetName?: string;
  // イベント通報
  eventId?: string;
  eventTitle?: string;
  // 共通
  category: string;
  reason: string;
  reportedBy: string;
  createdAt: Timestamp | null;
  status: ReportStatus;
};

type FilterStatus = "all" | ReportStatus;
type FilterType = "all" | ReportType;

// ── ユーティリティ ───────────────────────────────────────
function deriveStatus(data: Record<string, unknown>): ReportStatus {
  const s = data.status as string | undefined;
  if (s === "resolved") return "resolved";
  if (s === "dismissed") return "dismissed";
  return "pending";
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return "-";
  try {
    return ts.toDate().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

// ── バッジ ───────────────────────────────────────────────
function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; cls: string }> = {
    pending: { label: "未対応", cls: "bg-red-100 text-red-700 border-red-200" },
    resolved: { label: "対応済み", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    dismissed: { label: "却下", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: ReportType }) {
  return type === "user" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
      👤 ユーザー
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
      📅 イベント
    </span>
  );
}

// ── メインページ ─────────────────────────────────────────
export default function AdminReportsPage() {
  const [me, setMe] = useState<FirebaseUser | null>(auth.currentUser);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");

  useEffect(() => {
    const un = onAuthStateChanged(auth, (u) => setMe(u));
    return () => un();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!me) { setMeIsAdmin(false); setLoading(false); return; }
      try {
        setLoading(true);
        const adminSnap = await getDoc(doc(db, "admins", me.uid));
        if (!adminSnap.exists()) { setMeIsAdmin(false); return; }
        setMeIsAdmin(true);

        const snap = await getDocs(
          query(collection(db, "reports"), orderBy("createdAt", "desc"))
        );
        const rows: Report[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            type: (data.type as ReportType) || "user",
            targetId: (data.targetId as string) || undefined,
            targetName: (data.targetName as string) || undefined,
            eventId: (data.eventId as string) || undefined,
            eventTitle: (data.eventTitle as string) || undefined,
            category: (data.category as string) || "-",
            reason: (data.reason as string) || "",
            reportedBy: (data.reportedBy as string) || "",
            createdAt: (data.createdAt as Timestamp) || null,
            status: deriveStatus(data),
          };
        });
        setReports(rows);
      } catch (e) {
        console.error("Error loading reports:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [me]);

  const filtered = useMemo(() => {
    let list = [...reports];
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (filterType !== "all") list = list.filter((r) => r.type === filterType);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.targetName, r.targetId, r.eventTitle, r.eventId, r.category, r.reason, r.reportedBy]
          .join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [reports, filterStatus, filterType, search]);

  const counts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  }), [reports]);

  // ── ガード ──────────────────────────────────────────────
  if (!me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Navbar />
        <p className="text-center mt-20 text-gray-500">ログインしてください。</p>
      </div>
    );
  }
  if (meIsAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (!meIsAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Navbar />
        <p className="text-center mt-20 text-rose-700 font-bold">権限がありません（管理者専用）</p>
      </div>
    );
  }

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: "all", label: `全件 (${counts.all})` },
    { key: "pending", label: `未対応 (${counts.pending})` },
    { key: "resolved", label: `対応済み (${counts.resolved})` },
    { key: "dismissed", label: `却下 (${counts.dismissed})` },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200">
      <Navbar />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:px-6">

        {/* ヘッダ */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🚨 通報管理</h1>
            <p className="text-gray-500 text-sm mt-1">
              通報 {reports.length} 件
              {counts.pending > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                  未対応 {counts.pending} 件
                </span>
              )}
            </p>
          </div>
          <Link href="/admin">
            <button className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm shrink-0">
              ← 管理トップ
            </button>
          </Link>
        </div>

        {/* 検索 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="対象名 / UID / カテゴリ / 理由 で検索"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-sm text-gray-800"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xl rounded-xl hover:bg-gray-100"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* フィルター */}
        <div className="flex gap-2 flex-wrap mb-3">
          {/* ステータスフィルター */}
          {STATUS_FILTERS.map(({ key, label }) => {
            const isActive = filterStatus === key;
            let cls = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
            if (isActive) {
              if (key === "pending") cls = "bg-red-600 text-white border-red-600";
              else if (key === "resolved") cls = "bg-emerald-600 text-white border-emerald-600";
              else if (key === "dismissed") cls = "bg-gray-500 text-white border-gray-500";
              else cls = "bg-gray-700 text-white border-gray-700";
            }
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${cls}`}
              >
                {label}
              </button>
            );
          })}
          {/* セパレーター */}
          <span className="w-px bg-gray-200 my-1" />
          {/* タイプフィルター */}
          {(["all", "user", "event"] as FilterType[]).map((t) => {
            const labels = { all: "すべて", user: "👤 ユーザー", event: "📅 イベント" };
            const isActive = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                  isActive
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* 一覧 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">
                {search ? `「${search}」に一致する通報が見つかりません` : "通報がありません"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">
                    <th className="px-4 py-3">種別 / 対象</th>
                    <th className="px-4 py-3 hidden sm:table-cell">カテゴリ</th>
                    <th className="px-4 py-3 hidden md:table-cell">理由（抜粋）</th>
                    <th className="px-4 py-3">状態</th>
                    <th className="px-4 py-3 hidden lg:table-cell">日時</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={`transition hover:bg-gray-50 ${
                        r.status === "pending" ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="mb-1">
                          <TypeBadge type={r.type} />
                        </div>
                        <div className="font-medium text-gray-800 text-xs truncate max-w-[140px]">
                          {r.type === "user"
                            ? r.targetName || r.targetId || "-"
                            : r.eventTitle || r.eventId || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-600">
                        {r.category}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 max-w-[200px]">
                        <span className="line-clamp-2">{r.reason || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/reports/${r.id}`}>
                          <button className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs hover:bg-gray-900 whitespace-nowrap">
                            詳細 →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3 text-right">
          {filtered.length} / {reports.length} 件表示
        </p>
      </main>
    </div>
  );
}
