/** F2 伪实时转写 —— 预录文本按词节流式上屏（理理理.md §8.1 Demo 降级方案） */

export const MOCK_TRANSCRIPT =
  "Today was strange, in a quiet way. I kept waiting for a gap in the conversation, " +
  "a moment where it would feel natural to say what I actually thought. And the gap never came, " +
  "so I just — held it. All day. It wasn't heavy exactly. It was more like carrying a cup of tea " +
  "that's a little too full. Careful. Warm. A little tiring. When I walked home the sky was doing " +
  "that soft orange thing, and for one block I stopped waiting for a gap and just said it out loud " +
  "to nobody. And honestly? That helped.";

/** 逐词节拍：返回 [word, delayAfterMs]，模拟真实 ASR 的语流顿挫 */
export function transcriptBeats(): Array<{ word: string; delay: number }> {
  return MOCK_TRANSCRIPT.split(" ").map((word) => {
    let delay = 90 + Math.random() * 160; // 基础语流
    if (/[,—]$/.test(word)) delay += 350; // 小停顿
    if (/[.?!…]$/.test(word)) delay += 700; // 句间停顿
    return { word, delay };
  });
}
