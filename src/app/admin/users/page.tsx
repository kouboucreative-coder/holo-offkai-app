// app/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";

type AdminUserRow = {
  uid: string;
  name?: string;
  email?: string;
  prefecture?: string;
  oshi?: string;
  photoURL?: string;

  // 管理者
  isAdmin?: boolean;
};

export default function AdminUsersPage() {
  const [me, setMe] = useState<FirebaseUser | null>(auth.currentUser);
  const [meIsAdmin, setMeIsAdmin] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");

  // 自分の認証監視
  useEffect(() => {
    const un = onAuthStateChanged(auth, (u) => setMe(u));
    return () => un();
  }, []);

  // 管理者チェック + 一覧取得
  useEffect(() => {
    const run = async () => {
      if (!me) {
        setMeIsAdmin(false);
        setUsers([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // 自分が管理者か
        const myAdminSnap = await getDoc(doc(db, "admins", me.uid));
        const isAdmin = myAdminSnap.exists();
        setMeIsAdmin(isAdmin);
        if (!isAdmin) {
          setUsers([]);
          return;
        }

        // users を取得
        const usersRef = collection(db, "users");
        const qy = query(usersRef, orderBy("name", "asc"), limit(500));
        const snap = await getDocs(qy);

        const rows: AdminUserRow[] = [];
        for (const d of snap.docs) {
          const data = d.data() as any;
          const uid = d.id;
          const adminSnap = await getDoc(doc(db, "admins", uid));
          rows.push({
            uid,
            name: data.name ?? data.displayName ?? "名無し",
            email: data.email ?? "",
            prefecture: data.prefecture ?? "",
            oshi: data.oshi ?? "",
            photoURL: data.photoURL ?? "",
            isAdmin: adminSnap.exists(),
          });
        }
        setUsers(rows);
      } catch (e) {
        console.error("Error loading users:", e);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [me]);

  // 検索
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const bag = [
        u.uid,
        u.name ?? "",
        u.email ?? "",
        u.prefecture ?? "",
        u.oshi ?? "",
        u.isAdmin ? "admin" : "user",
      ]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });
  }, [users, search]);

  // 行の一時更新
  const patchRow = (uid: string, patch: Partial<AdminUserRow>) => {
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...patch } : u)));
  };

  // 保存（admins コレクション）
  const saveRow = async (row: AdminUserRow) => {
    try {
      // admins/{uid}
      const aRef = doc(db, "admins", row.uid);
      if (row.isAdmin) {
        await setDoc(aRef, { setAt: Timestamp.now(), setBy: me!.uid });
      } else {
        await deleteDoc(aRef);
      }

      alert("保存しました。");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    }
  };

  if (!me) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-center mt-10">ログインしてください。</p>
        </main>
      </div>
    );
  }

  if (meIsAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <p className="text-center mt-10">読み込み中…</p>
        </main>
      </div>
    );
  }

  if (!meIsAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
        <Navbar />
        <main className="max-w-6xl mx-auto p-6">
          <h1 className="text-center mt-10 text-rose-700 font-bold text-xl">権限がありません（管理者専用）</h1>
          <div className="text-center mt-6">
            <Link href="/" className="text-blue-700 underline">トップへ戻る</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-50 to-gray-300">
      <Navbar />

      <main className="max-w-6xl mx-auto w-full p-6">
        {/* ヘッダ */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👤 ユーザー管理</h1>
            <p className="text-gray-600 mt-1">管理者付与/解除を操作できます。</p>
          </div>

          <Link href="/admin" className="shrink-0">
            <button className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">
              ← 管理者トップへ
            </button>
          </Link>
        </div>

        {/* 検索 */}
        <div className="bg-white/90 p-4 rounded-lg shadow mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前 / メール / UID / 都道府県 / 推し / 権限 を検索…"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
            />
            <button
              onClick={() => setSearch("")}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
            >
              クリア
            </button>
          </div>
        </div>

        {/* リスト */}
        <div className="bg-white/90 rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm font-semibold bg-gray-100">
            <div className="col-span-5 md:col-span-5">ユーザー</div>
            <div className="hidden md:block md:col-span-4">メール</div>
            <div className="col-span-3 md:col-span-2 text-center">管理者</div>
            <div className="col-span-4 md:col-span-1 text-center">保存</div>
          </div>

          {filtered.length === 0 ? (
            <p className="p-6 text-center text-gray-600">該当するユーザーが見つかりません。</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filtered.map((u) => (
                <li key={u.uid} className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
                  {/* ユーザー */}
                  <div className="col-span-5 md:col-span-5 flex items-center gap-3 min-w-0">
                    <img
                      src={u.photoURL || "/avatar-placeholder.png"}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover bg-gray-200"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name || "名無し"}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email || "-"}</p>
                      <p className="text-[11px] text-gray-400 truncate">UID: {u.uid}</p>
                      {(u.prefecture || u.oshi) && (
                        <p className="text-[11px] text-gray-500 truncate">
                          {u.prefecture ? `🏙 ${u.prefecture}` : ""} {u.oshi ? ` / 💖 ${u.oshi}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* メール（md以上） */}
                  <div className="hidden md:block md:col-span-4 truncate text-gray-700">
                    {u.email || "-"}
                  </div>

                  {/* 管理者 */}
                  <div className="col-span-3 md:col-span-2 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={!!u.isAdmin}
                      onChange={(e) => patchRow(u.uid, { isAdmin: e.target.checked })}
                    />
                  </div>

                  {/* 保存 */}
                  <div className="col-span-4 md:col-span-1 text-center">
                    <button
                      onClick={() => saveRow(u)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      保存
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          ※ 管理者付与/解除は admins/{`{uid}`} を操作します。
        </p>
      </main>
    </div>
  );
}
