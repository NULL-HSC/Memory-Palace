import type { Persona } from "../types";

/** 人设提取 mock —— 锚定 MOCK_TRANSCRIPT(waiting for a gap / 对天空说话)
 *  阵容 = 故事 Top 3,含叙述者"我";用户可带入任意一角,未选的由各自 LLM 扮演
 *  真接口:/api/llm/personas(联调后:GET /api/sessions/{id}/personas)
 *  avatar 用占位 PNG,"我"用 companion 图;正式美术交付后由服务端 avatar_url 替换 */
export const MOCK_PERSONAS: Persona[] = [
  {
    id: "per-me",
    name: "Me, the one who held it",
    profile: "That's you — the narrator. Carried a too-full cup of tea all day, carefully.",
    avatar: "/avatars/avatar.png",
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
