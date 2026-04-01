"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">📜 利用規約</h1>

        <div className="bg-white p-6 rounded-lg shadow space-y-6 text-gray-700 leading-relaxed">
          <p>
            本利用規約（以下「本規約」といいます）は、「ホロライブ非公式オフ会」
            （以下「本サービス」といいます）の利用条件を定めるものです。
            ユーザーの皆さまには、本規約に従って本サービスをご利用いただきます。
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-2">第1条（適用）</h2>
            <p>
              本規約は、ユーザーとホロライブ非公式オフ会運営チーム（以下「運営」といいます）との間の
              本サービスの利用に関わる一切の関係に適用されるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第2条（利用条件）</h2>
            <ul className="list-disc ml-6">
              <li>本サービスを利用できるのは13歳以上の方に限ります。</li>
              <li>16歳未満の方は、保護者の同意を得たうえで利用してください。</li>
              <li>営利目的での利用は禁止します。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第3条（知的財産権）</h2>
            <ul className="list-disc ml-6">
              <li>運営が作成したコンテンツの著作権は運営に帰属します。</li>
              <li>
                ユーザーが作成した投稿やイベント情報の著作権は当該ユーザーに帰属しますが、
                運営は宣伝のために無償で利用できるものとします。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第4条（禁止事項）</h2>
            <p>ユーザーは以下の行為を行ってはなりません。</p>
            <ul className="list-disc ml-6">
              <li>法令または公序良俗に違反する行為</li>
              <li>他のユーザーや第三者に不利益・損害を与える行為</li>
              <li>X（旧Twitter）などに個人情報を含む情報を投稿する行為</li>
              <li>運営の承諾なく営利目的で利用する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第5条（免責事項）</h2>
            <ul className="list-disc ml-6">
              <li>
                運営が正式に管理していないサービス・コミュニティ等に関するトラブルについて、運営は一切の責任を負いません。
              </li>
              <li>
                ユーザー間のトラブル、本サービスの障害・停止により発生した損害について、運営は責任を負いません。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第6条（変更・終了）</h2>
            <p>
              運営は、ユーザーへの事前通知なしに本サービスの内容を変更・終了することができます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第7条（準拠法・裁判管轄）</h2>
            <p>
              本規約は日本法に準拠します。本サービスに関して生じた紛争については、
              日本国内の裁判所を専属的合意管轄とします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">第8条（お問い合わせ窓口）</h2>
            <p>本サービスに関するお問い合わせは、以下の窓口までお願いします。</p>
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