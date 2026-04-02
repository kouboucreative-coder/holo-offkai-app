"use client";

import { useEffect, useState } from "react";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { syncUserToFirestore, signInWithGoogle } from "@/lib/authHelpers";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // モバイルリダイレクト後の結果処理
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await syncUserToFirestore();
          router.replace("/");
        }
      } catch (err) {
        console.error("Redirect login failed:", err);
        setError("ログインに失敗しました。もう一度お試しください。");
      }
    };
    handleRedirectResult();
  }, [router]);

  const handleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      await signInWithGoogle();
      // PC（popup）の場合のみここに到達する
      // モバイル（redirect）の場合はページ遷移するのでここには来ない
      router.replace("/");
    } catch (err) {
      console.error("Login failed:", err);
      setError("ログインに失敗しました。もう一度お試しください。");
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
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
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

        <p className="text-xs text-gray-400 mt-6">
          ログインすることで利用規約・プライバシーポリシーに同意したことになります。
        </p>
      </div>
    </div>
  );
}
