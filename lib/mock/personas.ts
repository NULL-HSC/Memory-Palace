import type { Persona } from "../types";

/** 人设提取 mock —— 锚定 MOCK_TRANSCRIPT(waiting for a gap / 对天空说话)
 *  阵容 = 故事 Top 3,含叙述者"我";用户可带入任意一角,未选的由各自 LLM 扮演
 *  真接口:/api/llm/personas(联调后:GET /api/sessions/{id}/personas)
 *  avatar 用占位 PNG,"我"用 companion 图;正式美术交付后由服务端 avatar_url 替换 */
export const MOCK_PERSONAS: Persona[] = [
  {
    id: "per-me",
    name: "我,憋了一整天的那个",
    profile: "就是你自己——端着一杯太满的茶,小心走了一天的人。",
    avatar: "/avatars/av-cat.png",
  },
  {
    id: "per-coworker",
    name: "那个同事",
    profile: "也在今天那场对话里,却从不知道你一直在等一个开口的空隙。",
    avatar: "/avatars/av-glasses.png",
  },
  {
    id: "per-sky",
    name: "回家路上的那片天",
    profile: "最温柔的第一个听众。橘色的傍晚里,已经听过一次了。",
    avatar: "/avatars/av-bunny.png",
  },
];
