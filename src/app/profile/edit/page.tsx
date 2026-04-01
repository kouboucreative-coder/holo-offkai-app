// app/profile/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import OshiSelector from "@/components/OshiSelector";
import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

export default function ProfileEditPage() {
  const user = auth.currentUser;
  const router = useRouter();

  const [newName, setNewName] = useState(user?.displayName || "");
  const [prefecture, setPrefecture] = useState("");
  const [oshi, setOshi] = useState("");
  const [bio, setBio] = useState("");
  const [showPrefecture, setShowPrefecture] = useState(true);
  const [xUrl, setXUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [otherUrl, setOtherUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setPrefecture(data.prefecture || "");
        setOshi(data.oshi || "");
        setBio(data.bio || "");
        setShowPrefecture(data.showPrefecture ?? true);
        setXUrl(data.xUrl || "");
        setYoutubeUrl(data.youtubeUrl || "");
        setInstagramUrl(data.instagramUrl || "");
        setTiktokUrl(data.tiktokUrl || "");
        setBlogUrl(data.blogUrl || "");
        setOtherUrl(data.otherUrl || "");
      }
    };
    fetchUser();
  }, [user]);

  const isValidUrl = (url: string) => url === "" || url.startsWith("https://");

  const handleUpdate = async () => {
    if (!user || !newName.trim()) return;

    const urls = [xUrl, youtubeUrl, instagramUrl, tiktokUrl, blogUrl, otherUrl];
    for (const u of urls) {
      if (u && !isValidUrl(u)) {
        alert("URLは https:// から始まる形式で入力してください。");
        return;
      }
    }

    try {
      setSaving(true);
      await updateProfile(user, { displayName: newName });
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: newName,
          prefecture,
          oshi,
          bio,
          showPrefecture,
          email: user.email,
          xUrl,
          youtubeUrl,
          instagramUrl,
          tiktokUrl,
          blogUrl,
          otherUrl,
        },
        { merge: true }
      );
      alert("プロフィールを更新しました！");
      router.push("/mypage");
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("プロフィール更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
        <Navbar />
        <p className="text-center mt-20 text-gray-500">ログインしてください。</p>
      </div>
    );
  }

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">プロフィールを編集</h1>

        <div className="space-y-4">
          {/* ── 基本情報 ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">基本情報</h2>

            <div>
              <label className={labelCls}>名前</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>都道府県</label>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className={inputCls}
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>{pref}</option>
                ))}
              </select>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPrefecture}
                  onChange={(e) => setShowPrefecture(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                都道府県をプロフィールに公開する
              </label>
            </div>

            <div>
              <label className={labelCls}>自己紹介（任意）</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="推し活の話、よく行く場所など..."
                className={inputCls}
              />
            </div>
          </div>

          {/* ── 最推し選択 ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-0.5">最推し</h2>
              <p className="text-xs text-gray-400">グループ → ユニット → メンバーの順に選択してください</p>
            </div>
            <OshiSelector value={oshi} onChange={setOshi} />
          </div>

          {/* ── SNSリンク ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">SNSリンク（任意）</h2>
            {[
              { label: "X", value: xUrl, setter: setXUrl, placeholder: "https://x.com/..." },
              { label: "YouTube", value: youtubeUrl, setter: setYoutubeUrl, placeholder: "https://youtube.com/..." },
              { label: "Instagram", value: instagramUrl, setter: setInstagramUrl, placeholder: "https://instagram.com/..." },
              { label: "TikTok", value: tiktokUrl, setter: setTiktokUrl, placeholder: "https://tiktok.com/..." },
              { label: "ブログ", value: blogUrl, setter: setBlogUrl, placeholder: "https://..." },
              { label: "その他", value: otherUrl, setter: setOtherUrl, placeholder: "https://..." },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label className={labelCls}>{label}</label>
                <input
                  type="url"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {/* ── 保存ボタン ── */}
          <div className="flex gap-3">
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存する"}
            </button>
            <button
              onClick={() => router.push("/mypage")}
              className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
