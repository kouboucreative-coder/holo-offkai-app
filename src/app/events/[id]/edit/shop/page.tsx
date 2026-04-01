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

export default function ShopEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = auth.currentUser;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [meetingPlace, setMeetingPlace] = useState("");
  const [shops, setShops] = useState<string[]>([""]);
  const [prefectures, setPrefectures] = useState<string[]>([""]);
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
          setItems(data.items?.length ? data.items : [""]);
          setMeetingPlace(data.meetingPlace || "");
          setShops(data.shops?.length ? data.shops : [""]);
          setPrefectures(data.prefectures?.length ? data.prefectures : [""]);
        }
      } catch (err) {
        console.error("Error loading shop event:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  // 募集人数の調整
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
        items,
        meetingPlace,
        shops,
        prefectures,
      });
      alert("ショップ巡りイベントを更新しました！");
      router.push(`/events/${id}/shop`);
    } catch (err) {
      console.error("Error updating shop event:", err);
      alert("更新に失敗しました");
    }
  };

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;

  // 店・都道府県の追加削除操作
  const updateList = (list: string[], setList: (val: string[]) => void, index: number, value: string) => {
    const next = [...list];
    next[index] = value;
    setList(next);
  };
  const removeItem = (list: string[], setList: (val: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-200 via-purple-100 to-pink-300 flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-red-600 mb-6">🏬 ショップ巡りオフ会を編集</h1>

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

          {/* 持ち物 */}
          <label className="block text-gray-800">持ち物</label>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" value={item} onChange={(e) => updateList(items, setItems, idx, e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-black" />
              <button type="button" onClick={() => removeItem(items, setItems, idx)}
                className="px-3 py-2 bg-red-500 text-white rounded">削除</button>
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, ""])}
            className="px-3 py-2 bg-blue-500 text-white rounded">＋ 持ち物を追加</button>

          {/* 集合場所 */}
          <label className="block text-gray-800">集合場所</label>
          <input type="text" value={meetingPlace} onChange={(e) => setMeetingPlace(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black" />

          {/* めぐる店 */}
          <label className="block text-gray-800">めぐる店</label>
          {shops.map((shop, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input type="text" value={shop} onChange={(e) => updateList(shops, setShops, idx, e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-black" />
              <button type="button" onClick={() => removeItem(shops, setShops, idx)}
                className="px-3 py-2 bg-red-500 text-white rounded">削除</button>
            </div>
          ))}
          <button type="button" onClick={() => setShops([...shops, ""])}
            className="px-3 py-2 bg-blue-500 text-white rounded">＋ 店を追加</button>

          {/* 都道府県 */}
          <label className="block text-gray-800">都道府県</label>
          {prefectures.map((pref, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <select value={pref} onChange={(e) => updateList(prefectures, setPrefectures, idx, e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-black">
                <option value="">選択してください</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeItem(prefectures, setPrefectures, idx)}
                className="px-3 py-2 bg-red-500 text-white rounded">削除</button>
            </div>
          ))}
          <button type="button" onClick={() => setPrefectures([...prefectures, ""])}
            className="px-3 py-2 bg-green-500 text-white rounded">＋ 都道府県を追加</button>

          {/* ボタン */}
          <div className="flex gap-2 mt-6">
            <button onClick={handleUpdate}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
              更新する
            </button>
            <button onClick={() => router.push(`/events/${id}/shop`)}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
              ← 詳細に戻る
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}