// app/admin/reports/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// ── 型定義 ──────────────────────────────────────────────
type ReportStatus = "pending" | "resolved" | "dismissed";
type ReportType = "user" | "event";

type Report = {
  id: string;
  type: ReportType;
  targetId?: string;
  targetName?: string;
  eventId?: string;
  eventTitle?: string;
  category: string;
  reason: string;
  reportedBy: string;
  createdAt: Timestamp | null;
  status: ReportStatus;
  adminNote?: string;
  resolvedAt?: Timestamp | null;
  resolvedBy?: string;
};

type TargetUser = {
  name?: string;
  email?: string;
  oshi?: string;
  prefecture?: string;
  photoURL?: string;
  status?: string;
  banned?: boolean;
};

type TargetEvent = {
  title?: string;
  date?: string;
  createdBy?: string;
  createdByName?: string;
  capacity?: number;
  participants?: { uid: string; name: string }[];
};

// ── ユーティリティ ───────────────────────────────────────
function deriveStatus(data: Record<string, unknown>): ReportStatus {
  const s = data.status as string | undefined;
  if (s === "resolved") return "resolved";
  if (s === "dismissed") return "dismissed";
  return "pending";
}

const isTs = (v: unknown): v is Timestamp =>
  !!v && typeof (v as Timestamp).toDate === "function";

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts || !isTs(ts)) return "-";
  return ts.toDate().toLocaleString("ja-JP");
}

