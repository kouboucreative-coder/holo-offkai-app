"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

const BASE_ACTIVITIES = [
  { key: "chat", label: "交流会・雑談会" },
  { key: "goods", label: "グッズ交換" },
  { key: "exhibit", label: "展示会" },
  { key: "watch", label: "視聴会" },
  { key: "tournament", label: "ゲーム大会" },
  { key: "make", label: "制作作業" },
];

type CustomActivity = {
  label: string;
  checked: boolean;
  details: string;
};

export default function LargeHallCreatePage() {
  const router = useRouter();
  const user = auth.currentUser;

  // 基本情報
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [capacity, setCapacity] = useState(2);
  const [description, setDescription] = useState("");

  // 会場
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [prefecture, setPrefecture] = useState("");

  // 支払い
  const [payType, setPayType] = useState<"self" | "split">("self");
  const [splitFee, setSplitFee] = useState("");

  // 活動内容
  const [selected, setSelected] = useState<string[]>([]);
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);

  const [items, setItems] = useState("");

  // 募集人数
  const changeCapacity = (diff: number) => {
    setCapacity((prev) => Math.max(2, prev + diff));
  };

  // 基本活動
  const toggleBaseActivity = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // カスタム活動
  const addCustomActivity = () => {
    setCustomActivities((prev) => [
      ...prev,
      { label: "", checked: true, details: "" }, // ✅ 最初からON
    ]);
  };

  const updateCustomLabel = (idx: number, label: string) => {
    const next = [...customActivities];
    next[idx].label = label;
    setCustomActivities(next);
  };

  const toggleCustomChecked = (idx: number) => {
    const next = [...customActivities];
    next[idx].checked = !next[idx].checked;
    setCustomActivities(next);
  };

  const updateCustomDetails = (idx: number, details: string) => {
    const next = [...customActivities];
    next[idx].details = details;
    setCustomActivities(next);
  };

  const removeCustomActivity = (idx: number) => {
    setCustomActivities(customActivities.filter((_, i) => i !== idx));
  };

  // バリデーション
  const validate = () => {
    const hasBase = selected.length > 0;
    const hasCustom = customActivities.some(
      (c) => c.checked && c.label.trim() && c.details.trim() // ✅ detailsも必須
    );

    if (
      !title.trim() ||
      !date.trim() ||
      !timeStart.trim() ||
      !timeEnd.trim() ||
      !venueName.trim() ||
      !address.trim() ||
      !prefecture.trim() ||
      !items.trim() ||
      (!hasBase && !hasCustom) ||
      (payType === "split" && !splitFee.trim())
    ) {
      return false;
    }
    return true;
  };

  // 保存処理
  const handleSubmit = async () => {
    if (!user) {
      alert("ログインしてください");
      return;
    }
    if (!validate()) {
      alert("必須項目が未入力です。すべて入力してください。");
      return;
    }

    try {
      await addDoc(collection(db, "events"), {
        genre: "large-hall",
        title,
        date,
        timeStart,
        timeEnd,
        capacity,
        description,
        venueName,
        address,
        prefecture,
        payType,
        splitFee: payType === "split" ? Number(splitFee) : null,
        items,
        activities: [
          ...BASE_ACTIVITIES.filter((a) => selected.includes(a.key)).map((a) => a.label),
          ...customActivities
            .filter((c) => c.checked && c.label.trim() && c.details.trim()) // ✅ label+details 必須
            .map((c) => `${c.label} - ${c.details}`),
        ],
        createdBy: user.uid,
        createdByName: user.displayName || "名無し",
        participants: [],
        createdAt: serverTimestamp(),
      });

      alert("大規模会場オフ会を作成しました！");
      router.push("/events");
    } catch (err) {
      console.error("Error creating small hall event:", err);
      alert("イベント作成に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-300 via-sky-100 to-sky-400 flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-sky-700 mb-6">🏟️ 大規模会場レンタルを作成</h1>

        <div className="bg-white/90 p-6 rounded-lg shadow space-y-5">
          {/* 基本情報 */}
          <div>
            <label className="block text-gray-800 mb-1">タイトル</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          <div>
            <label className="block text-gray-800 mb-1">日付</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          <div>
            <label className="block text-gray-800 mb-1">開始・終了時間</label>
            <div className="flex gap-2">
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-black"/>
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-black"/>
            </div>
          </div>

          {/* 募集人数 */}
          <div>
            <label className="block text-gray-800 mb-1">募集人数</label>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => changeCapacity(-10)} className="px-3 py-1 bg-red-600 text-white rounded">-10</button>
              <button onClick={() => changeCapacity(-1)} className="px-3 py-1 bg-red-400 text-white rounded">-1</button>
              <span className="px-6 py-2 bg-yellow-200 text-black font-bold rounded">{capacity}</span>
              <button onClick={() => changeCapacity(1)} className="px-3 py-1 bg-green-400 text-white rounded">+1</button>
              <button onClick={() => changeCapacity(10)} className="px-3 py-1 bg-green-600 text-white rounded">+10</button>
            </div>
          </div>

          {/* 会場 */}
          <div>
            <label className="block text-gray-800 mb-1">会場名</label>
            <input type="text" value={venueName} onChange={(e) => setVenueName(e.target.value)}
              placeholder="例：〇〇会議室" className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          <div>
            <label className="block text-gray-800 mb-1">住所</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="例：名古屋市〇〇区〇〇1-2-3" className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          <div>
            <label className="block text-gray-800 mb-1">都道府県</label>
            <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}
              className="w-full px-3 py-2 border rounded text-black">
              <option value="">選択してください</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 支払い */}
          <div>
            <p className="text-gray-800 font-semibold mb-2">お支払い</p>
            <div className="flex gap-6 items-center">
              <label className="text-black">
                <input type="radio" name="payType" value="self" checked={payType === "self"}
                  onChange={() => setPayType("self")} className="mr-1"/> 自腹
              </label>
              <label className="text-black">
                <input type="radio" name="payType" value="split" checked={payType === "split"}
                  onChange={() => setPayType("split")} className="mr-1"/> 割り勘
              </label>
            </div>
            {payType === "split" && (
              <input type="number" min={0} value={splitFee} onChange={(e) => setSplitFee(e.target.value)}
                placeholder="金額を入力（円）" className="mt-2 w-full px-3 py-2 border rounded text-black"/>
            )}
          </div>

          {/* 活動内容 */}
          <div>
            <p className="text-gray-800 font-semibold mb-2">活動内容（レ点で選択）</p>
            {BASE_ACTIVITIES.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-black">
                <input type="checkbox" checked={selected.includes(a.key)} onChange={() => toggleBaseActivity(a.key)}/>
                {a.label}
              </label>
            ))}
          </div>

          {/* その他の活動 */}
          <div>
            <p className="text-gray-800 font-semibold mb-2">その他の活動内容</p>
            {customActivities.map((c, idx) => (
              <div key={idx} className="border rounded p-3 bg-white/70 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={c.checked} onChange={() => toggleCustomChecked(idx)}/>
                  <input type="text" value={c.label} onChange={(e) => updateCustomLabel(idx, e.target.value)}
                    placeholder="活動名を入力" className="flex-1 px-3 py-2 border rounded text-black"/>
                  <button onClick={() => removeCustomActivity(idx)}
                    className="px-3 py-2 bg-red-500 text-white rounded">削除</button>
                </div>
                {/* ✅ 必須の詳細説明 */}
                {c.checked && (
                  <textarea value={c.details} onChange={(e) => updateCustomDetails(idx, e.target.value)}
                    rows={2} placeholder="詳細を必ず入力してください" className="w-full px-3 py-2 border rounded text-black"/>
                )}
              </div>
            ))}
            <button onClick={addCustomActivity}
              className="px-3 py-2 bg-blue-500 text-white rounded">＋ 活動を追加</button>
          </div>

          {/* 持ち物 */}
          <div>
            <label className="block text-gray-800 mb-1">持ち物</label>
            <input type="text" value={items} onChange={(e) => setItems(e.target.value)}
              placeholder="例: 筆記用具、名札など" className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          {/* 詳細説明 */}
          <div>
            <label className="block text-gray-800 mb-1">詳細説明（任意）</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 border rounded text-black"/>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">作成する</button>
            <button onClick={() => router.push("/events/create")}
              className="flex-1 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">戻る（ジャンル選択へ）</button>
          </div>
        </div>
      </main>
    </div>
  );
}