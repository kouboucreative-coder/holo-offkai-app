// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const u = auth.currentUser;
      if (!u) {
        router.push("/");
        return;
      }
      try {
        const [userSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, "users", u.uid)),
          getDoc(doc(db, "admins", u.uid)),
        ]);
        const roleIsAdmin = userSnap.exists() && userSnap.data().role === "admin";
        const inAdmins = adminSnap.exists();
        if (roleIsAdmin || inAdmins) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push("/");
        }
      } catch (err) {
        console.error("Error checking admin role:", err);
        setIsAdmin(false);
        router.push("/");
      }
    };
    checkAdmin();
  }, [router]);

  if (isAdmin === null) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-400">確認中...</p>
    </div>
  );
  if (!isAdmin) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-500">アクセス権限がありません。</p>
    </div>
  );

  const cards = [
    {
      href: "/admin/events",
      emoji: "📅",
      label: "イベント",
      title: "イベント管理",
      desc: "イベントの非表示・削除・詳細確認。",
      from: "from-emerald-400/80",
      to: "to-green-500/80",
    },
    {
      href: "/admin/users",
      emoji: "👤",
      label: "ユーザー",
      title: "ユーザー管理",
      desc: "ユーザー一覧・権限変更・アカウント制御。",
      from: "from-sky-400/80",
      to: "to-blue-500/80",
    },
    {
      href: "/admin/reports",
      emoji: "🚨",
      label: "通報",
      title: "通報管理",
      desc: "イベント・ユーザー通報の確認と対応。",
      from: "from-rose-400/80",
      to: "to-red-500/80",
    },
    {
      href: "/admin/notice",
      emoji: "📢",
      label: "お知らせ",
      title: "お知らせ管理",
      desc: "お知らせの作成・編集・公開停止。",
      from: "from-amber-400/80",
      to: "to-yellow-400/80",
    },
    {
      href: "/admin/surveys",
      emoji: "📝",
      label: "アンケート",
      title: "アンケート管理",
      desc: "アンケートの作成・配布・結果確認。",
      from: "from-indigo-400/80",
      to: "to-violet-500/80",
    },
    {
      href: "/admin/data",
      emoji: "📊",
      label: "データ",
      title: "データ管理",
      desc: "メトリクス確認・データ集計・エクスポート。",
      from: "from-purple-400/80",
      to: "to-indigo-500/80",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">管理者ページ</h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            お知らせ、ユーザー・イベント管理、データ・アンケートの確認ができます。
          </p>
          <Link href="/admin/data">
            <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all">
              📊 データ管理へ移動
            </button>
          </Link>
        </div>

        {/* 管理カード 2×3グリッド */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="group block">
              <div className={`h-full rounded-2xl bg-gradient-to-br ${card.from} ${card.to} text-white shadow-sm p-5 transition-all group-hover:-translate-y-1 group-hover:shadow-md`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{card.emoji}</span>
                  <span className="text-xs bg-white/25 px-2.5 py-1 rounded-full font-medium">{card.label}</span>
                </div>
                <h2 className="text-lg font-bold mb-1">{card.title}</h2>
                <p className="text-white/80 text-sm leading-relaxed">{card.desc}</p>
                <div className="mt-4 text-sm font-semibold opacity-80 group-hover:opacity-100 transition">
                  管理ページへ →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 運用メモ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-3">運用メモ</h3>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span>違反対応は利用規約に準拠してください。</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span>緊急時はイベントを非公開→主催者へ連絡。</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span>凍結・BANの解除手順は管理ログに必ず記録。</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
