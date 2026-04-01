"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🔒 プライバシーポリシー</h1>

        <div className="bg-white p-6 rounded-lg shadow space-y-6 text-gray-700 leading-relaxed">
          <p>
            ホロライブ非公式オフ会運営チーム（以下「運営」といいます）は、
            本サービスにおけるユーザーの個人情報の取扱いについて、
            以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-2">第1条（収集する情報）</h2>
            <p>本サービスでは、以下の情報を収集する場合があります。</p>
            <ul className="list-disc ml-6">
              <li>ユーザーが登録したプロフィール情報（氏名、メールアドレス、都道府県、推し情報など）</li>
              <li>ログインに使用するGoogleアカウント情報（メールアドレス等）</li>
              <li>サービス利用時に自動的に収集される情報（アクセス日時、利用履歴、端末情報等）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第2条（利用目的）</h2>
            <p>収集した情報は以下の目的で利用します。</p>
            <ul className="list-disc ml-6">
              <li>オフ会イベントの作成、参加、運営のため</li>
              <li>ユーザーサポートや問い合わせ対応のため</li>
              <li>不正利用やトラブル防止のため</li>
              <li>サービス改善や利便性向上のため</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第3条（第三者提供）</h2>
            <p>
              運営は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第4条（管理）</h2>
            <p>
              運営は、個人情報を正確かつ最新の状態に保つよう努め、
              安全管理のために必要かつ適切な措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第5条（免責事項）</h2>
            <p>
              ユーザー自身がX（旧Twitter）など外部サービスに投稿した情報については、
              運営は一切責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第6条（改定）</h2>
            <p>
              本ポリシーの内容は、必要に応じて変更することがあります。
              改定後の内容は、本サービス上で告知します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第7条（お問い合わせ窓口）</h2>
            <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いします。</p>
            <p className="font-semibold">📩 koubou.creative@gmail.com</p>
          </section>

          <p className="text-sm text-gray-500 text-right mt-8">
            制定日: 2025年9月10日
          </p>
        </div>

        {/* 戻るボタン */}
        <div className="mt-6 text-center">
          <Link href="/">
            <button className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              ← トップページに戻る
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}