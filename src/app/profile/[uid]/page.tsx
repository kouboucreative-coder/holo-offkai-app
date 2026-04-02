// app/profile/[uid]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getMemberEmoji } from "@/lib/hololiveMembers";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import Image from "next/image";

type UserProfile = {
  name?: string;
  bio?: string;
  prefecture?: string;
  oshi?: string;
  photoURL?: string;
  showPrefecture?: boolean;
  x?: string;
  showX?: boolean;
  instagram?: string;
  showInstagram?: boolean;
  youtube?: string;
  showYoutube?: boolean;
  tiktok?: string;
  showTiktok?: boolean;
  blog?: string;
  showBlog?: boolean;
  other?: string;
  showOther?: boolean;
};

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export default function UserProfilePage() {
  const { uid } = useParams();
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const fetchProfile = async () => {
      try {
        const ref = doc(db, "users", uid as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [uid]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-400">読み込み中...</p>
    </div>
  );
  if (!profile) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20">
      <Navbar />
      <p className="text-center mt-20 text-gray-500">プロフィールが見つかりません。</p>
    </div>
  );

  const isMyProfile = currentUser?.uid === uid;

  const snsLinks = [
    { show: profile.showX && profile.x, label: "X", url: profile.x },
    { show: profile.showInstagram && profile.instagram, label: "Instagram", url: profile.instagram },
    { show: profile.showYoutube && profile.youtube, label: "YouTube", url: profile.youtube },
    { show: profile.showTiktok && profile.tiktok, label: "TikTok", url: profile.tiktok },
    { show: profile.showBlog && profile.blog, label: "ブログ", url: profile.blog },
    { show: profile.showOther && profile.other, label: "その他", url: profile.other },
  ].filter((s) => s.show && s.url);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
        >
          ← 戻る
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          {/* アバター + 名前 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm border border-gray-100 shrink-0">
              {profile.photoURL ? (
                <Image
                  src={profile.photoURL}
                  alt={profile.name || "アイコン"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {getInitials(profile.name)}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.name || "名無し"}
            </h1>
          </div>

          {profile.bio && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{profile.bio}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {profile.oshi && (
              <div className="bg-pink-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1.5">最推し</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none shrink-0 select-none">
                    {getMemberEmoji(profile.oshi)}
                  </span>
                  <span className="text-sm font-bold text-pink-700 leading-tight">
                    {profile.oshi}
                  </span>
                </div>
              </div>
            )}
            {profile.showPrefecture && profile.prefecture && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">都道府県</p>
                <p className="text-sm font-semibold text-gray-800">{profile.prefecture}</p>
              </div>
            )}
          </div>

          {snsLinks.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">SNS</p>
              <div className="flex flex-wrap gap-2">
                {snsLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {isMyProfile ? (
          <Link href="/profile/edit">
            <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all">
              プロフィールを編集
            </button>
          </Link>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/personal-chat/${uid}`)}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 hover:-translate-y-0.5 transition-all"
            >
              💬 チャット
            </button>
            <button
              onClick={() => router.push(`/profile/${uid}/report`)}
              className="flex-1 py-3 border border-red-300 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition"
            >
              通報する
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
