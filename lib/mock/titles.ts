/** F3 标题建议池 —— 新版后端暂无 title 接口，作为稳定降级。
 *  风格：名词短语、有情绪余味、不剧透，参考 "A Day About Courage" */

export const TITLE_POOL = [
  "差一点就能开口的一天",
  "端了一整天的那杯茶",
  "说给橘色的天空听",
  "安安静静的勇气",
  "一个路口的真心话",
  "一直没来的那个空隙",
];

export function pickMockTitle(transcript: string): string {
  // 轻量“相关感”：按转写长度稳定取一条，同一转写得到同一标题
  const idx = transcript.length % TITLE_POOL.length;
  return TITLE_POOL[idx];
}

/** 长日期格式:"2026年8月26日" */
export function longDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
