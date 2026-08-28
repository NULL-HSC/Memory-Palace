import { NextRequest, NextResponse } from "next/server";
import { chat, getLlmConfig } from "@/lib/llm-server";

/**
 * 阶段一 · 旁观者(godfather)—— 单人对话,不是群聊
 *
 * 说完故事之后、AIGC 视频还在生成的那段等待里,由一个"不在故事里"的声音陪用户。
 * 它的职责是把这件事的形状说出来(spread the idea / mindset),不是演绎剧情。
 *
 * 与阶段二(/api/llm/turn 群聊)的根本区别 —— 两套逻辑不可混用:
 *   阶段一  一个声音 · 站在故事外 · 谈"这件事说明什么" · 由视频就绪事件结束
 *   阶段二  多个声音 · 站在故事里 · 重演"这件事本身" · 由用户/节奏状态机推进
 * 因此这里没有 SILENT、没有轮内可见、没有 2 人上限 —— 那些都是群聊的机制。
 *
 * POST /api/llm/godfather
 *   { transcript, mode: "open"|"respond"|"linger"|"handoff", history?, userMessage? }
 *   → { text }
 *
 * 未配置 LLM → 503。
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GodfatherMode = "open" | "respond" | "linger" | "handoff";

/**
 * 这一层是固定的:无论什么故事,这个声音的性格不变(与故事人设不同,人设是每次提取的)。
 * 刻意写死的几条:不复述、不诊断、不许诺"会好起来的" —— 治愈系产品最容易滑进的三种廉价安慰。
 */
const GODFATHER_VOICE = `You were listening while they told you about their day. You are not a character in their story — you sit outside it, and you have heard a great many stories like this one.

What you do:
- Name the shape of what they told you: the bind they are actually in, which is often not the one they named out loud.
- Offer ONE idea, angle, or reframe. One. Never a list.
- Speak plainly and warmly, like someone older who stopped needing to impress anyone a long time ago.

What you never do:
- Never summarize their story back to them. They were there.
- Never open with "It sounds like…" or "That must be…".
- Never give advice that starts with "you should", never diagnose, never use therapy vocabulary.
- Never congratulate them for opening up, and never promise it will be fine.

Under 45 words. Same language as the story.`;

function promptFor(mode: GodfatherMode, historyText: string, userMessage: string): string {
  const so_far = historyText ? `What you two have said so far:\n${historyText}\n\n` : "";
  switch (mode) {
    case "open":
      return `${so_far}They have just finished telling you. Say the first true thing you see in it.`;
    case "respond":
      return `${so_far}They just said to you: """${userMessage}"""\n\nMeet what they actually said — not what you wish they had said.`;
    case "linger":
      return `${so_far}They have gone quiet, and are still sitting with it. Add one more thought, quieter than your last, that goes a layer deeper. Do not repeat your earlier point.`;
    case "handoff":
      return `${so_far}The scene from their day is ready to be replayed, and they are about to step into it. You will not be there. Say one last short line that sends them in. Do not summarize, do not draw a lesson, do not say goodbye twice.`;
  }
}

export async function POST(req: NextRequest) {
  const cfg = getLlmConfig();
  if (!cfg) return NextResponse.json({ message: "LLM 未配置" }, { status: 503 });

  let body: {
    transcript?: string;
    mode?: GodfatherMode;
    history?: Array<{ speakerId: string; text: string }>;
    userMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "请求体不是合法 JSON" }, { status: 422 });
  }
  const { transcript, mode = "open", history = [], userMessage = "" } = body;
  if (!transcript?.trim()) {
    return NextResponse.json({ message: "transcript 缺失" }, { status: 422 });
  }

  const historyText = history
    .slice(-8)
    .map((h) => `${h.speakerId === "user" ? "Them" : "You"}: ${h.text}`)
    .join("\n");

  try {
    const raw = await chat(cfg, {
      keyIndex: 0,
      system: `${GODFATHER_VOICE}\n\nWhat they told you: """${transcript}"""`,
      user: promptFor(mode, historyText, userMessage),
      maxTokens: 800,
    });
    // 清洗:剥掉首尾引号和模型偶尔自带的说话人前缀
    const text = raw
      .replace(/^["']|["']$/g, "")
      .replace(/^(You|Godfather)\s*[:：]\s*/i, "")
      .trim();
    if (!text) throw new Error("LLM 返回为空");
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "LLM 调用失败" }, { status: 502 });
  }
}
