import { NextRequest, NextResponse } from "next/server";
import { chat, getLlmConfig } from "@/lib/llm-server";

/**
 * 群聊一轮发言 —— 每个 AI 人设独立调起自己的 LLM(key 按人设序号分配);
 * 轮内串行:后者能读到前者本轮的发言,避免互相重复/打架
 * POST /api/llm/turn
 *   { transcript, personas: [{id,name,profile}], speakers: string[],
 *     mode: "opening" | "continue" | "invite" | "answer",
 *     history: [{speakerId,text}], userName?: string }
 *   → { turns: [{ speakerId, text }] }   // 选择沉默的角色不出现在结果里
 *
 * 群聊节奏(docs/product-flow.md F4 板块二):
 *   opening  暖场,全员必须开口
 *   continue 用户沉默时 AI 之间续聊,允许沉默,禁止争论/复读(防打架防卡死)
 *   invite   用户持续沉默,点名邀请用户带入的角色(必须开口)
 *   answer   用户刚发言,所有 AI 直接回应用户(必须开口)
 *
 * 未配置 LLM → 503(前端不再回退 mock,对话链路全真实)。
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PersonaIn {
  id: string;
  name: string;
  profile: string;
}

type TurnMode = "opening" | "continue" | "invite" | "answer";

const systemFor = (p: PersonaIn, transcript: string) => `You are ${p.name}, a character in a small, gentle group chat gathered around someone's day.
Your character: ${p.profile}
The story, told by the narrator: """${transcript}"""
Rules:
- Speak in character: warm, casual, honest. Never summarize the story, never lecture.
- ONE message only, max 30 words, same language as the story.
- If this moment doesn't call for you, reply with exactly: SILENT`;

function promptFor(mode: TurnMode, historyText: string, userName: string): string {
  switch (mode) {
    case "opening":
      return "The story has just been told, and everyone is hearing it for the first time. Give your first reaction. You must speak.";
    case "continue":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\nA quiet lull has fallen — but the gathering isn't over. Share ONE small new beat: a gentle observation, a memory this reminds you of, or a soft question to the others. Do NOT argue, do NOT contradict, do NOT repeat what was said. Only if you truly have nothing new: reply SILENT.`;
    case "invite":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\n${userName} has been quiet for a while. Address them BY NAME, gently, and invite them in with one small, easy question. You must speak.`;
    case "answer":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\n${userName} just spoke. Respond to THEM directly, in character. You must speak.`;
  }
}

export async function POST(req: NextRequest) {
  const cfg = getLlmConfig();
  if (!cfg) return NextResponse.json({ message: "LLM 未配置" }, { status: 503 });

  let body: {
    transcript?: string;
    personas?: PersonaIn[];
    speakers?: string[];
    mode?: TurnMode;
    history?: Array<{ speakerId: string; text: string }>;
    userName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "请求体不是合法 JSON" }, { status: 422 });
  }
  const { transcript, personas = [], speakers = [], mode = "answer", history = [], userName = "the narrator" } = body;
  if (!transcript || personas.length === 0 || speakers.length === 0) {
    return NextResponse.json({ message: "transcript / personas / speakers 缺失" }, { status: 422 });
  }

  const nameOf = (id: string) =>
    id === "user" ? userName : personas.find((p) => p.id === id)?.name ?? id;
  const historyText = history
    .slice(-12)
    .map((h) => `${nameOf(h.speakerId)}: ${h.text}`)
    .join("\n");
  const prompt = promptFor(mode, historyText, userName);

  try {
    // 轮内串行:后者能读到本轮前者的发言,避免互相重复/打架(防卡死由客户端节奏状态机兜底)
    const turns: Array<{ speakerId: string; text: string }> = [];
    const roundLines: string[] = [];
    for (const id of speakers) {
      const p = personas.find((x) => x.id === id);
      if (!p) continue;
      const keyIndex = personas.indexOf(p); // 第 i 个角色 → 第 i 个 key
      const visiblePrompt =
        roundLines.length > 0
          ? `${prompt}\n\nThis round, others have already said:\n${roundLines.join("\n")}\nDo not echo their point — add something only YOU would say.`
          : prompt;
      let text = await chat(cfg, {
        keyIndex,
        system: systemFor(p, transcript),
        user: visiblePrompt,
        maxTokens: 800,
      });
      // answer/invite/opening 是必答轮:模型仍沉默 → 加一句硬指令重试一次
      if (/^SILENT\b/i.test(text.trim()) && mode !== "continue") {
        text = await chat(cfg, {
          keyIndex,
          system: systemFor(p, transcript),
          user: `${visiblePrompt}\n\nYou MUST say something. One short sentence is enough.`,
          maxTokens: 800,
        });
      }
      if (!text || /^SILENT\b/i.test(text.trim())) continue; // 该角色本轮沉默
      // 清洗:剥掉模型偶尔自带的 "名字:" 前缀和首尾引号
      let clean = text.replace(/^["']|["']$/g, "").trim();
      clean = clean.replace(new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：]\\s*`), "");
      turns.push({ speakerId: id, text: clean });
      roundLines.push(`${p.name}: ${clean}`);
      if (turns.length >= 2) break; // 最多 2 位开口,避免刷屏
    }
    return NextResponse.json({ turns });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "LLM 调用失败" }, { status: 502 });
  }
}
