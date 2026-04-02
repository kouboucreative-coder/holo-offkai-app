// src/lib/authHelpers.ts
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";

/**
 * Google ログイン
 *
 * 戦略:
 *   1. まず signInWithPopup を試みる（ユーザーのクリックから直接呼ぶため
 *      モバイルでも動作することが多い）
 *   2. ポップアップがブロックされた場合のみ signInWithRedirect にフォールバック
 *      （リダイレクト後の処理は getRedirectResult で Navbar が担当）
 */
export async function signInWithGoogle(): Promise<"popup" | "redirect"> {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  try {
    await signInWithPopup(auth, provider);
    await syncUserToFirestore();
    return "popup";
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";

    // ポップアップ系エラー → リダイレクトにフォールバック
    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(auth, provider);
      // redirect 後はページが再ロードされるためここには到達しない
      return "redirect";
    }

    throw err; // それ以外のエラーは呼び出し元へ
  }
}

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
 */
export async function syncUserPhoto(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const provider = new GoogleAuthProvider();
    const cred = await reauthenticateWithPopup(user, provider);

    const googleInfo = cred.user.providerData.find(
      (p) => p.providerId === "google.com"
    );
    const latest =
      cred.user.photoURL || googleInfo?.photoURL || user.photoURL || null;

    if (!latest) return null;

    if (user.photoURL !== latest) {
      await updateProfile(user, { photoURL: latest });
    }

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
