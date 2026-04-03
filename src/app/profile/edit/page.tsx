// app/profile/edit/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { auth, db, storage } from "@/lib/firebase";
import Navbar from "@/components/Navbar";
import OshiSelector from "@/components/OshiSelector";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

// ──────────────────────────────────────────────────────
function ProfileEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstSetup = searchParams.get("setup") === "1";

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // アイコン
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string>("");
  const [previewURL, setPreviewURL] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォームの値
  const [newName, setNewName] = useState("");
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

  // UI状態
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── 認証状態の購読 ──────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // ── 既存プロフィールの読み込み ──────────────────────
  useEffect(() => {
    if (!authUser) return;
    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, "users", authUser.uid));
      if (snap.exists()) {
        const d = snap.data() as Record<string, string | boolean>;
        setNewName((d.name as string) || authUser.displayName || "");
        setPrefecture((d.prefecture as string) || "");
        setOshi((d.oshi as string) || "");
        setBio((d.bio as string) || "");
        setShowPrefecture(d.showPrefecture !== false);
        setXUrl((d.x as string) || "");
        setYoutubeUrl((d.youtube as string) || "");
        setInstagramUrl((d.instagram as string) || "");
        setTiktokUrl((d.tiktok as string) || "");
        setBlogUrl((d.blog as string) || "");
        setOtherUrl((d.other as string) || "");
        // 保存済みアイコンURL（Firestore 優先、なければ Auth の photoURL）
        const savedPhoto = (d.photoURL as string) || authUser.photoURL || "";
        setCurrentPhotoURL(savedPhoto);
      } else {
        setNewName(authUser.displayName || "");
        setCurrentPhotoURL(authUser.photoURL || "");
      }
    };
    fetchProfile();
  }, [authUser]);

  // ── ファイル選択ハンドラ ─────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, avatar: "画像ファイルを選択してください（JPG / PNG / WebP）" }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, avatar: "ファイルサイズは 3MB 以下にしてください" }));
      return;
    }

    setErrors((prev) => { const n = { ...prev }; delete n.avatar; return n; });
    setAvatarFile(file);

    // ローカルプレビュー
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setPreviewURL("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── バリデーション ──────────────────────────────────
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!newName.trim()) errs.name = "名前を入力してください";
    if (!prefecture) errs.prefecture = "都道府県を選択してください";
    if (!oshi) errs.oshi = "最推しを選択してください";
    return errs;
  };

  const isValidUrl = (url: string) => {
    if (url === "") return true;
    try { new URL(url); return url.startsWith("https://"); } catch { return false; }
  };

  // ── 保存処理 ────────────────────────────────────────
  const handleUpdate = async () => {
    if (!authUser) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});

    const urlFields = [xUrl, youtubeUrl, instagramUrl, tiktokUrl, blogUrl, otherUrl];
    for (const u of urlFields) {
      if (u && !isValidUrl(u)) {
        setErrors({ url: "URLは https:// から始まる正しい形式で入力してください" });
        return;
      }
    }

    try {
      setSaving(true);

      // 1. アイコン画像のアップロード（選択されていれば）
      let photoURL = currentPhotoURL;
      if (avatarFile) {
        setUploadingAvatar(true);
        const storageRef = ref(storage, `avatars/${authUser.uid}`);
        await uploadBytes(storageRef, avatarFile);
        photoURL = await getDownloadURL(storageRef);
        setUploadingAvatar(false);
      }

      // 2. Firebase Auth プロフィール更新
      await updateProfile(authUser, {
        displayName: newName,
        photoURL: photoURL || null,
      });

      // 3. Firestore 更新
      await setDoc(
        doc(db, "users", authUser.uid),
        {
          name: newName,
          prefecture,
          oshi,
          bio,
          showPrefecture,
          email: authUser.email,
          photoURL: photoURL || null,
          x: xUrl,
          youtube: youtubeUrl,
          instagram: instagramUrl,
          tiktok: tiktokUrl,
          blog: blogUrl,
          other: otherUrl,
          showX: !!xUrl,
          showYoutube: !!youtubeUrl,
          showInstagram: !!instagramUrl,
          showTiktok: !!tiktokUrl,
          showBlog: !!blogUrl,
          showOther: !!otherUrl,
          profileCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.replace(isFirstSetup ? "/" : "/mypage");
    } catch (err) {
      console.error("Error updating profile:", err);
      setErrors({ submit: "プロフィール更新に失敗しました。もう一度お試しください。" });
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const clearError = (key: string) =>
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });

  const inputCls = (hasError?: boolean) =>
    `w-full px-4 py-3 rounded-xl border ${
      hasError ? "border-red-400 ring-2 ring-red-100" : "border-gray-200"
    } focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white`;
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  // 表示するアイコン URL（プレビュー > 保存済み の優先順位）
  const displayPhoto = previewURL || currentPhotoURL;

  // ── ローディング ────────────────────────────────────
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
        <Navbar />
        <p className="text-center mt-20 text-gray-500">ログインしてください。</p>
      </div>
    );
  }

  // ── メイン UI ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      {!isFirstSetup && <Navbar />}

      <main className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">

        {/* ページヘッダー */}
        <div className="mb-8">
          {isFirstSetup ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl shrink-0">
                  👋
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-0.5">Welcome</p>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">プロフィールを設定してください</h1>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                最初に基本情報と推しを設定しましょう。あとからマイページでいつでも変更できます。
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">プロフィールを編集</h1>
          )}
        </div>

        {/* エラーサマリー */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">⚠️ 以下の項目を確認してください</p>
            <ul className="space-y-1">
              {Object.values(errors).map((msg, i) => (
                <li key={i} className="text-xs text-red-600">・{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">

          {/* ── アイコン設定 ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">プロフィールアイコン</h2>

            <div className="flex items-center gap-5">
              {/* アイコンプレビュー */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md border border-gray-100">
                  {displayPhoto ? (
                    <Image
                      src={displayPhoto}
                      alt="プロフィールアイコン"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {getInitials(newName || authUser.displayName || "")}
                    </div>
                  )}
                </div>
                {/* 変更バッジ */}
                {previewURL && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </span>
                )}
              </div>

              {/* ボタン群 */}
              <div className="flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
                >
                  📷 画像を選択
                </button>

                {(previewURL || currentPhotoURL) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveAvatar();
                      setCurrentPhotoURL("");
                    }}
                    className="w-full px-4 py-2 text-gray-500 border border-gray-200 rounded-xl text-xs font-medium hover:bg-gray-50 transition"
                  >
                    アイコンを削除
                  </button>
                )}

                <p className="text-xs text-gray-400 text-center">
                  JPG / PNG / WebP・3MB 以下
                </p>
              </div>
            </div>

            {/* ファイル選択（hidden） */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {errors.avatar && (
              <p className="text-xs text-red-500 mt-3">{errors.avatar}</p>
            )}
          </div>

          {/* ── 基本情報 ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">基本情報</h2>
              {isFirstSetup && (
                <span className="text-xs bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full">必須</span>
              )}
            </div>

            {/* 名前 */}
            <div>
              <label className={labelCls}>
                名前<span className="text-red-500 ml-1 text-xs">*必須</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); clearError("name"); }}
                placeholder="ニックネームなど"
                className={inputCls(!!errors.name)}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1.5">{errors.name}</p>}
            </div>

            {/* 都道府県 */}
            <div>
              <label className={labelCls}>
                都道府県<span className="text-red-500 ml-1 text-xs">*必須</span>
              </label>
              <select
                value={prefecture}
                onChange={(e) => { setPrefecture(e.target.value); clearError("prefecture"); }}
                className={inputCls(!!errors.prefecture)}
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>{pref}</option>
                ))}
              </select>
              {errors.prefecture && <p className="text-xs text-red-500 mt-1.5">{errors.prefecture}</p>}
              <label className="mt-2.5 flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPrefecture}
                  onChange={(e) => setShowPrefecture(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                都道府県をプロフィールに公開する
              </label>
            </div>

            {/* 自己紹介 */}
            <div>
              <label className={labelCls}>自己紹介（任意）</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="推し活の話、よく行く場所など..."
                className={inputCls()}
              />
            </div>
          </div>

          {/* ── 最推し選択 ── */}
          <div className={`bg-white rounded-2xl shadow-sm border p-6 ${errors.oshi ? "border-red-300" : "border-gray-100"}`}>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">最推し</h2>
                <span className="text-red-500 text-xs font-bold">*必須</span>
              </div>
              <p className="text-xs text-gray-400">グループ → ユニット → メンバーの順に選択してください</p>
              {errors.oshi && <p className="text-xs text-red-500 mt-1">{errors.oshi}</p>}
            </div>
            <OshiSelector value={oshi} onChange={(v) => { setOshi(v); clearError("oshi"); }} />
          </div>

          {/* ── SNSリンク ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">SNSリンク（任意）</h2>
            {errors.url && <p className="text-xs text-red-500">{errors.url}</p>}
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
                  className={inputCls()}
                />
              </div>
            ))}
          </div>

          {/* ── 保存ボタン ── */}
          <div className={`flex gap-3 ${isFirstSetup ? "flex-col" : ""}`}>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className={`${isFirstSetup ? "w-full" : "flex-1"} py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-base hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {saving
                ? uploadingAvatar
                  ? "アイコンをアップロード中..."
                  : "保存中..."
                : isFirstSetup
                ? "設定を完了して始める 🎉"
                : "保存する"}
            </button>

            {!isFirstSetup && (
              <button
                onClick={() => router.push("/mypage")}
                className="flex-1 py-4 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                キャンセル
              </button>
            )}
          </div>

          {isFirstSetup && (
            <p className="text-center text-xs text-gray-400 pb-4">
              ※ プロフィールはあとからマイページでいつでも変更できます
            </p>
          )}

        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────
export default function ProfileEditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex items-center justify-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ProfileEditContent />
    </Suspense>
  );
}
