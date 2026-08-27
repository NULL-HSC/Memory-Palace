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
}

export interface Character {
  id: Exclude<CharacterId, "user">;
  name: string;
  species: string; // dog / cat / fox / bear / bunny / owl
  personality: string; // LLM 人设描述（§3）
  color: string; // 角色主色（占位美术用）
}

export interface DialogueTurn {
  storyId: string;
  speakerId: CharacterId;
  text: string;
  ts: number;
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
