/** F3 标题建议池 —— mock；真接口为 POST /ai/title（理理理.md §8.2）
 *  风格：名词短语、有情绪余味、不剧透，参考 "A Day About Courage" */

export const TITLE_POOL = [
  "A Day of Almost-Gaps",
  "The Tea I Carried All Day",
  "Saying It to the Orange Sky",
  "A Quiet Kind of Brave",
  "One Block of Honesty",
  "The Gap That Never Came",
];

export function pickMockTitle(transcript: string): string {
  // 轻量“相关感”：按转写长度稳定取一条，同一转写得到同一标题
  const idx = transcript.length % TITLE_POOL.length;
  return TITLE_POOL[idx];
}

/** 长日期格式："the twenty-sixth of August, 2026" */
export function longDate(d: Date): string {
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const ordinals: Record<number, string> = {
    1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth",
    7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 11: "eleventh", 12: "twelfth",
    13: "thirteenth", 14: "fourteenth", 15: "fifteenth", 16: "sixteenth",
    17: "seventeenth", 18: "eighteenth", 19: "nineteenth", 20: "twentieth",
    21: "twenty-first", 22: "twenty-second", 23: "twenty-third", 24: "twenty-fourth",
    25: "twenty-fifth", 26: "twenty-sixth", 27: "twenty-seventh", 28: "twenty-eighth",
    29: "twenty-ninth", 30: "thirtieth", 31: "thirty-first",
  };
  const day = ordinals[d.getDate()] ?? ord(d.getDate());
  return `the ${day} of ${months[d.getMonth()]}, ${d.getFullYear()}`;
}
