// app/admin/users/[uid]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

// ── 型定義 ──────────────────────────────────────────────
type UserStatus = "active" | "suspended" | "banned";

type AdminUser = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  prefecture?: string;
  oshi?: string;
  oshis?: string[];
  bio?: string;
  photoURL?: string;
  createdAt?: Timestamp | string | null;
  updatedAt?: Timestamp | string | null;
  profileCompleted?: boolean;
  xUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  blogUrl?: string;
  otherUrl?: string;
  status?: string;
  suspendedUntil?: Timestamp | null;
  banned?: boolean;
  bannedAt?: Timestamp | null;
  deleted?: boolean;
};

// ── ユーティリティ ───────────────────────────────────────
const isTs = (v: unknown): v is Timestamp =>
  !!v && typeof (v as Timestamp).toDate === "function";

function formatTs(v: Timestamp | string | null | undefined): string {
  if (!v) return "-";
  try {
    const d = isTs(v) ? v.toDate() : new Date(v as string);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function deriveStatus(u: AdminUser): UserStatus {
  if (u.banned === true || u.status === "banned") return "banned";
  if (u.status === "suspended") {
    const until = u.suspendedUntil;
    if (isTs(until) && until.toDate() > new Date()) return "suspended";
    if (until && !isTs(until)) return "suspended";
  }
  return "active";
}

// ── コンポーネント ───────────────────────────────────────
function StatusBadge({ status }: { status: UserStatus }) {
  const map: Record<UserStatus, { label: string; cls: string }> = {
    banned: { label: "⛔ BAN中", cls: "bg-red-100 text-red-700 border-red-200" },
    suspended: { label: "⏸ 停止中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    active: { label: "✅ 通常", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="font-medium text-gray-800 break-all text-sm">{value || "未設定"}</div>
    </div>
  );
}

// ── ページ本体 ───────────────────────────────────────────
export default function AdminUserDetailPage() {
  const params = useParams();
  const raw = params?.uid as string | string[] | undefined;
  const uid = Array.isArray(raw) ? raw[0] : raw ?? "";
  const router = useRouter();

  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);

  const [suspendUntilInput, setSuspendUntilInput] = useState("");
  const [reason, setReason] = useState("");
  const [editAdmin, setEditAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── 管理者チェック ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const me = auth.currentUser;
      if (!me) { router.push("/"); return; }
      const snap = await getDoc(doc(db, "admins", me.uid));
      if (snap.exists()) { setMeIsAdmin(true); }
      else { setMeIsAdmin(false); router.push("/"); }
    })().catch(() => { setMeIsAdmin(false); router.push("/"); });
  }, [router]);

  // ── 対象ユーザー取得 ────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) { setTarget(null); return; }
        const data = snap.data() as AdminUser;
        const merged: AdminUser = { ...data, uid };
        setTarget(merged);

        // 管理者フラグ
        const admSnap = await getDoc(doc(db, "admins", uid));
        setEditAdmin(admSnap.exists());

        // 停止期限の初期値
        if (isTs(merged.suspendedUntil)) {
          const dt = merged.suspendedUntil.toDate();
          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setSuspendUntilInput(local);
        }

        // イベント集計（作成 / 参加）
        const evSnap = await getDocs(collection(db, "events"));
        const events = evSnap.docs.map((d) => ({ ...d.data() as Record<string, unknown> }));
        setCreatedCount(events.filter((e) => e.createdBy === uid).length);
        setJoinedCount(
          events.filter(
            (e) =>
              e.createdBy !== uid &&
              Array.isArray(e.participants) &&
              (e.participants as { uid: string }[]).some((p) => p.uid === uid)
          ).length
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const userStatus = useMemo(
    () => (target ? deriveStatus(target) : "active"),
    [target]
  );
  const isActive = userStatus === "active";
  const isBanned = userStatus === "banned";
  const isSuspended = userStatus === "suspended";

  // ── 操作 ────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (busy || !target) return;
    if (!suspendUntilInput) { alert("停止解除日時を設定してください。"); return; }
    const until = new Date(suspendUntilInput);
    if (isNaN(until.getTime())) { alert("日時の形式が正しくありません。"); return; }
    setBusy(true);
    try {
      const ts = Timestamp.fromDate(until);
      await updateDoc(doc(db, "users", uid), {
        status: "suspended", suspendedUntil: ts, banned: false, deleted: false,
      });
      await setDoc(doc(db, "adminEventLogs", `${uid}_suspend_${Date.now()}`), {
        action: "suspend", targetUid: uid, reason: reason || null, until: ts, at: serverTimestamp(),
      });
      alert("停止を設定しました。");
      router.refresh?.();
    } finally { setBusy(false); }
  };

  const handleBan = async () => {
    if (busy || !target) return;
    if (!confirm("このユーザーを永久BANしますか？\n取り消すまでアクセスできなくなります。")) return;
    setBusy(true);
    try {
      const now = Timestamp.now();
      await updateDoc(doc(db, "users", uid), {
        banned: true, bannedAt: now, status: "banned", deleted: true, suspendedUntil: null,
      });
      await setDoc(doc(db, "bans", uid), {
        uid, email: target.email || null, reason: reason || null, at: now, permanent: true,
      });
      await setDoc(doc(db, "adminEventLogs", `${uid}_ban_${Date.now()}`), {
        action: "ban", targetUid: uid, reason: reason || null, at: now,
      });
      alert("永久BANを適用しました。");
      router.refresh?.();
    } finally { setBusy(false); }
  };

  const handleRestore = async () => {
    if (busy || !target) return;
    if (!confirm("このユーザーの停止 / BAN を解除しますか？")) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        status: "active", banned: false, deleted: false, suspendedUntil: null,
      });
      await deleteDoc(doc(db, "bans", uid)).catch(() => {});
      await setDoc(doc(db, "adminEventLogs", `${uid}_restore_${Date.now()}`), {
        action: "restore", targetUid: uid, reason: reason || null, at: serverTimestamp(),
      });
      alert("復元しました。");
      router.refresh?.();
    } finally { setBusy(false); }
  };

  const handleSaveRole = async () => {
    if (busy || !target) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", uid), { role: editAdmin ? "admin" : "user" });
      if (editAdmin) {
        await setDoc(doc(db, "admins", uid), { manual: true, createdAt: serverTimestamp() });
      } else {
        await deleteDoc(doc(db, "admins", uid)).catch(() => {});
      }
      await setDoc(doc(db, "adminEventLogs", `${uid}_role_${Date.now()}`), {
        action: "update_role", targetUid: uid, setAdmin: editAdmin, at: serverTimestamp(),
      });
      alert("権限を保存しました。");
      router.refresh?.();
    } finally { setBusy(false); }
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
  if (!target) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
        <Navbar />
        <main className="max-w-3xl mx-auto p-6">
          <p className="text-gray-600">ユーザーが見つかりません。</p>
          <Link href="/admin/users" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            ← 一覧へ戻る
          </Link>
        </main>
      </div>
    );
  }

  const snsList = [
    { label: "X", url: target.xUrl },
    { label: "YouTube", url: target.youtubeUrl },
    { label: "Instagram", url: target.instagramUrl },
    { label: "TikTok", url: target.tiktokUrl },
    { label: "ブログ", url: target.blogUrl },
    { label: "その他", url: target.otherUrl },
  ].filter((s) => s.url);

  // ── UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 sm:px-6 space-y-4">

        {/* ── 状態バナー（停止/BAN時） ── */}
        {!isActive && (
          <div
            className={`rounded-2xl border p-4 flex items-start gap-3 ${
              isBanned
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <span className="text-2xl shrink-0">{isBanned ? "⛔" : "⏸"}</span>
            <div className="flex-1 min-w-0">
              <p
                className={`font-bold text-sm ${
                  isBanned ? "text-red-800" : "text-amber-800"
                }`}
              >
                {isBanned
                  ? "このユーザーは永久BAN中です"
                  : "このユーザーは停止中です"}
              </p>
              {isSuspended && isTs(target.suspendedUntil) && (
                <p className="text-xs text-amber-700 mt-0.5">
                  解除予定: {target.suspendedUntil.toDate().toLocaleString("ja-JP")}
                </p>
              )}
            </div>
            <button
              onClick={handleRestore}
              disabled={busy}
              className={`shrink-0 px-4 py-2 rounded-xl font-semibold text-white text-sm disabled:opacity-60 ${
                isBanned
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              復元する
            </button>
          </div>
        )}

        {/* ── プロフィール情報 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <img
                src={target.photoURL || "/avatar-placeholder.png"}
                alt=""
                className="w-14 h-14 rounded-full object-cover bg-gray-200 shrink-0"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {target.name || "未設定"}
                </h1>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5 break-all">
                  {uid}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StatusBadge status={userStatus} />
              {target.role === "admin" && (
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  admin
                </span>
              )}
            </div>
          </div>

          {/* 基本フィールド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <InfoRow label="メール" value={target.email} />
            <InfoRow label="都道府県" value={target.prefecture} />
            <InfoRow label="最推し" value={target.oshi} />
            <InfoRow label="role" value={target.role || "user"} />
            <InfoRow
              label="profileCompleted"
              value={target.profileCompleted ? "✅ 完了" : "⬜ 未設定"}
            />
            <InfoRow label="登録日" value={formatTs(target.createdAt)} />
          </div>

          {/* 自己紹介 */}
          {target.bio && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">自己紹介</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{target.bio}</p>
            </div>
          )}

          {/* SNSリンク */}
          {snsList.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">SNSリンク</div>
              <div className="flex flex-wrap gap-2">
                {snsList.map(({ label, url }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 border border-blue-100"
                  >
                    {label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* イベント統計 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {createdCount ?? "…"}
              </div>
              <div className="text-xs text-blue-400 mt-0.5">作成したイベント</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {joinedCount ?? "…"}
              </div>
              <div className="text-xs text-purple-400 mt-0.5">参加したイベント</div>
            </div>
          </div>

          {/* 公開プロフィールへ */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              href={`/profile/${uid}`}
              target="_blank"
              className="text-sm text-blue-600 hover:underline"
            >
              公開プロフィールを見る →
            </Link>
          </div>
        </div>

        {/* ── 権限編集 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-4">🔧 権限の編集</h2>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editAdmin}
              onChange={(e) => setEditAdmin(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-700">このユーザーを管理者にする</span>
          </label>
          <button
            onClick={handleSaveRole}
            disabled={busy}
            className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            権限を保存
          </button>
        </div>

        {/* ── 理由メモ ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-2 text-sm">
            📝 理由メモ（次の操作に適用）
          </h2>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            placeholder="停止・BAN・復元・権限変更の理由（任意）"
          />
        </div>

        {/* ── 操作カード ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* 停止 */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-1">⏳ 停止（期限付き）</h3>
            <p className="text-xs text-gray-500 mb-3">指定日まで利用不可にします</p>
            <label className="text-xs text-gray-500 mb-1 block">停止解除日時</label>
            <input
              type="datetime-local"
              value={suspendUntilInput}
              onChange={(e) => setSuspendUntilInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={handleSuspend}
              disabled={busy}
              className="w-full mt-3 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
            >
              停止を設定
            </button>
          </div>

          {/* 復元 */}
          <div
            className={`rounded-2xl shadow-sm border p-5 ${
              isActive
                ? "bg-emerald-50 border-emerald-200"
                : "bg-white border-emerald-100"
            }`}
          >
            <h3 className="font-bold text-gray-900 text-sm mb-1">🕊 復元</h3>
            <p className="text-xs text-gray-500 mb-3">停止 / BAN を解除します</p>
            <button
              onClick={handleRestore}
              disabled={busy || isActive}
              className="w-full mt-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isActive ? "現在は有効です" : "🕊 復元する"}
            </button>
          </div>

          {/* BAN */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-5">
            <h3 className="font-bold text-red-700 text-sm mb-1">🚫 永久BAN</h3>
            <p className="text-xs text-red-400 mb-3">
              永久にアクセスを禁止します。解除は復元で行います。
            </p>
            <button
              onClick={handleBan}
              disabled={busy}
              className="w-full mt-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              永久BANを適用
            </button>
          </div>
        </div>

        {/* ── 戻るボタン ── */}
        <div className="flex gap-3 pt-2">
          <Link href="/admin/users">
            <button className="px-4 py-2 bg-gray-600 text-white rounded-xl text-sm hover:bg-gray-700">
              ← ユーザー一覧へ
            </button>
          </Link>
        </div>

      </main>
    </div>
  );
}
