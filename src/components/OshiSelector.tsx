// components/OshiSelector.tsx
"use client";

import { useState, useMemo } from "react";
import { HOLOLIVE_GROUPS, getMemberEmoji } from "@/lib/hololiveMembers";

type Props = {
  value: string;
  onChange: (name: string) => void;
};

/* ひらがな ↔ カタカナ正規化 */
function toHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
function normalizeKana(str: string): string {
  return toHiragana(str).toLowerCase();
}

/* グループカラー設定 */
const GROUP_STYLE: Record<string, { active: string; dot: string }> = {
  jp:    { active: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm", dot: "bg-blue-500" },
  id:    { active: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm",    dot: "bg-red-500"  },
  en:    { active: "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm", dot: "bg-violet-500" },
  devis: { active: "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm", dot: "bg-teal-500" },
};
const INACTIVE_GROUP   = "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50";
const SUBGROUP_ACTIVE  = "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-sm";
const SUBGROUP_INACTIVE = "bg-white border border-gray-200 text-gray-600 hover:border-pink-200 hover:text-pink-600 hover:bg-pink-50";

export default function OshiSelector({ value, onChange }: Props) {
  const [selectedGroupId,    setSelectedGroupId]    = useState<string>("");
  const [selectedSubGroupId, setSelectedSubGroupId] = useState<string>("");
  const [searchQuery,        setSearchQuery]        = useState<string>("");

  const selectedGroup    = HOLOLIVE_GROUPS.find((g)  => g.id  === selectedGroupId);
  const selectedSubGroup = selectedGroup?.subGroups.find((sg) => sg.id === selectedSubGroupId);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId === selectedGroupId ? "" : groupId);
    setSelectedSubGroupId("");
    setSearchQuery("");
  };

  const handleSubGroupSelect = (subGroupId: string) => {
    setSelectedSubGroupId(subGroupId === selectedSubGroupId ? "" : subGroupId);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
    setSelectedGroupId("");
    setSelectedSubGroupId("");
    setSearchQuery("");
  };

  const filteredMembers = useMemo(() => {
    if (!selectedSubGroup) return [];
    const q = normalizeKana(searchQuery.trim());
    if (!q) return selectedSubGroup.members;
    return selectedSubGroup.members.filter((m) =>
      normalizeKana(m.name).includes(q)
    );
  }, [selectedSubGroup, searchQuery]);

  const currentEmoji = getMemberEmoji(value);

  return (
    <div className="space-y-6">

      {/* ══════════════════════════════════
          現在の最推し表示
      ══════════════════════════════════ */}
      {value ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 p-5 text-white shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -right-1 -bottom-6 w-16 h-16 bg-white/10 rounded-full pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <span className="text-4xl drop-shadow select-none leading-none shrink-0">{currentEmoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">最推し</p>
              <span className="text-xl font-extrabold truncate block">{value}</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition"
            >
              変更
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-5 py-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
          <span className="text-3xl select-none">💫</span>
          <p className="text-sm font-medium">推しを選んでください</p>
        </div>
      )}

      {/* ══════════════════════════════════
          Step 1 ── グループ
      ══════════════════════════════════ */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          グループを選ぶ
        </p>
        <div className="grid grid-cols-2 gap-2">
          {HOLOLIVE_GROUPS.map((g) => {
            const isActive = selectedGroupId === g.id;
            const style    = GROUP_STYLE[g.id] ?? GROUP_STYLE.jp;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGroupSelect(g.id)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive ? style.active : INACTIVE_GROUP
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-white" : style.dot}`} />
                <span className="truncate">{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════
          Step 2 ── サブグループ
      ══════════════════════════════════ */}
      {selectedGroup && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            ユニット / 期を選ぶ
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedGroup.subGroups.map((sg) => {
              const isActive = selectedSubGroupId === sg.id;
              return (
                <button
                  key={sg.id}
                  type="button"
                  onClick={() => handleSubGroupSelect(sg.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive ? SUBGROUP_ACTIVE : SUBGROUP_INACTIVE
                  }`}
                >
                  {sg.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          Step 3 ── メンバー
      ══════════════════════════════════ */}
      {selectedSubGroup && (
        <div>
          {/* 検索バー */}
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none select-none text-sm">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前で絞り込み（ひらがな・カタカナOK）"
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-800 text-sm bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            )}
          </div>

          {/* 0件 */}
          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <span className="text-3xl select-none">🔍</span>
              <p className="text-sm">「{searchQuery}」に一致するメンバーが見つかりません</p>
            </div>
          ) : (
            <>
              {searchQuery && (
                <p className="text-xs text-gray-400 mb-3">{filteredMembers.length} 件ヒット</p>
              )}

              {/* メンバーグリッド */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredMembers.map((m) => {
                  const isSelected = value === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChange(m.name)}
                      className={`relative flex items-center gap-2 px-3 py-3.5 rounded-2xl text-sm font-bold text-left transition-all duration-150 ${
                        isSelected
                          ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg scale-[1.04] ring-2 ring-pink-300 ring-offset-1"
                          : "bg-white border border-gray-200 text-gray-700 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700 hover:shadow-sm active:scale-95"
                      }`}
                    >
                      {/* チェックマーク */}
                      {isSelected && (
                        <span className="absolute top-2 right-2.5 text-[10px] font-black text-white/90">
                          ✓
                        </span>
                      )}
                      {/* 推しマーク（改行・崩れ防止のため shrink-0） */}
                      <span className="shrink-0 text-base leading-none select-none">
                        {m.emoji}
                      </span>
                      {/* 名前（長い場合は折り返し） */}
                      <span className="leading-tight min-w-0 break-words">
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
