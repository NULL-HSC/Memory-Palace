/** 数据模型 — 理理理.md §9 */

export type CharacterId = "pico" | "mira" | "renn" | "tola" | "sena" | "ivo" | "user";

export interface Story {
  id: string;
  title: string; // LLM 建议，可编辑
  date: string; // 展示用长日期，如 "the twelfth of June, 2024"
  cover: string; // 占位封面 id（后续换正式设计）
  transcript: string; // 完整转写
  reflection?: string; // F3 可选反思输入
  visibility?: "private" | "friends" | "community"; // Keep 时选择：仅自己 / 朋友 / 公开
  createdAt: number;
  /** 真后端会话标识；未配置后端的本地演示中为空。 */
  backendSessionId?: string;
  /** 创建会话时后端返回的视频生成任务标识。 */
  backendVideoTaskId?: string;
}

export interface Character {
  id: Exclude<CharacterId, "user">;
  name: string;
  species: string; // dog / cat / fox / bear / bunny / owl
  personality: string; // LLM 人设描述（§3）
  color: string; // 角色主色（占位美术用）
}

/** 从用户故事里提取的人设 Top 3（契约: GET /api/sessions/{id}/personas）
 *  进沙盘前用户选一个带入;avatar 为图片地址(mock 用本地 PNG,契约字段 avatar_url) */
export interface Persona {
  id: string;
  name: string;
  profile: string;
  avatar: string;
}

export interface DialogueTurn {
  storyId: string;
  speakerId: string; // persona id（板块二:故事 Top 3）或 "user"
  text: string;
  ts: number;
}

/** 群聊一轮中的一条发言（LLM 返回,尚未落进消息列表） */
export interface SpeakerTurn {
  speakerId: string; // persona id
  text: string;
}

export interface Room {
  characterId: Exclude<CharacterId, "user">;
  isOpen: boolean; // 常开；进入房间功能本期不做
}

export interface UserState {
  level: number;
  progress: number; // 0..1，Keep 故事推进
  companionId: "pico";
}

/** 后端统一错误格式（hackathon-plan §3.2） */
export interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}
