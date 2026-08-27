import type { Persona } from "../types";

/** 人设提取 mock —— 锚定 MOCK_TRANSCRIPT(waiting for a gap / 对天空说话)
 *  真接口:POST /api/sessions 后由服务端从 final_text 提取 Top 3,GET /api/sessions/{id}/personas
 *  avatar 用占位 PNG,正式美术交付后由服务端 avatar_url 替换 */
export const MOCK_PERSONAS: Persona[] = [
  {
    id: "per-friend",
    name: "The old friend",
    profile: "Calm and direct. Asks the practical questions you usually skip.",
    avatar: "/avatars/av-bear.png",
  },
  {
    id: "per-coworker",
    name: "The coworker",
    profile: "Was in today's conversation too — and never knew about the gap.",
    avatar: "/avatars/av-bunny.png",
  },
  {
    id: "per-sky",
    name: "The sky on the walk home",
    profile: "A very gentle first listener. Already heard it once, orange and all.",
    avatar: "/avatars/av-duck.png",
  },
];
