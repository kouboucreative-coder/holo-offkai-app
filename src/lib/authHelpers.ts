// src/lib/authHelpers.ts
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  updateProfile,
} from "firebase/auth";

/**
 * ログイン後にユーザー情報をFirestore(users/{uid})に同期する。
 * 既存データがある場合は email / photoURL のみ更新（他フィールドは保持）。
 */
export async function syncUserToFirestore(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: user.displayName || "名無し",
      email: user.email || "",
      photoURL: user.photoURL || "",
      createdAt: new Date().toISOString(),
    });
  } else {
    await setDoc(
      ref,
      { email: user.email || "", photoURL: user.photoURL || "" },
      { merge: true }
    );
  }
}

/**
 * Googleで再認証して最新のアイコンURLを取得し、
 * Firebase Auth と Firestore(users/{uid}) に反映する。
 * 成功時は生の photoURL を返す（キャッシュバスターは呼び出し側で付与）。
 */
export async function syncUserPhoto(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const provider = new GoogleAuthProvider();
    const cred = await reauthenticateWithPopup(user, provider);

    // できる限り Google 側の providerData を優先
    const googleInfo = cred.user.providerData.find(
      (p) => p.providerId === "google.com"
    );
    const latest =
      cred.user.photoURL || googleInfo?.photoURL || user.photoURL || null;

    if (!latest) return null;

    // Auth 側のプロフィールを更新（差分があるときだけ）
    if (user.photoURL !== latest) {
      await updateProfile(user, { photoURL: latest });
    }

    // Firestore の users/{uid} に保存（他の項目は壊さない）
    await setDoc(
      doc(db, "users", user.uid),
      { photoURL: latest },
      { merge: true }
    );

    return latest;
  } catch (e) {
    console.error("syncUserPhoto error:", e);
    throw e;
  }
}