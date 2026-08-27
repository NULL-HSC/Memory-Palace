import type { CharacterId, DialogueTurn } from "../types";

/** F4 脚本对白 —— mock；真接口为 POST /sandplay/turn（理理理.md §8.3）
 *  约束：每句 ≤30 词，口语、温柔、不总结；Pico 只是声音之一，不主持。 */

/** 开场轮：默认 Mira → Renn → Pico，话题锚定转写关键句（"waiting for a gap"） */
export const OPENING_TURNS: Array<{ speakerId: CharacterId; text: string }> = [
  {
    speakerId: "mira",
    text: "You said you kept waiting for a gap. Waiting for whose permission, I wonder?",
  },
  {
    speakerId: "renn",
    text: "Hmm. And the gap never came — so the room never actually turned you down. You did, on its behalf.",
  },
  {
    speakerId: "pico",
    text: "But you said it to the sky on the walk home. I was there for that part. That counted.",
  },
];

/** 用户发言后：1–2 位角色依次回应；按回应游标轮转，保证不重样 */
const RESPONSE_POOL: Array<{ speakerId: CharacterId; text: string }> = [
  {
    speakerId: "tola",
    text: "That sounds tiring — the careful kind of tiring. You set the cup down now. It's okay.",
  },
  {
    speakerId: "mira",
    text: "If the gap never appears on its own, what would it cost to make one? Just a small one.",
  },
  {
    speakerId: "renn",
    text: "Notice it wasn't courage you were missing today. It was an opening. Those are different things.",
  },
  {
    speakerId: "sena",
    text: "I like that the sky got to hear it first. The sky is a very gentle first listener.",
  },
  {
    speakerId: "pico",
    text: "You carried it all day and it didn't spill. Tomorrow you could carry it a little less carefully.",
  },
  {
    speakerId: "ivo",
    text: "One observation: the moment you spoke to nobody, the waiting stopped. Interesting, no?",
  },
];

/** 安静收敛：用户不发言时，少量轮次后自然归于安静（不无限自聊） */
export const QUIET_CLOSING: Array<{ speakerId: CharacterId; text: string }> = [
  { speakerId: "sena", text: "…the fire is nice tonight. We can just sit with it for a while." },
  { speakerId: "tola", text: "No rush. The room stays open. We're right here when words come back." },
];

let cursor = 0;

/** 取 1–2 条回应（模拟单 LLM + 角色路由的一轮输出） */
export function nextResponseTurns(): Array<{ speakerId: CharacterId; text: string }> {
  const count = Math.random() < 0.45 ? 2 : 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(RESPONSE_POOL[cursor % RESPONSE_POOL.length]);
    cursor++;
  }
  return out;
}

export function toTurn(storyId: string, t: { speakerId: CharacterId; text: string }): DialogueTurn {
  return { storyId, speakerId: t.speakerId, text: t.text, ts: Date.now() };
}
