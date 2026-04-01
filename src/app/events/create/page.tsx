"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const GENRES = [
  {
    id: "shop",
    label: "ショップ巡り",
    emoji: "🛍️",
    href: "/events/create/shop",
    badge: "bg-pink-50 text-pink-600",
    desc: "グッズショップやコラボカフェなど複数の店舗を一緒に回るオフ会。例：秋葉原のホロショップを数軒巡って戦利品を見せ合う",
  },
  {
    id: "food",
    label: "飲食",
    emoji: "🍽️",
    href: "/events/create/food",
    badge: "bg-green-50 text-green-600",
    desc: "カフェ・ファミレス・居酒屋などで集まって食事・歓談するオフ会。例：推しコラボカフェで一緒にメニューを楽しむ",
  },
  {
    id: "karaoke",
    label: "カラオケ",
    emoji: "🎤",
    href: "/events/create/karaoke",
    badge: "bg-indigo-50 text-indigo-600",
    desc: "カラオケボックスでホロライブ楽曲を一緒に歌うオフ会。例：新曲リリース記念でみんなで熱唱",
  },
  {
    id: "social",
    label: "交流会",
    emoji: "🤝",
    href: "/events/create/social",
    badge: "bg-orange-50 text-orange-600",
    desc: "特定の活動はせず、同じ推しを持つファン同士でゆるく話して交流するオフ会。例：推し談義をしながらまったり集まる",
  },
  {
    id: "viewing",
    label: "観賞会",
    emoji: "🎬",
    href: "/events/create/viewing",
    badge: "bg-rose-50 text-rose-600",
    desc: "ライブ配信・3Dライブ・コンサートBDなどを一緒に観るオフ会。例：3Dライブをみんなでリアルタイム視聴",
  },
  {
    id: "small-hall",
    label: "小規模会場レンタル",
    emoji: "🏠",
    href: "/events/create/small-hall",
    badge: "bg-sky-50 text-sky-600",
    desc: "会議室や小ホールを借りて10〜30人規模のイベントを行う。例：貸し会議室でトークイベントや企画を開催",
  },
  {
    id: "large-hall",
    label: "大規模会場レンタル",
    emoji: "🏢",
    href: "/events/create/large-hall",
    badge: "bg-purple-50 text-purple-600",
    desc: "大ホールや複合施設を借りて50人以上規模のイベントを行う。例：大型会場でライブビューイングや合同誕生祭を開催",
  },
  {
    id: "goods-exchange",
    label: "グッズ交換",
    emoji: "🔄",
    href: "/events/create/goods-exchange",
    badge: "bg-amber-50 text-amber-600",
    desc: "推しのグッズを持ち寄ってトレード・物々交換するオフ会。例：アクリルスタンドや缶バッジを交換し合う",
  },
  {
    id: "other",
    label: "その他",
    emoji: "✨",
    href: "/events/create/other",
    badge: "bg-gray-100 text-gray-600",
    desc: "上記以外のジャンルのオフ会。例：ボードゲーム会・スポーツ観戦・聖地巡礼など",
  },
];

export default function EventCreatePage() {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  const toggleTooltip = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenTooltip((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          ← イベント一覧に戻る
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">イベントを作成</h1>
        <p className="text-sm text-gray-500 mb-8">開催したいオフ会のジャンルを選んでください</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GENRES.map((genre) => (
            <div key={genre.id} className="relative">
              <Link href={genre.href} className="block">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{genre.emoji}</span>
                    <span className="font-semibold text-gray-900">{genre.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleTooltip(genre.id, e)}
                    className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition ${
                      openTooltip === genre.id
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    aria-label="詳細を見る"
                  >
                    ℹ
                  </button>
                </div>
              </Link>

              {openTooltip === genre.id && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-gray-900 text-white text-xs p-3 rounded-xl shadow-lg">
                  {genre.desc}
                  <div className="absolute -top-1.5 left-6 w-3 h-3 bg-gray-900 rotate-45" />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
