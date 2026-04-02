"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/authHelpers";
import { useRouter } from "next/navigation";

// エラーコードを日本語メッセージに変換
function getErrorMessage(code: string): string {
  switch (code) {
    case "auth/unauthorized-domain":
      return "このドメインはログインを許可されていません。Firebase コンソールで承認済みドメインに追加してください。";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    case "auth/too-many-requests":
      return "しばらく時間をおいてから再試行してください。";
    case "auth/user-disabled":
      return "このアカウントは無効化されています。";
    default:
      return `ログインに失敗しました（${code || "不明なエラー"}）。もう一度お試しください。`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      const method = await signInWithGoogle();
      if (method === "popup") {
        // ポップアップ成功 → ホームへ
        router.replace("/");
      }
      // redirect の場合はページが遷移するため何もしない
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          OffKai
        </h1>
        <p className="text-gray-500 text-sm mb-8">推し活オフ会をもっと楽しく</p>

        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-left leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ログイン中...
            </span>
          ) : (
            "Googleでログイン"
          )}
        </button>

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          ログインすることで
          <a href="/terms" className="underline hover:text-gray-600">利用規約</a>・
          <a href="/privacy" className="underline hover:text-gray-600">プライバシーポリシー</a>
          に同意したことになります。
        </p>
      </div>
    </div>
  );
}
