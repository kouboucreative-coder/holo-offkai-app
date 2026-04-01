// lib/hololiveMembers.ts
// ホロライブメンバーデータ
// 構造: Group > SubGroup > Member

export type HololiveMember = {
  id: string;
  name: string;
  /** 推しマーク絵文字（複数絵文字の場合も文字列として保持） */
  emoji: string;
};

export type HololiveSubGroup = {
  id: string;
  name: string;
  members: HololiveMember[];
};

export type HololiveGroup = {
  id: string;
  name: string;
  subGroups: HololiveSubGroup[];
};

export const HOLOLIVE_GROUPS: HololiveGroup[] = [
  /* ============================================================
     ホロライブJP
  ============================================================ */
  {
    id: "jp",
    name: "ホロライブJP",
    subGroups: [
      {
        id: "jp-0th",
        name: "0期生",
        members: [
          { id: "jp-0th-001", name: "ときのそら",   emoji: "🐻💿" },
          { id: "jp-0th-002", name: "ロボ子さん",   emoji: "🤖"   },
          { id: "jp-0th-003", name: "AZKi",         emoji: "⚒️"   },
          { id: "jp-0th-004", name: "さくらみこ",   emoji: "🌸"   },
          { id: "jp-0th-005", name: "星街すいせい", emoji: "☄️"   },
        ],
      },
      {
        id: "jp-1st",
        name: "1期生",
        members: [
          { id: "jp-1st-001", name: "アキ・ローゼンタール", emoji: "🍎"     },
          { id: "jp-1st-002", name: "赤井はあと",           emoji: "❤️‍🔥"   },
          { id: "jp-1st-003", name: "白上フブキ",           emoji: "🌽"     },
          { id: "jp-1st-004", name: "夏色まつり",           emoji: "🏮"     },
        ],
      },
      {
        id: "jp-2nd",
        name: "2期生",
        members: [
          { id: "jp-2nd-001", name: "百鬼あやめ", emoji: "😈" },
          { id: "jp-2nd-002", name: "癒月ちょこ", emoji: "💋" },
          { id: "jp-2nd-003", name: "大空スバル", emoji: "🚑" },
        ],
      },
      {
        id: "jp-gamers",
        name: "ゲーマーズ",
        members: [
          { id: "jp-gamers-001", name: "白上フブキ", emoji: "🌽" },
          { id: "jp-gamers-002", name: "大神ミオ",   emoji: "🌲" },
          { id: "jp-gamers-003", name: "猫又おかゆ", emoji: "🍙" },
          { id: "jp-gamers-004", name: "戌神ころね", emoji: "🥐" },
        ],
      },
      {
        id: "jp-3rd",
        name: "3期生",
        members: [
          { id: "jp-3rd-001", name: "兎田ぺこら",   emoji: "👯‍♀️"  },
          { id: "jp-3rd-002", name: "不知火フレア", emoji: "🔥"    },
          { id: "jp-3rd-003", name: "白銀ノエル",   emoji: "⚔️"    },
          { id: "jp-3rd-004", name: "宝鐘マリン",   emoji: "🏴‍☠️"  },
        ],
      },
      {
        id: "jp-4th",
        name: "4期生",
        members: [
          { id: "jp-4th-001", name: "角巻わため", emoji: "🐏" },
          { id: "jp-4th-002", name: "常闇トワ",   emoji: "👾" },
          { id: "jp-4th-003", name: "姫森ルーナ", emoji: "🍬" },
        ],
      },
      {
        id: "jp-5th",
        name: "5期生",
        members: [
          { id: "jp-5th-001", name: "雪花ラミィ", emoji: "☃️"   },
          { id: "jp-5th-002", name: "桃鈴ねね",   emoji: "🍑🥟" },
          { id: "jp-5th-003", name: "獅白ぼたん", emoji: "♌"    },
          { id: "jp-5th-004", name: "尾丸ポルカ", emoji: "🎪"   },
        ],
      },
      {
        id: "jp-holox",
        name: "holoX",
        members: [
          { id: "jp-holox-001", name: "ラプラス・ダークネス", emoji: "🛸💜" },
          { id: "jp-holox-002", name: "鷹嶺ルイ",             emoji: "🥀"   },
          { id: "jp-holox-003", name: "博衣こより",           emoji: "🧪"   },
          { id: "jp-holox-004", name: "風真いろは",           emoji: "🍃"   },
        ],
      },
    ],
  },

  /* ============================================================
     ホロライブインドネシア
  ============================================================ */
  {
    id: "id",
    name: "ホロライブID",
    subGroups: [
      {
        id: "id-1st",
        name: "1期生",
        members: [
          { id: "id-1st-001", name: "アユンダ・リス",         emoji: "🐿️" },
          { id: "id-1st-002", name: "ムーナ・ホシノヴァ",     emoji: "🔮" },
          { id: "id-1st-003", name: "アイラニ・イオフィフティーン", emoji: "🎨" },
        ],
      },
      {
        id: "id-2nd",
        name: "2期生",
        members: [
          { id: "id-2nd-001", name: "クレイジー・オリー",   emoji: "🧟‍♀️" },
          { id: "id-2nd-002", name: "アーニャ・メルフィッサ", emoji: "🍂"  },
          { id: "id-2nd-003", name: "パヴォリア・レイネ",   emoji: "🦚"   },
        ],
      },
      {
        id: "id-3rd",
        name: "3期生",
        members: [
          { id: "id-3rd-001", name: "ベスティア・ゼータ",     emoji: "📜" },
          { id: "id-3rd-002", name: "カエラ・コヴァルスキア", emoji: "🔨" },
          { id: "id-3rd-003", name: "こぼ・かなえる",         emoji: "☔" },
        ],
      },
    ],
  },

  /* ============================================================
     ホロライブEnglish
  ============================================================ */
  {
    id: "en",
    name: "ホロライブEN",
    subGroups: [
      {
        id: "en-myth",
        name: "Myth",
        members: [
          { id: "en-myth-001", name: "森カリオペ",   emoji: "💀" },
          { id: "en-myth-002", name: "小鳥遊キアラ", emoji: "🐔" },
          { id: "en-myth-003", name: "一伊那尓栖",   emoji: "🐙" },
        ],
      },
      {
        id: "en-promise",
        name: "Promise",
        members: [
          { id: "en-promise-001", name: "IRyS",           emoji: "💎" },
          { id: "en-promise-002", name: "オーロ・クロニー", emoji: "⏳" },
          { id: "en-promise-003", name: "ハコス・ベールズ", emoji: "🎲" },
        ],
      },
      {
        id: "en-advent",
        name: "Advent",
        members: [
          { id: "en-advent-001", name: "シオリ・ノヴェラ",         emoji: "👁️‍🗨️" },
          { id: "en-advent-002", name: "古石ビジュー",             emoji: "🗿"    },
          { id: "en-advent-003", name: "ネリッサ・レイヴンクロフト", emoji: "🎼"   },
          { id: "en-advent-004", name: "フワワ・アビスガード",     emoji: "🐾🩵"  },
          { id: "en-advent-005", name: "モココ・アビスガード",     emoji: "🐾🩷"  },
        ],
      },
      {
        id: "en-justice",
        name: "Justice",
        members: [
          { id: "en-justice-001", name: "エリザベス・ローズ・ブラッドフレイム", emoji: "💄" },
          { id: "en-justice-002", name: "ジジ・ムリン",             emoji: "👧" },
          { id: "en-justice-003", name: "セシリア・イマーグリーン", emoji: "🍵" },
          { id: "en-justice-004", name: "ラオーラ・パンテーラ",     emoji: "🐱" },
        ],
      },
    ],
  },

  /* ============================================================
     hololive DEV_IS
  ============================================================ */
  {
    id: "devis",
    name: "hololive DEV_IS",
    subGroups: [
      {
        id: "devis-regloss",
        name: "ReGLOSS",
        members: [
          { id: "devis-regloss-001", name: "音乃瀬奏",     emoji: "🎹✨" },
          { id: "devis-regloss-002", name: "一条莉々華",   emoji: "🌃"   },
          { id: "devis-regloss-003", name: "儒烏風亭らでん", emoji: "🐚" },
          { id: "devis-regloss-004", name: "轟はじめ",     emoji: "🐧⚡" },
        ],
      },
      {
        id: "devis-flowglow",
        name: "FLOW GLOW",
        members: [
          { id: "devis-flowglow-001", name: "響咲リオナ",   emoji: "🎤👑"   },
          { id: "devis-flowglow-002", name: "虎金妃笑虎",   emoji: "☺️🐅"  },
          { id: "devis-flowglow-003", name: "水宮枢",       emoji: "💬🔁💙" },
          { id: "devis-flowglow-004", name: "輪堂千速",     emoji: "🎧🔧"  },
          { id: "devis-flowglow-005", name: "綺々羅々ヴィヴィ", emoji: "💅✨" },
        ],
      },
    ],
  },
];

