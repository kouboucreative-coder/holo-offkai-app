// app/admin/users/[uid]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
type AdminUser = {
  uid: string;
  name?: string;
  email?: string;
  role?: "admin" | "user";
  prefecture?: string;
  oshi?: string;
  createdAt?: any;

  // 制御フィールド
  status?: "active" | "suspended" | "banned";
  suspendedUntil?: Timestamp | null;
  banned?: boolean;
  bannedAt?: Timestamp | null;
  deleted?: boolean;
  photoURL?: string;
};

// Firestore Timestamp 判定
const isTimestamp = (v: unknown): v is Timestamp =>
  !!v && typeof (v as any).toDate === "function";

export default function AdminUserDetailPage() {
  // /admin/users/[uid]
  const params = useParams();
  const uidParam = (params?.uid as string | string[] | undefined) ?? "";
  const uid = Array.isArray(uidParam) ? uidParam[0] : uidParam;

  const router = useRouter();

  // 権限 & データ
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 停止入力
  const [suspendUntilInput, setSuspendUntilInput] = useState<string>(""); // yyyy-MM-ddTHH:mm
  const [reason, setReason] = useState<string>("");

  // 管理者フラグの編集UI
  const [editAdmin, setEditAdmin] = useState<boolean>(false);

  // 多重実行防止
  const [busy, setBusy] = useState(false);

  // ========== 管理者チェック ==========
  useEffect(() => {
    (async () => {
      const me = auth.currentUser;
      if (!me) {
        router.push("/");
        return;
      }
      // admins/{uid} が存在するかで判定
      const adminSnap = await getDoc(doc(db, "admins", me.uid));
      if (adminSnap.exists()) {
        setMeIsAdmin(true);
      } else {
        setMeIsAdmin(false);
        router.push("/");
      }
    })().catch(() => {
      setMeIsAdmin(false);
      router.push("/");
    });
  }, [router]);

  // ========== 対象ユーザー取得 ==========
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setTarget(null);
          return;
        }
        const data = snap.data() as AdminUser;
        const merged: AdminUser = {
          ...data,
          uid,
          role: (data.role as any) || "user",
          suspendedUntil: (data.suspendedUntil as Timestamp) || null,
        };
        setTarget(merged);

        // admins/{uid} の有無で管理者トグル初期化
        const adm = await getDoc(doc(db, "admins", uid));
        setEditAdmin(adm.exists());

        // 停止期限があれば input 初期値（ローカル時刻）
        const ts = merged.suspendedUntil;
        if (isTimestamp(ts)) {
          const dt = ts.toDate();
          const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setSuspendUntilInput(isoLocal);
        } else {
          setSuspendUntilInput("");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const isSuspended = target?.status === "suspended";
  const isBanned = !!target?.banned || target?.status === "banned";
  const isActive = !isSuspended && !isBanned;

  const statusBadge = useMemo(() => {
    if (!target) return null;
    if (isBanned) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 border border-red-200">
          BANNED
        </span>
      );
    }
    if (isSuspended) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200">
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
        ACTIVE
      </span>
    );
  }, [isBanned, isSuspended, target]);

  if (meIsAdmin === null || loading) {
    return <p className="text-center mt-10">読み込み中...</p>;
  }
  if (!meIsAdmin) {
    return <p className="text-center mt-10">アクセス権限がありません。</p>;
  }
  if (!target) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-3xl mx-auto p-6">
          <p>ユーザーが見つかりません。</p>
          <div className="mt-4">
            <Link href="/admin/users">
              <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                ← 一覧へ戻る
              </button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ========== 操作 ==========
  const handleSuspend = async () => {
    if (busy) return;
    if (!suspendUntilInput) {
      alert("停止解除日時（期限）を設定してください。");
      return;
    }
    const until = new Date(suspendUntilInput);
    if (Number.isNaN(until.getTime())) {
      alert("日時の形式が正しくありません。");
      return;
    }
    setBusy(true);
    try {
      const ts = Timestamp.fromDate(until);

      await updateDoc(doc(db, "users", target.uid), {
        status: "suspended",
        suspendedUntil: ts,
        banned: false,
        deleted: false,
      });

      await setDoc(doc(db, "adminEventLogs", `${target.uid}_suspend_${Date.now()}`), {
        action: "suspend",
        targetUid: target.uid,
        reason: reason || null,
        until: ts,
        at: serverTimestamp(),
      });

      alert("停止を設定しました。");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleBan = async () => {
    if (busy) return;
    if (!confirm("このユーザーを削除（永久BAN）しますか？取り消すまでログインできなくなります。")) {
      return;
    }
    setBusy(true);
    try {
      const now = Timestamp.now();
      await updateDoc(doc(db, "users", target.uid), {
        banned: true,
        bannedAt: now,
        status: "banned",
        deleted: true, // 論理削除
        suspendedUntil: null,
      });

      await setDoc(doc(db, "bans", target.uid), {
        uid: target.uid,
        email: target.email || null,
        reason: reason || null,
        at: now,
        permanent: true,
      });

      await setDoc(doc(db, "adminEventLogs", `${target.uid}_ban_${Date.now()}`), {
        action: "ban",
        targetUid: target.uid,
        reason: reason || null,
        at: now,
      });

      alert("削除（永久BAN）を適用しました。");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    if (!confirm("このユーザーの停止/削除を解除（復元）しますか？")) return;

    setBusy(true);
    try {
      await updateDoc(doc(db, "users", target.uid), {
        status: "active",
        banned: false,
        deleted: false,
        suspendedUntil: null,
      });

      await deleteDoc(doc(db, "bans", target.uid)).catch(() => {});

      await setDoc(doc(db, "adminEventLogs", `${target.uid}_restore_${Date.now()}`), {
        action: "restore",
        targetUid: target.uid,
        reason: reason || null,
        at: serverTimestamp(),
      });

      alert("復元しました。");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAdminFlag = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // users/{uid} 更新（role を admins コレクションと同期）
      await updateDoc(doc(db, "users", target.uid), {
        role: editAdmin ? "admin" : "user",
      });

      // admins/{uid} 同期
      if (editAdmin) {
        await setDoc(doc(db, "admins", target.uid), {
          manual: true,
          createdAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, "admins", target.uid)).catch(() => {});
      }

      await setDoc(doc(db, "adminEventLogs", `${target.uid}_profile_${Date.now()}`), {
        action: "update_user_flags",
        targetUid: target.uid,
        setAdmin: editAdmin,
        at: serverTimestamp(),
      });

      alert("管理者フラグを保存しました。");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full p-6">
        {/* 状態バナー（停止/BANのときは強調＋上部に復元ボタン） */}
        {!isActive && (
          <div
            className={`mb-4 rounded-xl border p-4 flex items-start gap-3 ${
              isBanned
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <div className="text-2xl leading-none">{isBanned ? "⛔" : "⏸"}</div>
            <div className="flex-1">
              <div className="font-semibold">
                {isBanned ? "このユーザーは永久BAN中です" : "このユーザーは停止中です"}
              </div>
              <div className="text-sm mt-1">
                {isSuspended && isTimestamp(target.suspendedUntil)
                  ? `解除予定: ${target.suspendedUntil.toDate().toLocaleString()}`
                  : isBanned
                  ? "復元でBANを取り消せます。"
                  : ""}
              </div>
            </div>
            <button
              onClick={handleRestore}
              disabled={busy}
              className={`shrink-0 px-4 py-2 rounded font-semibold text-white ${
                isBanned
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              } disabled:opacity-60`}
            >
              🕊 復元する
            </button>
          </div>
        )}

        {/* ヘッダ */}
        <div className="bg-white/90 rounded-xl shadow p-5 border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={target.photoURL || "/avatar-placeholder.png"}
                alt=""
                className="w-12 h-12 rounded-full object-cover bg-gray-200"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{target.name || "未設定"}</h1>
                <p className="text-gray-600 text-sm mt-1">
                  UID: <span className="font-mono">{target.uid}</span>
                </p>
              </div>
            </div>
            {statusBadge}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">メール</div>
              <div className="font-medium text-gray-900 break-all">{target.email || "未設定"}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">都道府県</div>
              <div className="font-medium text-gray-900">{target.prefecture || "未設定"}</div>
            </div>
          </div>
        </div>

        {/* 管理者フラグ編集 */}
        <div className="bg-white/90 rounded-xl shadow p-5 border border-gray-100 mt-6">
          <h2 className="font-semibold text-gray-900">🔧 権限の編集</h2>

          <div className="mt-4">
            <label className="block text-sm text-gray-700 mb-1">管理者</label>
            <div className="flex items-center gap-3">
              <input
                id="adminToggle"
                type="checkbox"
                checked={editAdmin}
                onChange={(e) => setEditAdmin(e.target.checked)}
              />
              <label htmlFor="adminToggle" className="text-sm">
                このユーザーを管理者にする
              </label>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSaveAdminFlag}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              変更を保存
            </button>
          </div>
        </div>

        {/* 理由メモ */}
        <div className="bg-white/90 rounded-xl shadow p-5 border border-gray-100 mt-6">
          <label className="block text-sm text-gray-700 mb-1">理由（任意・管理用）</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black"
            placeholder="停止・BAN・復元・権限変更の理由メモ（任意）"
          />
        </div>

        {/* 停止/BAN/復元 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* 停止 */}
          <div className="bg-white/90 rounded-xl shadow p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-900">⏳ 停止（期限付き）</h3>
            <p className="text-sm text-gray-600 mt-1">
              指定日時までログイン不可。経過後は自動で解除。
            </p>
            <label className="block text-sm text-gray-700 mt-3 mb-1">停止解除日時</label>
            <input
              type="datetime-local"
              value={suspendUntilInput}
              onChange={(e) => setSuspendUntilInput(e.target.value)}
              className="w-full px-3 py-2 border rounded text-black"
            />
            <button
              onClick={handleSuspend}
              disabled={busy}
              className="w-full mt-3 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-60"
            >
              停止を設定
            </button>
          </div>

          {/* 削除（永久BAN） */}
          <div className="bg-white/90 rounded-xl shadow p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-900">🚫 削除（永久BAN）</h3>
            <p className="text-sm text-gray-600 mt-1">
              ログインを永久禁止。bans にも登録します。
            </p>
            <button
              onClick={handleBan}
              disabled={busy}
              className="w-full mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
            >
              永久BANを適用
            </button>
          </div>

          {/* 復元 */}
          <div
            className={`rounded-xl shadow p-5 border ${
              isActive
                ? "bg-emerald-50 border-emerald-200"
                : "bg-emerald-100 border-emerald-300"
            }`}
          >
            <h3 className="font-semibold text-gray-900">🕊 復元</h3>
            <p className="text-sm text-gray-600 mt-1">停止の解除やBANの取り消しを行います。</p>
            <button
              onClick={handleRestore}
              disabled={busy || isActive}
              className={`w-full mt-6 px-4 py-3 rounded font-semibold text-white disabled:opacity-60 ${
                isActive ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isActive ? "現在は有効です" : "🕊 復元する"}
            </button>
          </div>
        </div>

        {/* 戻る */}
        <div className="mt-8 flex items-center gap-3">
          <Link href="/admin/users">
            <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              ← ユーザー一覧へ戻る
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}