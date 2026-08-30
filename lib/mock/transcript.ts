/** F2 伪实时转写 —— 预录文本按词节流式上屏（product-flow.md §8.1 Demo 降级方案） */

export const MOCK_TRANSCRIPT =
  "今天有点奇怪,安安静静的奇怪。我一天都在等一个能开口的空隙,一个可以自然说出真实想法的瞬间。" +
  "结果那个空隙一直没来,我就那么端着,端了一整天。也不是多沉,更像端着一杯太满的茶,小心,温热," +
  "有一点累。回家的路上,天变成很软的橘色,有一个路口,我忘了等空隙,直接说给了空气听。说真的,好多了。";

/** 逐词节拍：返回 [word, delayAfterMs]，模拟真实 ASR 的语流顿挫 */
export function transcriptBeats(): Array<{ word: string; delay: number }> {
  return MOCK_TRANSCRIPT.split(" ").map((word) => {
    let delay = 90 + Math.random() * 160; // 基础语流
    if (/[,—]$/.test(word)) delay += 350; // 小停顿
    if (/[.?!…]$/.test(word)) delay += 700; // 句间停顿
    return { word, delay };
  });
}
