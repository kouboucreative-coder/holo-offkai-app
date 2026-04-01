"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

type Question =
  | {
      kind: "choice";
      title: string;
      options: string[]; // 2つ以上
      required: boolean;
    }
  | {
      kind: "rating";
      title: string;
      scale: 5; // 5段階固定
      required: boolean;
    }
  | {
      kind: "text";
      title: string;
      placeholder?: string;
      required: boolean;
    };

export default function NewSurveyPage() {
  const router = useRouter();

  // 基本情報
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  // 対象ジャンル（複数可）
  const [targetGenres, setTargetGenres] = useState<string[]>([]);
  const toggleGenre = (g: string) =>
    setTargetGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  // 主質問の種別（choice or rating のどちらか必須）
  const [primaryType, setPrimaryType] = useState<"choice" | "rating">("choice");

  // 主質問（選択式）
  const [choiceTitle, setChoiceTitle] = useState("");
  const [choiceOptions, setChoiceOptions] = useState<string[]>(["", ""]);
  const updateChoiceOption = (i: number, v: string) => {
    const next = [...choiceOptions];
    next[i] = v;
    setChoiceOptions(next);
  };
  const addChoiceOption = () => setChoiceOptions((o) => [...o, ""]);
  const removeChoiceOption = (i: number) =>
    setChoiceOptions((o) => o.filter((_, idx) => idx !== i));

  // 主質問（5段階評価）
  const [ratingTitle, setRatingTitle] = useState("");

  // 記述式（任意で複数）
  const [textQuestions, setTextQuestions] = useState<
    { title: string; placeholder?: string; required: boolean }[]
  >([]);
  const addText = () =>
    setTextQuestions((q) => [...q, { title: "", placeholder: "", required: false }]);
  const updateText = (
    i: number,
    key: "title" | "placeholder" | "required",
    v: string | boolean
  ) => {
    const next = [...textQuestions];
    // @ts-expect-error dynamic
    next[i][key] = v;
    setTextQuestions(next);
  };
  const removeText = (i: number) =>
    setTextQuestions((q) => q.filter((_, idx) => idx !== i));

  const validate = (): string | null => {
    if (!title.trim()) return "タイトルを入力してください。";
    if (targetGenres.length === 0)
      return "配信するジャンルを1つ以上選択してください。";

    if (primaryType === "choice") {
      if (!choiceTitle.trim()) return "選択式の設問タイトルを入力してください。";
      const filled = choiceOptions.map((x) => x.trim()).filter(Boolean);
      if (filled.length < 2) return "選択肢は2つ以上入力してください。";
    } else {
      if (!ratingTitle.trim()) return "5段階評価の設問タイトルを入力してください。";
    }
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }

    // Firestoreに保存する設問配列を構築
    const questions: Question[] = [];

    if (primaryType === "choice") {
      questions.push({
        kind: "choice",
        title: choiceTitle.trim(),
        options: choiceOptions.map((o) => o.trim()).filter(Boolean),
        required: true,
      });
    } else {
      questions.push({
        kind: "rating",
        title: ratingTitle.trim(),
        scale: 5,
        required: true,
      });
    }

    textQuestions.forEach((t) => {
      if (t.title.trim()) {
        questions.push({
          kind: "text",
          title: t.title.trim(),
          placeholder: t.placeholder?.trim() || "",
          required: !!t.required,
        });
      }
    });

    try {
      await addDoc(collection(db, "surveys"), {
        title: title.trim(),
        description: description.trim() || "",
        status, // "draft" | "published"
        targetGenres, // ["karaoke","food","shop"] の配列
        questions, // 上記 Question[] 構造
        createdAt: serverTimestamp(),
      });

      alert("アンケートを作成しました。");
      router.push("/admin/surveys");
    } catch (e) {
      console.error("Error creating survey:", e);
      alert("アンケートの作成に失敗しました。");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Navbar />
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📝 新規アンケートを作成</h1>

        <div className="bg-white rounded-xl border shadow p-6 space-y-6">
          {/* 基本情報 */}
          <div>
            <label className="block text-gray-700 mb-1">タイトル</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-black"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">説明（任意）</label>
            <textarea
              rows={3}
              className="w-full border rounded px-3 py-2 text-black"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 対象ジャンル（複数選択） */}
          <div>
            <p className="text-gray-700 font-semibold mb-2">配信するジャンル（複数選択可）</p>
            <div className="flex flex-wrap gap-4 text-black">
              {[
                { key: "karaoke", label: "カラオケ" },
                { key: "food", label: "飲食" },
                { key: "shop", label: "ショップ巡り" },
              ].map((g) => (
                <label key={g.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={targetGenres.includes(g.key)}
                    onChange={() => toggleGenre(g.key)}
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </div>

          {/* 公開状態 */}
          <div>
            <p className="text-gray-700 font-semibold mb-2">公開設定</p>
            <div className="flex gap-6 text-black">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={status === "draft"}
                  onChange={() => setStatus("draft")}
                />
                下書き
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={status === "published"}
                  onChange={() => setStatus("published")}
                />
                公開
              </label>
            </div>
          </div>

          {/* 主質問タイプ選択 */}
          <div>
            <p className="text-gray-700 font-semibold mb-2">主質問の形式（いずれか一方）</p>
            <div className="flex gap-6 text-black mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={primaryType === "choice"}
                  onChange={() => setPrimaryType("choice")}
                />
                選択式
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={primaryType === "rating"}
                  onChange={() => setPrimaryType("rating")}
                />
                5段階評価
              </label>
            </div>

            {primaryType === "choice" ? (
              <div className="space-y-3">
                <label className="block text-gray-700">設問タイトル</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-black"
                  placeholder="例：イベント全体の満足度はいかがでしたか？"
                  value={choiceTitle}
                  onChange={(e) => setChoiceTitle(e.target.value)}
                />
                <p className="text-gray-700 mt-2 font-medium">選択肢</p>
                {choiceOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      className="flex-1 border rounded px-3 py-2 text-black"
                      value={opt}
                      onChange={(e) => updateChoiceOption(i, e.target.value)}
                      placeholder={`選択肢 ${i + 1}`}
                    />
                    {choiceOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeChoiceOption(i)}
                        className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChoiceOption}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  ＋ 選択肢を追加
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-gray-700">設問タイトル</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-black"
                  placeholder="例：このイベントを友人に勧めたいですか？（1〜5）"
                  value={ratingTitle}
                  onChange={(e) => setRatingTitle(e.target.value)}
                />
                <p className="text-sm text-gray-600">
                  評価は <span className="font-semibold">1〜5</span> の5段階で回答されます。
                </p>
              </div>
            )}
          </div>

          {/* 記述式（任意） */}
          <div>
            <p className="text-gray-700 font-semibold mb-2">記述式（任意で追加可）</p>
            {textQuestions.length === 0 && (
              <p className="text-sm text-gray-500 mb-2">まだ設問はありません。</p>
            )}
            <div className="space-y-3">
              {textQuestions.map((q, i) => (
                <div key={i} className="border rounded p-3 bg-white/70">
                  <label className="block text-gray-700 text-sm mb-1">設問タイトル</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-black"
                    value={q.title}
                    onChange={(e) => updateText(i, "title", e.target.value)}
                  />
                  <label className="block text-gray-700 text-sm mt-2 mb-1">
                    プレースホルダ（任意）
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-black"
                    value={q.placeholder}
                    onChange={(e) => updateText(i, "placeholder", e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-black">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateText(i, "required", e.target.checked)}
                      />
                      必須にする
                    </label>
                    <button
                      type="button"
                      onClick={() => removeText(i)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addText}
              className="mt-3 px-3 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
            >
              ＋ 記述式を追加
            </button>
          </div>

          {/* 操作ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              className="px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              アンケートを作成
            </button>
            <button
              onClick={() => router.push("/admin/surveys")}
              className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
            >
              キャンセル（一覧に戻る）
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}