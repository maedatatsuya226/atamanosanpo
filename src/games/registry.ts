import { lazy, type ComponentType } from 'react'
import type { DomainId, GameDef, GameProps } from '../core/types'
// 各課題の説明文・難易度の説明(課題フォルダの meta.ts にある)
import { META as COLOR_WORD_META } from './color-word/meta'
import { META as NUMBER_STROKE_META } from './number-stroke/meta'
import { META as PICTURE_MEMORY_META } from './picture-memory/meta'
import { META as SAME_PICTURE_META } from './same-picture/meta'
import { META as SAMEGAME_META } from './samegame/meta'
import { META as STOPWATCH_META } from './stopwatch/meta'
import { META as STORY_MEMORY_META } from './story-memory/meta'
import { META as VIEWPOINT_META } from './viewpoint/meta'

/**
 * 全課題の一覧。component が無いものはホームで「準備中」と表示する。
 * 課題を追加するときは games/<id>/ にコンポーネントを作り、ここで component を指定する。
 */
export const GAMES: readonly GameDef[] = [
  // ---- 空間認識 ----
  {
    id: 'figure-match',
    domain: 'spatial',
    title: '図柄合わせ',
    summary: '見本と同じ図柄を選択肢から選ぶ',
    howTo: ['みほんと おなじ かたちを えらんで ください。'],
    levels: [
      '3択・4マスの図・全8問',
      '4択・4マスの図・1マスだけ違う似た図あり',
      '4択・5マスの図・選択肢が回転している',
      '6択・5マスの図・選択肢が回転している',
      '6択・6マスの図・回転あり・裏返し(鏡像)の図が混ざる',
    ],
    supportsPractice: true,
    ...lazyGame(() => import('./figure-match/FigureMatchGame')),
  },
  {
    id: 'samegame',
    domain: 'spatial',
    title: 'さめがめ',
    ...SAMEGAME_META,
    summary: '同じ色のつながりをタップして消していく',
    description: SAMEGAME_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./samegame/SamegameGame')),
  },
  {
    id: 'viewpoint',
    domain: 'spatial',
    title: '視点あて',
    ...VIEWPOINT_META,
    summary: '積み木を、どの方向から見た絵かを当てる',
    description: VIEWPOINT_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./viewpoint/ViewpointGame')),
  },
  // ---- 見当識 ----
  {
    id: 'orientation-date',
    domain: 'orientation',
    title: 'きょうの日付',
    summary: '月・日・曜日(難易度5は年も)を答え、端末の時計と照合する',
    howTo: ['きょうの ひづけを こたえて ください。', 'わからない ときは「ヒント」を おしても かまいません。'],
    levels: [
      '月・曜日の2問/3択/ヒントあり',
      '月・日・曜日の3問/3択/ヒントあり',
      '月・日・曜日の3問/5択/ヒントあり',
      '月・日・曜日の3問/数字を入力/ヒントなし',
      '年・月・日・曜日の4問/数字を入力/ヒントなし',
    ],
    supportsPractice: false,
    ...lazyGame(() => import('./orientation-date/OrientationDateGame')),
  },
  // ---- 記憶 ----
  {
    id: 'flash-sequence',
    domain: 'memory',
    title: '光った順タップ',
    summary: '光った順番を覚えて、同じ順にタップする',
    howTo: ['ひかった じゅんばんを おぼえて ください。', 'おなじ じゅんばんで タップします。'],
    levels: [
      '3個・ゆっくり(1秒ずつ)・全5回',
      '4個・ゆっくり(1秒ずつ)',
      '5個・ふつう(0.7秒ずつ)',
      '6個・ふつう(0.7秒ずつ)',
      '5個・ゆっくり・逆の順番で答える',
    ],
    supportsPractice: true,
    ...lazyGame(() => import('./flash-sequence/FlashSequenceGame')),
  },
  {
    id: 'picture-memory',
    domain: 'memory',
    title: '絵カード記憶',
    ...PICTURE_MEMORY_META,
    summary: '提示された絵を覚え、あとで選ぶ',
    description: PICTURE_MEMORY_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./picture-memory/PictureMemoryGame')),
  },
  {
    id: 'story-memory',
    domain: 'memory',
    title: 'ストーリー記憶',
    ...STORY_MEMORY_META,
    summary: '短い話を読み(聞き)、内容についての質問に答える',
    description: STORY_MEMORY_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./story-memory/StoryMemoryGame')),
  },
  // ---- 計画 ----
  {
    id: 'number-path',
    domain: 'planning',
    title: '数字たどり',
    summary: '1から順に隣のマスへ進み、ゴールまでたどる',
    howTo: ['1から じゅんばんに となりの マスを タップして すすみます。', 'ゴールまで たどりつきましょう。'],
    levels: [
      '4×4・ゴール8・分岐なし・全3面',
      '5×5・ゴール12・行き止まりの分岐1か所',
      '5×5・ゴール14・分岐3か所',
      '6×6・ゴール18・分岐4か所',
      '7×7・ゴール24・分岐6か所',
    ],
    supportsPractice: true,
    ...lazyGame(() => import('./number-path/NumberPathGame')),
  },
  {
    id: 'kana-order',
    domain: 'planning',
    title: 'あいうえお順タップ',
    summary: '散らばったかなを五十音順にタップする',
    howTo: ['「あ」から じゅんばんに タップして ください。'],
    levels: [
      'あ〜お(5文字)・ます目にそろえて配置',
      'あ〜こ(10文字)・ます目にそろえて配置',
      'あ〜そ(15文字)・ます目にそろえて配置',
      'あ〜と(20文字)・ます目にそろえて配置',
      'あ〜の(25文字)・画面全体にばらばらに配置',
    ],
    supportsPractice: true,
    ...lazyGame(() => import('./kana-order/KanaOrderGame')),
  },
  {
    id: 'number-stroke',
    domain: 'planning',
    title: '数字一筆書き',
    ...NUMBER_STROKE_META,
    summary: 'すべてのマスを一度ずつ通り、数字を順に結んでゴールする',
    description: NUMBER_STROKE_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./number-stroke/NumberStrokeGame')),
  },
  // ---- 注意 ----
  {
    id: 'number-order',
    domain: 'attention',
    title: '数字順タップ',
    summary: '散らばった数字を順にタップする(上位は数字とかなを交互に)',
    howTo: ['1から じゅんばんに タップして ください。'],
    levels: [
      '1〜10・大きな丸',
      '1〜15',
      '1〜25',
      '1〜25・小さな丸を中央に詰めて配置',
      '数字とかなを交互に25個(1→あ→2→い…→13)',
    ],
    supportsPractice: true,
    ...lazyGame(() => import('./number-order/NumberOrderGame')),
  },
  {
    id: 'same-picture',
    domain: 'attention',
    title: '同じ絵さがし',
    ...SAME_PICTURE_META,
    summary: '見本と同じ絵をすべて見つけてタップする',
    description: SAME_PICTURE_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./same-picture/SamePictureGame')),
  },
  {
    id: 'stopwatch',
    domain: 'attention',
    title: 'ストップウォッチ',
    ...STOPWATCH_META,
    summary: '頭の中で数え、指定した秒数でストップを押す',
    description: STOPWATCH_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./stopwatch/StopwatchGame')),
  },
  {
    id: 'color-word',
    domain: 'attention',
    title: '色あて',
    ...COLOR_WORD_META,
    summary: '文字の意味と文字の色が合っているかを答える',
    description: COLOR_WORD_META.summary,
    supportsPractice: true,
    ...lazyGame(() => import('./color-word/ColorWordGame')),
  },
]

/**
 * 課題の画面を「必要になったら読み込む」形で登録する。
 * preload() を準備画面で呼んでおくと、「はじめる」を押す前に読み込みが終わる。
 * 読み込むのはプログラムだけで、問題は課題を始めるたびに新しく作られる。
 */
function lazyGame(load: () => Promise<{ default: ComponentType<GameProps> }>) {
  let pending: ReturnType<typeof load> | null = null
  const loadOnce = () => {
    // 失敗したときは覚えておかず、次に呼ばれたら読み込みなおす
    pending ??= load().catch((err: unknown) => {
      pending = null
      throw err
    })
    return pending
  }
  return {
    component: lazy(loadOnce),
    preload: () => {
      loadOnce().catch(() => {
        // 先読みの失敗は無視する(「はじめる」のときに改めて読み込み、失敗すれば画面で知らせる)
      })
    },
  }
}

export function gamesByDomain(domain: DomainId): GameDef[] {
  return GAMES.filter((g) => g.domain === domain)
}

export function findGame(id: string): GameDef {
  const g = GAMES.find((x) => x.id === id)
  if (!g) throw new Error(`unknown game: ${id}`)
  return g
}
