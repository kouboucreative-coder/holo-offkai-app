// app/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

type UserStatus = "active" | "suspended" | "banned";

type AdminUserRow = {
  uid: string;
  name: string;
  email: string;
  prefecture: string;
  oshi: string;
  role: string;
  status: UserStatus;
  createdAt: Timestamp | string | null;
  profileCompleted: boolean;
};

type FilterKey = "all" | "active" | "admin" | "suspended" | "banned";
type SortKey = "newest" | "name";

function deriveStatus(data: Record<string, unknown>): UserStatus {
  if (data.banned === true || data.status === "banned") return "banned";
  if (data.status === "suspended") {
    const until = data.suspendedUntil as Timestamp | null | undefined;
    if (until && typeof (until as Timestamp).toDate === "function") {
      if ((until as Timestamp).toDate() > new Date()) return "suspended";
    } else if (until) {
      return "suspended";
    }
  }
  return "active";
}

function StatusBadge({ status }: { status: UserStatus }) {
  const map = {
    banned: "⛔ BAN中",
    suspended: "⏸ 停止中",
    active: "通常",
  };
  const cls = {
    banned: "bg-red-100 text-red-700 border-red-200",
    suspended: "bg-amber-100 text-amber-700 border-amber-200",
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cls[status]}`}
    >
      {map[status]}
    </span>
  );
}

function getCreatedAtMs(v: Timestamp | string | null): number {
  if (!v) return 0;
  if (typeof (v as Timestamp).toMillis === "function")
    return (v as Timestamp).toMillis();
  if (typeof v === "string") return new Date(v).getTime() || 0;
  return 0;
}

function formatDate(v: Timestamp | string | null): string {
  if (!v) return "-";
  try {
    const d =
      typeof (v as Timestamp).toDate === "function"
        ? (v as Timestamp).toDate()
        : new Date(v as string);
    return d.toLocaleDateString("ja-JP");
  } catch {
    return "-";
  }
}

export default function AdminUsersPage() {
  const [me, setMe] = useState<FirebaseUser | null>(auth.currentUser);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    const un = onAuthStateChanged(auth, (u) => setMe(u));
    return () => un();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!me) {
        setMeIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const adminSnap = await getDoc(doc(db, "admins", me.uid));
        if (!adminSnap.exists()) {
          setMeIsAdmin(false);
          return;
        }
        setMeIsAdmin(true);

        const snap = await getDocs(collection(db, "users"));
        const rows: AdminUserRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            uid: d.id,
            name: (data.name as string) || (data.displayName as string) || "名無し",
            email: (data.email as string) || "",
            prefecture: (data.prefecture as string) || "",
            oshi: (data.oshi as string) || "",
            role: (data.role as string) || "user",
            status: deriveStatus(data),
            createdAt: (data.createdAt as Timestamp | string | null) ?? null,
            profileCompleted: data.profileCompleted === true,
          };
        });
        setUsers(rows);
      } catch (e) {
        console.error("Error loading users:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [me]);

  const filtered = useMemo(() => {
    let list = [...users];

    // フィルター
    if (filter === "active")
      list = list.filter((u) => u.status === "active" && u.role !== "admin");
    else if (filter === "admin") list = list.filter((u) => u.role === "admin");
    else if (filter === "suspended")
      list = list.filter((u) => u.status === "suspended");
    else if (filter === "banned") list = list.filter((u) => u.status === "banned");

    // 検索
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        [u.uid, u.name, u.email, u.prefecture, u.oshi, u.role]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    // ソート
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    } else {
      list.sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
    }
    return list;
  }, [users, search, filter, sort]);

  const counts = useMemo(
    () => ({
      all: users.length,
      active: users.filter((u) => u.status === "active" && u.role !== "admin").length,
      admin: users.filter((u) => u.role === "admin").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      banned: users.filter((u) => u.status === "banned").length,
    }),
    [users]
  );

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
        <p className="text-center mt-20 text-rose-700 font-bold text-xl">
          権限がありません（管理者専用）
        </p>
      </div>
    );
  }

  const FILTERS: { key: FilterKey; label: string; danger?: boolean }[] = [
    { key: "all", label: `全員 (${counts.all})` },
    { key: "active", label: `通常 (${counts.active})` },
    { key: "admin", label: `管理者 (${counts.admin})` },
    { key: "suspended", label: `停止中 (${counts.suspended})` },
    { key: "banned", label: `BAN (${counts.banned})`, danger: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200">
      <Navbar />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:px-6">

        {/* ヘッダ */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">👤 ユーザー管理</h1>
            <p className="text-gray-500 text-sm mt-1">登録ユーザー {users.length} 人</p>
          </div>
          <Link href="/admin">
            <button className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm shrink-0">
              ← 管理トップ
            </button>
          </Link>
        </div>

        {/* 検索 & ソート */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前 / メール / UID / 推し / 都道府県 で検索"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm text-gray-800"
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">並び順:</span>
            {(["newest", "name"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                  sort === s
                    ? "bg-gray-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "newest" ? "新しい順" : "名前順"}
              </button>
            ))}
          </div>
        </div>

        {/* フィルタータブ */}
        <div className="flex gap-2 flex-wrap mb-4">
          {FILTERS.map(({ key, label, danger }) => {
            const isActive = filter === key;
            let cls = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";
            if (isActive) {
              if (danger) cls = "bg-red-600 text-white border-red-600";
              else if (key === "suspended") cls = "bg-amber-500 text-white border-amber-500";
              else if (key === "admin") cls = "bg-blue-600 text-white border-blue-600";
              else cls = "bg-gray-700 text-white border-gray-700";
            }
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${cls}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* テーブル */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">
                {search
                  ? `「${search}」に一致するユーザーが見つかりません`
                  : "該当するユーザーがいません"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">ユーザー</th>
                    <th className="px-4 py-3 hidden md:table-cell">都道府県 / 推し</th>
                    <th className="px-4 py-3 hidden sm:table-cell">役割</th>
                    <th className="px-4 py-3">状態</th>
                    <th className="px-4 py-3 hidden lg:table-cell">登録日</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => (
                    <tr
                      key={u.uid}
                      className={`hover:bg-gray-50 transition ${
                        u.status === "banned"
                          ? "bg-red-50/40"
                          : u.status === "suspended"
                          ? "bg-amber-50/40"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 truncate max-w-[160px]">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[160px]">
                          {u.email || "-"}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">
                          {u.uid}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">
                        <div>{u.prefecture || "-"}</div>
                        <div className="text-gray-400">{u.oshi || "-"}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {u.role === "admin" ? (
                          <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            admin
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">user</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/users/${u.uid}`}>
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
          {filtered.length} / {users.length} 件表示
        </p>
      </main>
    </div>
  );
}
