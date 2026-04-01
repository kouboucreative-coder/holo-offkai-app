// hooks/useProfileGuard.ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * ログイン済みユーザーのプロフィール完了状態をチェックし、
 * 未設定の場合はプロフィール設定画面へリダイレクトする。
 *
 * @param skip true のときはチェックをスキップ（プロフィール編集ページ自身で呼ぶ場合など）
 */
export function useProfileGuard(skip = false) {
  const router = useRouter();

  useEffect(() => {
    if (skip) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return; // 未ログインは各ページで個別対応

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {
          // Firestore ドキュメント自体がない → 初回ユーザー
          router.replace("/profile/edit?setup=1");
          return;
        }

        const data = snap.data();

        // profileCompleted: true ならOK
        // それ以外の場合でも name・oshi・prefecture が揃っていれば既存ユーザーとみなす
        const isComplete =
          data.profileCompleted === true ||
          (!!data.name && !!data.oshi && !!data.prefecture);

        if (!isComplete) {
          router.replace("/profile/edit?setup=1");
        }
      } catch (e) {
        console.error("Profile guard check failed:", e);
      }
    });

    return () => unsub();
  }, [router, skip]);
}
