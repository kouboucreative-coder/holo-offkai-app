"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { syncUserToFirestore } from "@/lib/authHelpers";

export default function LoginPage() {
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await syncUserToFirestore();
    } catch (err) {
      console.error("Login failed:", err);
      alert("ログインに失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          OffKai
        </h1>
        <p className="text-gray-500 text-sm mb-8">推し活オフ会をもっと楽しく</p>
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          Googleでログイン
        </button>
        <p className="text-xs text-gray-400 mt-6">
          ログインすることで利用規約・プライバシーポリシーに同意したことになります。
        </p>
      </div>
    </div>
  );
}
