"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";

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

export default function KaraokeEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = auth.currentUser;

  // フォーム用のstate
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [description, setDescription] = useState("");
  const [karaokeShop, setKaraokeShop] = useState("");
  const [address, setAddress] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [payment, setPayment] = useState("self");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(true);

  // イベント読み込み
  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const ref = doc(db, "events", id as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || "");
          setDate(data.date || "");
          setTimeStart(data.timeStart || "");
          setTimeEnd(data.timeEnd || "");
          setCapacity(data.capacity || 2);
          setDescription(data.description || "");
          setKaraokeShop(data.karaokeShop || "");
          setAddress(data.address || "");
          setPrefecture(data.prefecture || "");
          setPayment(data.payment || "self");
          setAmount(data.amount || "");
        }
      } catch (err) {
        console.error("Error loading karaoke event:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  // 募集人数
  const changeCapacity = (diff: number) => {
    setCapacity((prev) => Math.max(2, prev + diff));
  };

  // 更新処理
  const handleUpdate = async () => {
    if (!user) {
      alert("ログインしてください");
      return;
    }
    try {
      if (!id) return;
      const ref = doc(db, "events", id as string);
      await updateDoc(ref, {
        title,
        date,
        timeStart,
        timeEnd,
        capacity,
        description,
        karaokeShop,
        address,
        prefecture,
        payment,
        amount: payment === "split" ? amount : null,
      });
      alert("カラオケイベントを更新しました！");
      router.push(`/events/${id}/karaoke`);
    } catch (err) {
      console.error("Error updating karaoke event:", err);
      alert("更新に失敗しました");
    }
  };

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-300 via-indigo-100 to-indigo-400 flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-indigo-700 mb-6">🎤 カラオケオフ会を編集</h1>

        <div className="bg-white/90 p-6 rounded-lg shadow space-y-4">
          {/* タイトル */}
          <label className="block text-gray-800">タイトル</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black" />

          {/* 日付 */}
          <label className="block text-gray-800">日付</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black" />

          {/* 開始・終了時間 */}
          <label className="block text-gray-800">開始・終了時間</label>
          <div className="flex gap-2">
            <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-black" />
            <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-black" />
          </div>

          {/* 募集人数 */}
          <label className="block text-gray-800">募集人数</label>
          <div className="flex items-center gap-2">
            <button onClick={() => changeCapacity(-10)} className="px-2 py-1 bg-red-400 text-white rounded">-10</button>
            <button onClick={() => changeCapacity(-1)} className="px-2 py-1 bg-red-300 text-white rounded">-1</button>
            <span className="px-4 py-2 bg-yellow-200 text-black font-bold rounded">{capacity}</span>
            <button onClick={() => changeCapacity(1)} className="px-2 py-1 bg-green-300 text-white rounded">+1</button>
            <button onClick={() => changeCapacity(10)} className="px-2 py-1 bg-green-400 text-white rounded">+10</button>
          </div>

          {/* 詳細説明 */}
          <label className="block text-gray-800">詳細説明</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} className="w-full px-3 py-2 border rounded text-black" />

          {/* カラオケ店名 */}
          <label className="block text-gray-800">カラオケ店名</label>
          <input type="text" value={karaokeShop} onChange={(e) => setKaraokeShop(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black" />

          {/* 住所 */}
          <label className="block text-gray-800">住所</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black" />

          {/* 都道府県 */}
          <label className="block text-gray-800">都道府県</label>
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black">
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* 支払い方法 */}
          <label className="block text-gray-800">支払い方法</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-black">
              <input type="radio" value="self" checked={payment === "self"} onChange={() => setPayment("self")} />
              自腹
            </label>
            <label className="flex items-center gap-2 text-black">
              <input type="radio" value="split" checked={payment === "split"} onChange={() => setPayment("split")} />
              割り勘
            </label>
          </div>

          {payment === "split" && (
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="割り勘の金額を入力（円）" className="w-full px-3 py-2 border rounded text-black" />
          )}

          {/* ボタン */}
          <div className="flex gap-2 mt-6">
            <button onClick={handleUpdate}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              更新する
            </button>
            <button onClick={() => router.push(`/events/${id}/karaoke`)}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
              ← 詳細に戻る
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}