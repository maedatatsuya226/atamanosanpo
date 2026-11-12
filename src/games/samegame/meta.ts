/** 課題一覧(registry.ts)に載せる説明 */
export const META: {
  summary: string
  howTo: string[]
  levels: readonly [string, string, string, string, string]
} = {
  summary: '同じ色が2個以上つながったブロックをタップして消し、できるだけ多く消す(色ごとに白い記号つき)',
  howTo: [
    'おなじ いろが 2つ いじょう となりあった ところを タップすると きえます。',
    'うえの ブロックは したへ おちて きます。',
    'できるだけ たくさん けしましょう。',
  ],
  levels: [
    '5×5・3色(25個)・1面(練習は4×4・3色)',
    '6×6・3色(36個)',
    '7×7・4色(49個)',
    '8×8・4色(64個)',
    '10×8・5色(80個)',
  ],
}
