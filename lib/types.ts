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
  backendVideoStatus?: string;
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
  /** 说话方式 —— 驱动群聊里这个角色的语气/用词/回避什么;缺省时只按 profile 演 */
  voice?: string;
  /** 立场与诉求 —— 让几个角色在同一件事上有真实分歧,而不是齐声附和 */
  stance?: string;
  /** 外观描述 —— 交给 VLM 画这个角色(本地演示路径暂无 VLM,先产出备用) */
  appearance?: string;
}

/**
 * 故事解构里的场景部分 —— 交给 VLM 生成情景演绎视频。
 * 与人设同一次 LLM 调用产出,保证"画面里的人"和"群聊里的人"是同一批。
 */
export interface StoryScene {
  setting: string;
  mood: string;
  beats: string[];
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

/**
 * 旁白(上帝视角)的保留 speakerId(2026-08-29 产品确认)。
 * 群聊里除故事角色外还有一个客观陈述的声音;
 * **插入时机完全由后端判断** —— 后端在回复流里带上 speakerId = NARRATOR_ID 的一条,
 * 前端把它渲染成聊天区顶部样式完全不同的旁白气泡,不进普通聊天气泡流。
 */
export const NARRATOR_ID = "narrator";

export interface Room {
  characterId: Exclude<CharacterId, "user">;
  isOpen: boolean; // 常开；进入房间功能本期不做
}

export interface UserState {
  level: number;
  progress: number; // 0..1，Keep 故事推进
  companionId: "pico";
}

/* ── 社区 / 朋友 / 评论(2026-08-29 新增,前端 mock,后端就绪后换数据源) ── */

/** 故事下的留言 —— 来自看过故事的人(visitor)或朋友(friend) */
export interface StoryComment {
  id: string;
  authorName: string;
  /** 留言者的陪伴角色;自己的留言为 "user"(用 companion 头像) */
  authorCharacterId: CharacterId;
  relation: "friend" | "visitor";
  text: string;
  date: string; // 展示用,如 "8月26日" / "刚刚"
}

/** 社区里的其他用户(角色 = 他们的数字人形象) */
export interface CommunityMember {
  id: string;
  name: string;
  characterId: Exclude<CharacterId, "user">;
  bio: string;
  isFriend: boolean;
}

/** 别人公开的 Story */
export interface CommunityStory {
  id: string;
  ownerId: string; // CommunityMember.id
  title: string;
  date: string;
  cover: string;
  excerpt: string; // 信息流里展示的一小段
  transcript: string;
  comments: StoryComment[];
}

/** 个人资料 —— 安全设置 + 数字人生成资料(角色特征/记忆),localStorage 持久化 */
export interface ProfileData {
  username: string;
  phone: string; // 展示时脱敏
  traits: string[]; // 角色特征
  memories: string[]; // 记忆条目
}

/** 后端统一错误格式（hackathon-plan §3.2） */
export interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
}
