// app/surveys/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  collection,
  addDoc,
} from "firebase/firestore";

type Assignment = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle?: string;
  type: "5scale" | string;
  status: "pending" | "answered";
  assignedAt?: any;
  rating?: number;
  comment?: string;
  answeredAt?: any;
};

export default function SurveyAnswerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = params?.id;

  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 回答入力
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  // 取得
  useEffect(() => {
    const run = async () => {
      if (!assignmentId) return;

      try {
        setLoading(true);
        const ref = doc(db, "surveyAssignments", assignmentId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("アンケートが見つかりません。");
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as Assignment;
        setAssignment(data);

        // 不正アクセス防止：本人のみ
        if (currentUser && data.userId && currentUser.uid !== data.userId) {
          setError("このアンケートに回答する権限がありません。");
          return;
        }

        // 既に回答済みなら初期値に反映
        if (data.status === "answered") {
          setRating(typeof data.rating === "number" ? data.rating : null);
          setComment(data.comment ?? "");
        }
      } catch (e) {
        console.error(e);
        setError("読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, currentUser?.uid]);

  const submit = async () => {
    if (!assignment) return;
    if (!currentUser) {
      alert("ログインしてください。");
      return;
    }
    if (assignment.userId !== currentUser.uid) {
      alert("このアンケートに回答する権限がありません。");
      return;
    }
    if (assignment.type !== "5scale") {
      alert("このアンケート形式には未対応です。");
      return;
    }
    if (rating == null) {
      alert("5段階の評価を選択してください。");
      return;
    }

    try {
      // 1) responses に保存（履歴として）
      await addDoc(collection(db, "surveyResponses"), {
        assignmentId: assignment.id,
        userId: currentUser.uid,
        eventId: assignment.eventId,
        eventTitle: assignment.eventTitle ?? "",
        type: assignment.type,
        rating,
        comment: comment.trim() || null,
        answeredAt: serverTimestamp(),
      });

      // 2) assignments を更新（未回答→回答済み）
      await updateDoc(doc(db, "surveyAssignments", assignment.id), {
        status: "answered",
        rating,
        comment: comment.trim() || null,
        answeredAt: serverTimestamp(),
      });

      alert("ご回答ありがとうございました！");
      router.push("/events"); // お好みで /mypage などに変更可
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    }
  };

  // 星（5段階）UI
  const Star = ({ idx }: { idx: number }) => {
    const active = (rating ?? 0) >= idx;
    return (
      <button
        type="button"
        onClick={() => setRating(idx)}
        className={`text-3xl leading-none transition ${
          active ? "text-yellow-500" : "text-gray-300"
        }`}
        aria-label={`${idx} を選択`}
      >
        ★
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200">
      <Navbar />

      <main className="max-w-xl mx-auto p-6">
        {loading ? (
          <p className="text-center mt-10">読み込み中…</p>
        ) : error ? (
          <div className="bg-white border rounded-lg shadow p-6 mt-6">
            <p className="text-red-600 font-medium">{error}</p>
            <div className="mt-4">
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600"
              >
                トップへ戻る
              </button>
            </div>
          </div>
        ) : assignment ? (
          <div className="bg-white/90 border rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-800">アンケート</h1>
            <p className="text-gray-600 mt-1 text-sm">
              対象イベント：{assignment.eventTitle || "(タイトル未設定)"}
            </p>

            {assignment.status === "answered" && (
              <p className="mt-3 inline-block px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">
                すでに回答済みです（再送信で更新されます）
              </p>
            )}

            {assignment.type !== "5scale" ? (
              <p className="mt-6 text-gray-700">
                このアンケート形式（{assignment.type}）にはまだ対応していません。
              </p>
            ) : (
              <>
                {/* 5段階評価 */}
                <section className="mt-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    総合評価（1〜5）
                  </h2>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} idx={i} />
                    ))}
                    <span className="ml-2 text-sm text-gray-600">
                      {rating ? `${rating} / 5` : "未選択"}
                    </span>
                  </div>
                </section>

                {/* 任意コメント */}
                <section className="mt-6">
                  <label className="block text-gray-800 mb-1">コメント（任意）</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded text-black"
                    placeholder="よかった点・改善点などがあればご記入ください"
                  />
                </section>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={submit}
                    className="flex-1 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    回答を送信
                  </button>
                  <button
                    onClick={() => router.back()}
                    className="px-4 py-2 rounded bg-gray-400 text-white hover:bg-gray-500"
                  >
                    戻る
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}