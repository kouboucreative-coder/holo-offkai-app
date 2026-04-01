// app/admin/events/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";

type AdminEvent = {
  id: string;
  title?: string;
  date?: string;
  timeStart?: string;
  timeEnd?: string;
  description?: string;
  capacity?: number;
  participants?: { uid: string; name: string }[];
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;

  // 管理用フラグ
  isHidden?: boolean;   // 一覧にも詳細にも出さない
  joinOpen?: boolean;   // 参加受付（false で新規参加停止）
};

export default function AdminEventDetailPage() {
  // id は string | string[] | undefined の可能性があるため正規化
  const params = useParams();
  const raw = params?.id as string | string[] | undefined;
  const eventId = Array.isArray(raw) ? raw[0] : raw ?? "";

  const router = useRouter();

  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [ev, setEv] = useState<AdminEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  // ===== 管理者チェック =====
  useEffect(() => {
    const check = async () => {
      const me = auth.currentUser;
      if (!me) {
        router.push("/");
        return;
      }
      const snap = await getDoc(doc(db, "users", me.uid));
      const role = snap.exists() ? (snap.data() as any).role : undefined;
      if (role === "admin") setMeIsAdmin(true);
      else {
        setMeIsAdmin(false);
        router.push("/");
      }
    };
    check().catch(() => {
      setMeIsAdmin(false);
      router.push("/");
    });
  }, [router]);

  // ===== イベント取得 =====
  useEffect(() => {
    if (!eventId) return;
    const run = async () => {
      try {
        const ref = doc(db, "events", eventId);
        const s = await getDoc(ref);
        setEv(s.exists() ? ({ id: s.id, ...(s.data() as any) } as AdminEvent) : null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [eventId]);

  const statusBadge = useMemo(() => {
    if (!ev) return null;
    if (ev.isHidden) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700 border border-gray-300">
          非表示
        </span>
      );
    }
    if (ev.joinOpen === false) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-amber-200 text-amber-800 border border-amber-300">
          参加停止
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
        公開中
      </span>
    );
  }, [ev]);

  if (meIsAdmin === null || loading) {
    return <p className="text-center mt-10">読み込み中...</p>;
  }
  if (!meIsAdmin) {
    return <p className="text-center mt-10">アクセス権限がありません。</p>;
  }
  if (!ev) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-3xl mx-auto p-6">
          <p>イベントが見つかりません。</p>
          <Link
            href="/admin/events"
            className="inline-block mt-4 px-3 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            ← 一覧に戻る
          </Link>
        </main>
      </div>
    );
  }

  // ===== 操作 =====
  const hideEvent = async () => {
    if (busy) return;
    if (!confirm("このイベントを『非表示 + 新規参加停止』にします。よろしいですか？")) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "events", ev.id), { isHidden: true, joinOpen: false });
      await setDoc(doc(db, "adminEventLogs", `${ev.id}_hide_${Date.now()}`), {
        eventId: ev.id,
        action: "hide",
        reason: reason || null,
        at: new Date().toISOString(),
      });
      alert("非表示にしました。（新規参加も停止）");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const unhideEvent = async () => {
    if (busy) return;
    if (!confirm("このイベントを再表示（公開 & 参加受付ON）しますか？")) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "events", ev.id), { isHidden: false, joinOpen: true });
      await setDoc(doc(db, "adminEventLogs", `${ev.id}_unhide_${Date.now()}`), {
        eventId: ev.id,
        action: "unhide",
        reason: reason || null,
        at: new Date().toISOString(),
      });
      alert("再表示しました。");
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async () => {
    if (busy) return;
    if (!confirm("このイベントを完全に削除します。元に戻せません。よろしいですか？")) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "adminEventLogs", `${ev.id}_delete_${Date.now()}`), {
        eventId: ev.id,
        action: "delete",
        reason: reason || null,
        at: new Date().toISOString(),
      });
      await deleteDoc(doc(db, "events", ev.id));
      alert("削除しました。");
      router.push("/admin/events");
    } finally {
      setBusy(false);
    }
  };

  const toggleJoinOpen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = ev.joinOpen === false ? true : false;
      await updateDoc(doc(db, "events", ev.id), { joinOpen: next });
      await setDoc(doc(db, "adminEventLogs", `${ev.id}_join_${Date.now()}`), {
        eventId: ev.id,
        action: next ? "join_open" : "join_close",
        reason: reason || null,
        at: new Date().toISOString(),
      });
      alert(`参加受付を${next ? "ON" : "OFF"}にしました。`);
      router.refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full p-6">
        {/* ヘッダ */}
        <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">イベント詳細（管理）</h1>
              <p className="text-gray-600 text-sm mt-1">
                ID: <span className="font-mono">{ev.id}</span>
              </p>
            </div>
            {statusBadge}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">タイトル</div>
              <div className="font-medium text-gray-900">{ev.title || "(無題)"}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">開催日 / 時間</div>
              <div className="font-medium text-gray-900">
                {ev.date || "-"} {ev.timeStart && ` ${ev.timeStart}`} {ev.timeEnd && ` - ${ev.timeEnd}`}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">主催者</div>
              <div className="font-medium text-gray-900">
                {ev.createdByName || ev.createdBy || "-"}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-gray-500">参加状況</div>
              <div className="font-medium text-gray-900">
                👥 {(ev.participants?.length ?? 0)}/{ev.capacity ?? "-"}
              </div>
            </div>
          </div>

          {ev.description && (
            <div className="mt-3 bg-gray-50 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
              {ev.description}
            </div>
          )}
        </div>

        {/* 理由メモ */}
        <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-5 mt-6">
          <label className="block text-sm text-gray-700 mb-1">理由（任意・管理メモ）</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black"
            placeholder="非表示/再表示/削除/参加停止の理由（任意）"
          />
        </div>

        {/* 操作 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* 非表示 */}
          <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900">🙈 非表示（+ 参加停止）</h2>
            <p className="text-sm text-gray-600 mt-1">
              一覧・詳細に出さず、新規参加も停止します。
            </p>
            <button
              disabled={busy}
              onClick={hideEvent}
              className="w-full mt-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-60"
            >
              非表示にする
            </button>
          </div>

          {/* 再表示 */}
          <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900">🔁 再表示</h2>
            <p className="text-sm text-gray-600 mt-1">
              公開し、参加受付も ON に戻します。
            </p>
            <button
              disabled={busy}
              onClick={unhideEvent}
              className="w-full mt-4 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
            >
              再表示する
            </button>
          </div>

          {/* 参加受付のON/OFFのみ切替 */}
          <div className="bg-white/90 rounded-xl shadow border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900">🚧 参加受付の切替</h2>
            <p className="text-sm text-gray-600 mt-1">
              公開状態のまま、新規参加のみ停止/再開します。
            </p>
            <button
              disabled={busy}
              onClick={toggleJoinOpen}
              className="w-full mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-60"
            >
              {ev.joinOpen === false ? "参加受付を再開する" : "新規参加を停止する"}
            </button>
          </div>
        </div>

        {/* 危険操作 */}
        <div className="bg-white/90 rounded-xl shadow border border-red-200 p-5 mt-6">
          <h2 className="font-semibold text-red-700">🗑 削除（不可逆）</h2>
          <p className="text-sm text-red-600 mt-1">
            完全に削除します。元に戻せません。
          </p>
          <button
            disabled={busy}
            onClick={deleteEvent}
            className="w-full md:w-auto mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
          >
            イベントを削除する
          </button>
        </div>

        {/* 戻る */}
        <div className="mt-8">
          <Link
            href="/admin/events"
            className="inline-block px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
          >
            ← イベント一覧へ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}