"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

type Survey = {
  id: string;
  title: string;
  description?: string;
  target: "all" | string[];
  status: "draft" | "published";
  createdAt?: any;
};

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const q = query(collection(db, "surveys"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Survey[];
        setSurveys(data);
      } catch (e) {
        console.error("Error loading surveys:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        {/* ヘッダ */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📝 アンケート管理
          </h1>
          {/* ✅ 新規アンケート作成ボタン */}
          <Link href="/admin/surveys/new">
            <button className="px-4 py-2 rounded bg-indigo-500 text-white font-medium hover:bg-indigo-600 shadow">
              ＋ 新規アンケートを作成
            </button>
          </Link>
        </div>

        {/* 内容 */}
        {loading ? (
          <p className="text-gray-600">読み込み中...</p>
        ) : surveys.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-600">
            まだアンケートは登録されていません。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {surveys.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        s.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {s.status === "published" ? "公開中" : "下書き"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {s.createdAt?.toDate
                        ? s.createdAt.toDate().toLocaleDateString("ja-JP")
                        : "作成日時不明"}
                    </span>
                  </div>

                  <h2 className="mt-2 font-bold text-lg text-gray-900">{s.title}</h2>
                  {s.description && (
                    <p className="mt-1 text-gray-700 text-sm line-clamp-3">
                      {s.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-gray-600">
                    対象：
                    {s.target === "all"
                      ? "全イベント"
                      : Array.isArray(s.target)
                      ? s.target.join("・")
                      : "不明"}
                  </p>
                </div>

                <div className="flex justify-end mt-4">
                  <Link href={`/admin/surveys/${s.id}`}>
                    <button className="text-indigo-600 hover:underline text-sm font-medium">
                      詳細を見る →
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}