// app/members/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMemberEmoji } from "@/lib/hololiveMembers";
import Navbar from "@/components/Navbar";
import Link from "next/link";

// ==================== 型 ====================
type Member = {
  uid: string;
  name?: string;
  bio?: string;
  prefecture?: string;
  showPrefecture?: boolean;
  oshi?: string;
  photoURL?: string;
  deleted?: boolean;
  banned?: boolean;
};

// ==================== 定数 ====================
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// ひらがな ↔ カタカナ正規化（検索用）
function toHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// アバターのイニシャル
function getInitials(name?: string) {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

// ==================== メンバーカード ====================
function MemberCard({ member }: { member: Member }) {
  const showPref = member.showPrefecture !== false && member.prefecture;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
      {/* 上部カラーアクセント */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-purple-500" />

      <div className="p-5 flex flex-col flex-1">
        {/* ヘッダー：アバター + 名前 + 都道府県 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shrink-0 select-none">
            {getInitials(member.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {member.name || "名無し"}
            </p>
            {showPref && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <span>📍</span>
                {member.prefecture}
              </p>
            )}
          </div>
        </div>

        {/* 最推し */}
        {member.oshi && (
          <div className="flex items-center gap-2 bg-pink-50 rounded-xl px-3 py-2.5 mb-3">
            <span className="text-lg leading-none select-none shrink-0">
              {getMemberEmoji(member.oshi)}
            </span>
            <div>
              <p className="text-[10px] text-pink-400 font-semibold leading-none mb-0.5">最推し</p>
              <p className="text-sm font-bold text-pink-700 leading-tight truncate">
                {member.oshi}
              </p>
            </div>
          </div>
        )}

        {/* 自己紹介 */}
        {member.bio ? (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1 leading-relaxed mb-4">
            {member.bio}
          </p>
        ) : (
          <div className="flex-1 mb-4" />
        )}

        {/* プロフィールボタン */}
        <Link href={`/profile/${member.uid}`} className="block">
          <div className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-sm text-center hover:shadow-md hover:-translate-y-0.5 transition-all">
            プロフィールを見る →
          </div>
        </Link>
      </div>
    </div>
  );
}

// ==================== メインページ ====================
export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索条件
  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [oshiFilter, setOshiFilter] = useState("");

  // Firestoreからユーザー取得
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), orderBy("name", "asc"))
        );
        const list: Member[] = snap.docs
          .map((d) => ({ uid: d.id, ...(d.data() as Omit<Member, "uid">) }))
          .filter((m) => !m.deleted && !m.banned);
        setMembers(list);
      } catch (err) {
        console.error("メンバー取得失敗:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  // クライアント側フィルタリング
  const filtered = useMemo(() => {
    return members.filter((m) => {
      // キーワード（名前 or 自己紹介）
      if (keyword.trim()) {
        const kw = toHiragana(keyword.toLowerCase());
        const name = toHiragana((m.name ?? "").toLowerCase());
        const bio = toHiragana((m.bio ?? "").toLowerCase());
        if (!name.includes(kw) && !bio.includes(kw)) return false;
      }
      // 都道府県
      if (prefecture && m.prefecture !== prefecture) return false;
      // 最推し（カナ対応）
      if (oshiFilter.trim()) {
        const of = toHiragana(oshiFilter.toLowerCase());
        const oshi = toHiragana((m.oshi ?? "").toLowerCase());
        if (!oshi.includes(of)) return false;
      }
      return true;
    });
  }, [members, keyword, prefecture, oshiFilter]);

  const hasFilter = keyword || prefecture || oshiFilter;

  const clearAll = () => {
    setKeyword("");
    setPrefecture("");
    setOshiFilter("");
  };

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* ページヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">メンバーを探す</h1>
          <p className="text-sm text-gray-400 mt-1">
            同じ推しの仲間を見つけよう
            {!loading && (
              <span className="ml-2 text-blue-600 font-medium">
                {members.length} 人登録中
              </span>
            )}
          </p>
        </div>

        {/* ===== 検索エリア ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* キーワード */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                🔍 キーワード
              </label>
              <div className="relative">
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="名前・自己紹介で検索"
                  className={inputCls}
                />
              </div>
            </div>

            {/* 都道府県 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                📍 都道府県
              </label>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className={inputCls}
              >
                <option value="">すべて</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 最推し */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                💖 最推し
              </label>
              <input
                type="search"
                value={oshiFilter}
                onChange={(e) => setOshiFilter(e.target.value)}
                placeholder="例: さくらみこ"
                className={inputCls}
              />
            </div>
          </div>

          {/* フィルター状態 + クリア */}
          {hasFilter && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{filtered.length} 件</span> ヒット
              </p>
              <button
                onClick={clearAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition"
              >
                フィルターをクリア ×
              </button>
            </div>
          )}
        </div>

        {/* ===== 検索結果 ===== */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-sm">読み込み中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-gray-700 font-semibold mb-1">
              {hasFilter
                ? "条件に合うメンバーが見つかりませんでした"
                : "まだメンバーがいません"}
            </p>
            <p className="text-gray-400 text-sm">
              {hasFilter
                ? "検索条件を変えて再度お試しください"
                : "最初のメンバーになろう！"}
            </p>
            {hasFilter && (
              <button
                onClick={clearAll}
                className="mt-5 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
              >
                条件をリセット
              </button>
            )}
          </div>
        ) : (
          <>
            {!hasFilter && (
              <p className="text-xs text-gray-400 mb-4">
                全 {members.length} 人のメンバー（名前順）
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((m) => (
                <MemberCard key={m.uid} member={m} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* フッター余白 */}
      <div className="h-8" />
    </div>
  );
}
