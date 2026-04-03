"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import Link from "next/link";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

export default function SocialCreatePage() {
  const router = useRouter();
  const user = auth.currentUser;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [prefecture, setPrefecture] = useState("");

  const changeCapacity = (diff: number) => {
    setCapacity((prev) => Math.max(2, prev + diff));
  };

  const handleSubmit = async () => {
    if (!user) {
      alert("ログインしてください");
      return;
    }
    if (
      !title.trim() ||
      !date.trim() ||
      !timeStart.trim() ||
      !timeEnd.trim() ||
      !venue.trim() ||
      !address.trim() ||
      !prefecture.trim()
    ) {
      alert("全ての必須項目を入力してください");
      return;
    }
    try {
      await addDoc(collection(db, "events"), {
        genre: "social",
        title,
        date,
        timeStart,
        timeEnd,
        description,
        capacity,
        venue,
        address,
        prefecture,
        createdBy: user.uid,
        createdByName: user.displayName || "名無し",
        participants: [],
        createdAt: serverTimestamp(),
        surveyCompleted: false,
      });
      alert("🤝 交流会イベントを作成しました！");
      router.push("/events");
    } catch (err) {
      console.error("Error creating social event:", err);
      alert("イベント作成に失敗しました");
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <Link href="/events/create" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          ← ジャンル選択に戻る
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-medium px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full">交流会</span>
          <h1 className="text-2xl font-bold text-gray-900">イベントを作成</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <label className={labelCls}>タイトル *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>日付 *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>開始・終了時間 *</label>
            <div className="flex gap-2">
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className={inputCls} />
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>募集人数</label>
            <div className="flex items-center gap-2">
              <button onClick={() => changeCapacity(-10)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">-10</button>
              <button onClick={() => changeCapacity(-1)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">-1</button>
              <span className="px-5 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm">{capacity}</span>
              <button onClick={() => changeCapacity(1)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">+1</button>
              <button onClick={() => changeCapacity(10)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">+10</button>
            </div>
          </div>

          <div>
            <label className={labelCls}>詳細説明</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>会場名 *</label>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="例: ○○カフェ、△△コミュニティスペース" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>住所 *</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例: 東京都渋谷区○○1-2-3" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>都道府県 *</label>
            <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className={inputCls}>
              <option value="">選択してください</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 hover:-translate-y-0.5 transition-all shadow-sm">
              作成する
            </button>
            <button onClick={() => router.push("/events/create")} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition">
              キャンセル
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