/* ============================================================
   名前 → 推しマーク の高速ルックアップテーブル
   （重複メンバーは同じ絵文字を返す）
============================================================ */
export const MEMBER_EMOJI_MAP: Record<string, string> = Object.fromEntries(
  HOLOLIVE_GROUPS.flatMap((g) =>
    g.subGroups.flatMap((sg) =>
      sg.members.map((m) => [m.name, m.emoji] as [string, string])
    )
  )
);

/**
 * メンバー名から推しマークを返す。
 * データに登録されていない場合は "💫" を返す。
 */
export function getMemberEmoji(name: string): string {
  if (!name) return "";
  return MEMBER_EMOJI_MAP[name] ?? "💫";
}

/**
 * メンバー名からグループ・サブグループを逆引きする
 */
export function findMemberByName(name: string): {
  group: HololiveGroup;
  subGroup: HololiveSubGroup;
  member: HololiveMember;
} | null {
  for (const group of HOLOLIVE_GROUPS) {
    for (const subGroup of group.subGroups) {
      const member = subGroup.members.find((m) => m.name === name);
      if (member) return { group, subGroup, member };
    }
  }
  return null;
}

/**
 * 全メンバー名のフラットリスト（重複除去済み）
 * 検索・フィルター用
 */
export const ALL_MEMBER_NAMES: string[] = Array.from(
  new Set(
    HOLOLIVE_GROUPS.flatMap((g) =>
      g.subGroups.flatMap((sg) => sg.members.map((m) => m.name))
    )
  )
);
