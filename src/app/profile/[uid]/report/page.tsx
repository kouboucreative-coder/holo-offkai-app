// app/profile/[uid]/report/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";

export default function ReportUserPage() {
  // ✅ uid を string に正規化
  const params = useParams();
  const uidParam = (params?.uid as string | string[] | undefined) ?? "";
  const uid = Array.isArray(uidParam) ? uidParam[0] : uidParam;

  const router = useRouter();

  const [userName, setUserName] = useState<string>("不明なユーザー");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("不適切な発言");
  const [sending, setSending] = useState(false);

  // 通報対象のユーザー情報を取得
  useEffect(() => {
    const fetchUser = async () => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setUserName(data.name || data.displayName || "不明なユーザー");
        }
      } catch (e) {
        console.error("Error fetching user:", e);
      }
    };
    fetchUser();
  }, [uid]);

  // 通報送信
  const handleSubmit = async () => {
    if (!auth.currentUser) {
      alert("ログインが必要です。");
      return;
    }
    if (!reason.trim()) {
      alert("通報理由を入力してください。");
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, "reports"), {
        type: "user",
        targetId: uid,
        targetName: userName,
        category,
        reason,
        reportedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: "pending",
      });
      alert("通報を送信しました。ご協力ありがとうございます。");
      router.push(`/profile/${uid}`); // ✅ 正規化した string を使用
    } catch (err) {
      console.error("Error sending report:", err);
      alert("通報の送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  if (!uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-100 via-white to-red-200 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto w-full p-6">
          <div className="bg-white shadow rounded-xl p-6 border border-gray-200">
            <p className="text-gray-700">不正なURLです。（ユーザーIDが取得できません）</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-100 via-white to-red-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6">
        <div className="bg-white shadow rounded-xl p-6 border border-gray-200">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚨 ユーザー通報</h1>
          <p className="mb-4 text-gray-700">
            以下のユーザーを通報します:
            <br />
            <span className="font-semibold">{userName}</span>
          </p>

          {/* カテゴリ選択 */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            通報カテゴリ
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full mb-4 px-3 py-2 border rounded text-black"
          >
            <option value="不適切な発言">不適切な発言</option>
            <option value="スパム">スパム・広告</option>
            <option value="迷惑行為">迷惑行為</option>
            <option value="規約違反">利用規約違反</option>
            <option value="その他">その他</option>
          </select>

          {/* 理由入力 */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            詳細な理由
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="通報の理由を具体的にご記入ください"
            rows={5}
            className="w-full mb-4 px-3 py-2 border rounded text-black"
          />

          {/* ボタン */}
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {sending ? "送信中..." : "通報を送信"}
          </button>

          <button
            onClick={() => router.push(`/profile/${uid}`)} // ✅ ここもOK
            className="w-full mt-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            キャンセルして戻る
          </button>
        </div>
      </main>
    </div>
  );
}