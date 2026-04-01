"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

// 型定義
type Notice = {
  id: string;
  title: string;
  body: string;
  isVisible: boolean;
  createdAt?: any;
};

type Report = {
  id: string;
  type: "user" | "event";
  targetId: string;
  reason: string;
  status: "pending" | "resolved";
  createdAt?: any;
};

type Message = {
  id: string;
  fromUid: string;
  fromName: string;
  body: string;
  createdAt?: any;
};

// 🔹 通報アイテム表示コンポーネント
function ReportItem({
  report,
  onResolve,
}: {
  report: Report;
  onResolve: (id: string) => void;
}) {
  const [targetInfo, setTargetInfo] = useState<any>(null);

  useEffect(() => {
    const fetchTarget = async () => {
      try {
        if (report.type === "user") {
          const snap = await getDoc(doc(db, "users", report.targetId));
          if (snap.exists()) setTargetInfo(snap.data());
        } else if (report.type === "event") {
          const snap = await getDoc(doc(db, "events", report.targetId));
          if (snap.exists()) setTargetInfo(snap.data());
        }
      } catch (err) {
        console.error("Error fetching target info:", err);
      }
    };
    fetchTarget();
  }, [report.type, report.targetId]);

  return (
    <div className="bg-white rounded-lg shadow p-4 border flex justify-between items-center">
      <div>
        <p className="font-medium text-gray-800">
          {report.type === "user" ? "👤 ユーザー通報" : "📅 イベント通報"}:{" "}
          {report.targetId}
        </p>

        {targetInfo && report.type === "user" && (
          <p className="text-gray-700 text-sm">
            👤 {targetInfo.name || "名前未設定"}（
            {targetInfo.email || "メールなし"}）
          </p>
        )}
        {targetInfo && report.type === "event" && (
          <p className="text-gray-700 text-sm">
            📌 {targetInfo.title || "タイトル未設定"}（
            {targetInfo.date || "日付不明"}）
          </p>
        )}

        <p className="text-gray-600 text-sm">理由: {report.reason}</p>
        <span
          className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
            report.status === "pending"
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {report.status === "pending" ? "未対応" : "対応済み"}
        </span>
      </div>

      {report.status === "pending" && (
        <button
          onClick={() => onResolve(report.id)}
          className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600"
        >
          対応済みにする
        </button>
      )}
    </div>
  );
}

// 🔹 メインページ
export default function AdminNoticePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<"notice" | "report" | "message">("notice");
  const [loading, setLoading] = useState(true);

  // 管理者チェック
  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/");
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push("/");
        }
      } catch {
        setIsAdmin(false);
        router.push("/");
      }
    };
    checkAdmin();
  }, [router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const ns = await getDocs(collection(db, "notices"));
        setNotices(
          ns.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Notice[]
        );

        const rs = await getDocs(collection(db, "reports"));
        setReports(
          rs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[]
        );

        const ms = await getDocs(collection(db, "messages"));
        setMessages(
          ms.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[]
        );
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 通報ステータス更新
  const resolveReport = async (id: string) => {
    await updateDoc(doc(db, "reports", id), { status: "resolved" });
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r))
    );
  };

  // お知らせ削除
  const deleteNotice = async (id: string) => {
    if (!confirm("このお知らせを削除しますか？")) return;
    await deleteDoc(doc(db, "notices", id));
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  if (isAdmin === null || loading) {
    return <p className="text-center mt-10">読み込み中...</p>;
  }
  if (!isAdmin) {
    return <p className="text-center mt-10">アクセス権限がありません。</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          📢 お知らせ・通報管理
        </h1>

        {/* タブ切り替え */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setTab("notice")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "notice"
                ? "bg-amber-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            お知らせ
          </button>
          <button
            onClick={() => setTab("report")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "report"
                ? "bg-red-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            通報一覧
          </button>
          <button
            onClick={() => setTab("message")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === "message"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            運営メッセージ
          </button>
        </div>

        {/* お知らせタブ */}
        {tab === "notice" && (
          <div className="space-y-4">
            {notices.length === 0 ? (
              <p className="text-gray-600">お知らせはまだありません。</p>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className="bg-white rounded-lg shadow p-4 border flex justify-between items-center"
                >
                  <div>
                    <h2 className="font-bold text-lg text-gray-800">
                      {n.title}
                    </h2>
                    <p className="text-gray-600 text-sm">{n.body}</p>
                    <span
                      className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                        n.isVisible
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {n.isVisible ? "公開中" : "非公開"}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteNotice(n.id)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    削除
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* 通報タブ */}
        {tab === "report" && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-gray-600">通報はまだありません。</p>
            ) : (
              reports.map((r) => (
                <ReportItem key={r.id} report={r} onResolve={resolveReport} />
              ))
            )}
          </div>
        )}

        {/* メッセージタブ */}
        {tab === "message" && (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-gray-600">メッセージはまだありません。</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="bg-white rounded-lg shadow p-4 border">
                  <p className="font-medium text-gray-800">
                    {m.fromName || m.fromUid}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">{m.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}