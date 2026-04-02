// components/Navbar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 認証 & 管理者チェック
  useEffect(() => {
    const unSub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }
      try {
        const [userSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, "users", u.uid)),
          getDoc(doc(db, "admins", u.uid)),
        ]);
        setIsAdmin(
          adminSnap.exists() ||
          !!(userSnap.exists() && userSnap.data().role === "admin")
        );
      } catch (e) {
        console.error("管理者権限の確認に失敗:", e);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    });
    return () => unSub();
  }, []);

  // アンケートチェック
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

  // メニュー外タップで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // ページ遷移でメニューを閉じる
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };
  const logout = async () => {
    await signOut(auth);
    setMenuOpen(false);
  };

  // アクティブ判定
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // ナビリンク定義（管理者リンクは条件付き）
  const navLinks = [
    { href: "/", label: "ホーム", icon: "🏠" },
    { href: "/events", label: "イベント", icon: "📅" },
    { href: "/members", label: "メンバー", icon: "👥" },
    { href: "/mypage", label: "マイページ", icon: "👤" },
    { href: "/chat", label: "チャット", icon: "💬" },
    ...(!checkingRole && isAdmin ? [{ href: "/admin", label: "管理", icon: "⚙️" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* ===== スマホ: ロゴ + ドロップダウン ===== */}
        <div className="md:hidden relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 py-2 pr-1"
            aria-label="メニューを開く"
          >
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              OffKai
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* ドロップダウンメニュー */}
          {menuOpen && (
            <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              {/* ユーザー情報 */}
              {user && (
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-gray-200">
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName ?? "アイコン"}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {user.displayName?.charAt(0) ?? "U"}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {user.displayName ?? "ユーザー"}
                  </p>
                </div>
              )}

              {/* ナビリンク */}
              <nav className="py-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-5 min-h-[52px] text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    }`}
                  >
                    <span className="text-base w-5 text-center">{link.icon}</span>
                    {link.label}
                    {isActive(link.href) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </Link>
                ))}
              </nav>

              {/* ログアウト / ログイン */}
              <div className="border-t border-gray-100 py-2">
                {user ? (
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-5 min-h-[52px] text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <span className="text-base w-5 text-center">🚪</span>
                    ログアウト
                  </button>
                ) : (
                  <button
                    onClick={() => { login(); setMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-5 min-h-[52px] text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-base w-5 text-center">🔑</span>
                    Googleでログイン
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== PC: ロゴ ===== */}
        <Link href="/" className="shrink-0 hidden md:block">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            OffKai
          </span>
        </Link>

        {/* ===== PC: ナビ ===== */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                isActive(link.href)
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ===== PC: 右側（ユーザー名・ログアウト） ===== */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName ?? "アイコン"}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.displayName?.charAt(0) ?? "U"}
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-600 max-w-[120px] truncate">
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

        {/* ===== スマホ右側: ログインボタン（未ログイン時のみ） ===== */}
        {!user && (
          <button
            onClick={login}
            className="md:hidden px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-md transition"
          >
            ログイン
          </button>
        )}
      </div>
    </header>
  );
}