// ── バッジ ───────────────────────────────────────────────
function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; cls: string }> = {
    pending: { label: "⚠️ 未対応", cls: "bg-red-100 text-red-700 border-red-200" },
    resolved: { label: "✅ 対応済み", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    dismissed: { label: "🚫 却下", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

// ── ページ本体 ───────────────────────────────────────────
export default function AdminReportDetailPage() {
  const params = useParams();
  const raw = params?.id as string | string[] | undefined;
  const reportId = Array.isArray(raw) ? raw[0] : raw ?? "";
  const router = useRouter();

  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [targetEvent, setTargetEvent] = useState<TargetEvent | null>(null);
  const [reporterName, setReporterName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);

  // ── 管理者チェック ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/"); return; }
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (snap.exists()) { setMeIsAdmin(true); }
        else { setMeIsAdmin(false); router.push("/"); }
      } catch { setMeIsAdmin(false); router.push("/"); }
    });
    return () => unsub();
  }, [router]);

  // ── 通報データ取得 ──────────────────────────────────────
  useEffect(() => {
    if (!reportId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "reports", reportId));
        if (!snap.exists()) { setReport(null); return; }
        const data = snap.data() as Record<string, unknown>;
        const r: Report = {
          id: snap.id,
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
          adminNote: (data.adminNote as string) || "",
          resolvedAt: (data.resolvedAt as Timestamp) || null,
          resolvedBy: (data.resolvedBy as string) || undefined,
        };
        setReport(r);
        setAdminNote(r.adminNote || "");

        // 並列で追加情報を取得
        await Promise.all([
          // 通報者名
          r.reportedBy
            ? getDoc(doc(db, "users", r.reportedBy)).then((s) => {
                if (s.exists()) setReporterName((s.data() as { name?: string }).name || "不明");
              })
            : Promise.resolve(),

          // 対象ユーザー
          r.type === "user" && r.targetId
            ? getDoc(doc(db, "users", r.targetId)).then((s) => {
                if (s.exists()) setTargetUser(s.data() as TargetUser);
              })
            : Promise.resolve(),

          // 対象イベント
          r.type === "event" && r.eventId
            ? getDoc(doc(db, "events", r.eventId)).then((s) => {
                if (s.exists()) setTargetEvent(s.data() as TargetEvent);
              })
            : Promise.resolve(),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId]);

  const currentStatus = useMemo(() => report?.status ?? "pending", [report]);

  // ── ステータス更新 ──────────────────────────────────────
  const updateStatus = async (nextStatus: ReportStatus) => {
    if (busy || !report) return;
    setBusy(true);
    try {
      const me = auth.currentUser;
      await updateDoc(doc(db, "reports", reportId), {
        status: nextStatus,
        adminNote: adminNote || null,
        resolvedAt: serverTimestamp(),
        resolvedBy: me?.uid || null,
      });
      // ログ
      await setDoc(doc(db, "adminEventLogs", `report_${reportId}_${Date.now()}`), {
        action: `report_${nextStatus}`,
        reportId,
        reportType: report.type,
        note: adminNote || null,
        at: serverTimestamp(),
        by: me?.uid || null,
      });
      setReport((prev) => prev ? { ...prev, status: nextStatus } : prev);
      alert(
        nextStatus === "resolved"
          ? "対応済みにしました。"
          : nextStatus === "dismissed"
          ? "却下しました。"
          : "未対応に戻しました。"
      );
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (busy || !report) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "reports", reportId), { adminNote: adminNote || null });
      alert("メモを保存しました。");
    } finally {
      setBusy(false);
    }
  };

  // ── ローディング / エラー ────────────────────────────────
  if (meIsAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (!meIsAdmin) {
    return <p className="text-center mt-20 text-rose-700 font-bold">アクセス権限がありません。</p>;
  }
  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Navbar />
        <main className="max-w-3xl mx-auto p-6">
          <p className="text-gray-600">通報が見つかりません。</p>
          <Link href="/admin/reports" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            ← 通報一覧へ戻る
          </Link>
        </main>
      </div>
    );
  }

  const isUser = report.type === "user";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:px-6 space-y-4">

        {/* ── ヘッダ ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">
                  {isUser ? "👤 ユーザー通報" : "📅 イベント通報"}
                </h1>
                <StatusBadge status={currentStatus} />
              </div>
              <p className="text-xs text-gray-400 font-mono">{reportId}</p>
            </div>
            <div className="text-xs text-gray-400 text-right">
              <div>受理日時</div>
              <div className="font-medium text-gray-600">{formatTs(report.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* ── 通報内容 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-bold text-gray-800 text-sm">📋 通報内容</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-0.5">対象</div>
              <div className="font-medium text-gray-800 text-sm">
                {isUser
                  ? report.targetName || report.targetId || "-"
                  : report.eventTitle || report.eventId || "-"}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-0.5">カテゴリ</div>
              <div className="font-medium text-gray-800 text-sm">{report.category}</div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="text-xs text-red-400 mb-1">通報理由</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.reason || "(未記入)"}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-0.5">通報者</div>
            <div className="text-sm text-gray-700">
              {reporterName || "不明"}
              <span className="text-gray-400 text-xs ml-2 font-mono">{report.reportedBy}</span>
            </div>
          </div>
        </div>

        {/* ── 対象ユーザー情報 ── */}
        {isUser && report.targetId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">👤 対象ユーザーの情報</h2>
              <Link
                href={`/admin/users/${report.targetId}`}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                管理ページへ →
              </Link>
            </div>
            {targetUser ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "名前", value: targetUser.name },
                  { label: "メール", value: targetUser.email },
                  { label: "都道府県", value: targetUser.prefecture },
                  { label: "最推し", value: targetUser.oshi },
                  {
                    label: "アカウント状態",
                    value:
                      targetUser.banned
                        ? "⛔ BAN中"
                        : targetUser.status === "suspended"
                        ? "⏸ 停止中"
                        : "✅ 通常",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-gray-800">{value || "未設定"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">ユーザー情報を取得できませんでした。</p>
            )}
            <div className="pt-1 flex gap-2 flex-wrap">
              <Link href={`/profile/${report.targetId}`} target="_blank">
                <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                  公開プロフィールを見る ↗
                </button>
              </Link>
              <Link href={`/admin/users/${report.targetId}`}>
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                  ユーザー管理ページで対応する →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── 対象イベント情報 ── */}
        {!isUser && report.eventId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">📅 対象イベントの情報</h2>
              <Link
                href={`/admin/events/${report.eventId}`}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                管理ページへ →
              </Link>
            </div>
            {targetEvent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "タイトル", value: targetEvent.title },
                  { label: "開催日", value: targetEvent.date },
                  { label: "主催者", value: targetEvent.createdByName || targetEvent.createdBy },
                  {
                    label: "参加状況",
                    value: `${targetEvent.participants?.length ?? 0} / ${targetEvent.capacity ?? "-"}`,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-gray-800">{value || "-"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">イベント情報を取得できませんでした（削除済みの可能性）。</p>
            )}
            <div className="pt-1 flex gap-2 flex-wrap">
              <Link href={`/admin/events/${report.eventId}`}>
                <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                  イベント管理ページで対応する →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── 管理メモ ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 text-sm mb-3">📝 管理メモ（内部記録）</h2>
          <textarea
            rows={3}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            placeholder="対応内容・判断理由などを記録（ユーザーには非公開）"
          />
          <button
            onClick={saveNote}
            disabled={busy}
            className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-xl text-xs font-semibold hover:bg-gray-700 disabled:opacity-60"
          >
            メモを保存
          </button>
        </div>

        {/* ── 対応操作 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* 対応済み */}
          <button
            onClick={() => updateStatus("resolved")}
            disabled={busy || currentStatus === "resolved"}
            className={`py-4 rounded-2xl text-sm font-bold transition ${
              currentStatus === "resolved"
                ? "bg-emerald-100 text-emerald-600 cursor-default"
                : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            }`}
          >
            ✅ 対応済みにする
            {currentStatus === "resolved" && (
              <div className="text-xs font-normal mt-0.5 opacity-70">現在のステータス</div>
            )}
          </button>

          {/* 未対応に戻す */}
          <button
            onClick={() => updateStatus("pending")}
            disabled={busy || currentStatus === "pending"}
            className={`py-4 rounded-2xl text-sm font-bold transition ${
              currentStatus === "pending"
                ? "bg-red-100 text-red-500 cursor-default"
                : "bg-white border-2 border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-60"
            }`}
          >
            ⚠️ 未対応に戻す
            {currentStatus === "pending" && (
              <div className="text-xs font-normal mt-0.5 opacity-70">現在のステータス</div>
            )}
          </button>

          {/* 却下 */}
          <button
            onClick={() => updateStatus("dismissed")}
            disabled={busy || currentStatus === "dismissed"}
            className={`py-4 rounded-2xl text-sm font-bold transition ${
              currentStatus === "dismissed"
                ? "bg-gray-100 text-gray-400 cursor-default"
                : "bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            }`}
          >
            🚫 却下する
            {currentStatus === "dismissed" && (
              <div className="text-xs font-normal mt-0.5 opacity-70">現在のステータス</div>
            )}
          </button>

        </div>

        {/* ── 戻るボタン ── */}
        <div className="flex items-center gap-3 pt-2">
          <Link href="/admin/reports">
            <button className="px-4 py-2 bg-gray-600 text-white rounded-xl text-sm hover:bg-gray-700">
              ← 通報一覧へ
            </button>
          </Link>
        </div>

      </main>
    </div>
  );
}
