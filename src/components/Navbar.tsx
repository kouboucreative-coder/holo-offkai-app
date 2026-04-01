// components/Navbar.tsx
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import Link from "next/link";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const unSub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", u.uid))
        );
        const docSnap = snap.docs[0];
        setIsAdmin(!!(docSnap?.exists() && docSnap.data().role === "admin"));
      } catch (e) {
        console.error("管理者権限の確認に失敗:", e);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    });
    return () => unSub();
  }, []);

  useEffect(() => {
    const checkPendingSurvey = async () => {
      const current = auth.currentUser;
      if (!current) return;
      try {
        const q = query(
          collection(db, "surveyAssignments"),
          where("userId", "==", current.uid),
          where("status", "==", "pending"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const surveyId = snap.docs[0].id;
          if (!window.location.pathname.includes("/surveys/")) {
            window.location.href = `/surveys/${surveyId}`;
          }
        }
      } catch (err) {
        console.error("アンケート確認に失敗:", err);
      }
    };
    const timer = setTimeout(checkPendingSurvey, 1000);
    return () => clearTimeout(timer);
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* ロゴ */}
        <Link href="/" className="shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            OffKai
          </span>
        </Link>

        {/* ナビ */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
          <Link href="/" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            ホーム
          </Link>
          <Link href="/events" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            イベント
          </Link>
          <Link href="/mypage" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            マイページ
          </Link>
          <Link href="/chat" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            チャット
          </Link>
        </nav>

        {/* 右側 */}
        <div className="flex items-center gap-2 shrink-0">
          {!checkingRole && isAdmin && (
            <Link href="/admin">
              <span className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:shadow-md transition cursor-pointer">
                管理
              </span>
            </Link>
          )}
          {user ? (
            <>
              <span className="hidden md:block text-sm text-gray-600 max-w-[130px] truncate">
                {user.displayName}
              </span>
              <button
                onClick={logout}
                className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="px-4 py-1.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-md transition"
            >
              Googleでログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
