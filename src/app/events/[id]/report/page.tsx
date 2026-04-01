// app/events/[id]/report/page.tsx
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

export default function ReportEventPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params as { id: string };

  const [eventTitle, setEventTitle] = useState<string>("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("不適切な内容");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "events", id));
        if (snap.exists()) {
          const data = snap.data() as any;
          setEventTitle(data.title || "不明なイベント");
        }
      } catch (e) {
        console.error("Error fetching event:", e);
      }
    };
    fetchEvent();
  }, [id]);

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
        type: "event",
        eventId: id,
        eventTitle,
        category,
        reason,
        reportedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      alert("通報を送信しました。ご協力ありがとうございます。");
      router.push(`/events/${id}`);
    } catch (err) {
      console.error("Error sending report:", err);
      alert("通報の送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-100 via-white to-red-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6">
        <div className="bg-white shadow rounded-xl p-6 border border-gray-200">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚨 イベント通報</h1>
          <p className="mb-4 text-gray-700">
            以下のイベントを通報します:
            <br />
            <span className="font-semibold">{eventTitle}</span>
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
            <option value="不適切な内容">不適切な内容</option>
            <option value="スパム">スパム・広告</option>
            <option value="危険な行為">危険な行為</option>
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

          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {sending ? "送信中..." : "通報を送信"}
          </button>

          <button
            onClick={() => router.push(`/events/${id}`)}
            className="w-full mt-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            キャンセルして戻る
          </button>
        </div>
      </main>
    </div>
  );
}