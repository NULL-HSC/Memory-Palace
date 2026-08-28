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
  /** 解构阶段(/api/llm/personas)产出;老故事/后端人设可能没有 → 可选 */
  voice?: string;
  stance?: string;
}

type TurnMode = "opening" | "continue" | "invite" | "answer";

/**
 * 两层 skill 分离,便于分别维护/复用:
 * - ROOM_CONDUCT(common skill):所有人设、所有 mode 共用的房间行为准则 ——
 *   防打架/防复读/防斗嘴的规则都在这里,只改一处。
 * - personaVoice(individual skill):某一个人设的身份与性格,与准则无关。
 * systemFor 把两层拼起来;promptFor(mode 指令)是第三层,随节奏状态变化。
 */
/**
 * SILENT 只在 continue 的 mode 指令里单独授予(见 promptFor)—— 不放在这里。
 * 放在这里会跟 opening/invite/answer 的 "You must speak" 同时出现在同一次请求里,
 * 两条互相矛盾的指令会让模型两头都做:先正常发言,再在末尾附一句多余的 SILENT。
 */
const ROOM_CONDUCT = `Room conduct — the same for everyone in this gathering:
- Speak in character: warm, casual, honest.
- ONE message only, max 30 words, same language as the story.
- Never summarize the story, never lecture, never recap what's already known.
- React to the single most recent thing someone actually said — build on that specific thread, don't open a fresh tangent.
- Don't repeat or restate a point another speaker already made this round.
- Say actual words out loud. At most one brief *action* aside — never a message made only of stage directions.`;

/**
 * 个体 skill —— 只描述"你是谁、你怎么说话、你要什么",不含房间规则。
 * voice/stance 来自上游解构:voice 让三个角色语气不撞车,stance 让他们在同一件事上
 * 真的有分歧(否则群聊会退化成齐声附和)。缺省时回落到只有 profile 的旧行为。
 */
const personaVoice = (p: PersonaIn) =>
  [
    `You are ${p.name}, a character in this gathering.`,
    `Your character: ${p.profile}`,
    p.voice && `How you talk: ${p.voice}`,
    p.stance && `What you want, and where you stand: ${p.stance}`,
  ]
    .filter(Boolean)
    .join("\n");

/**
 * 重演规则(阶段二的核心)—— 转写是"第一次是怎么发生的",不是不可更改的剧本。
 * 用户带入角色后可能说出与原故事完全不同的话;这正是沙盘的意义:看看换一种说法,
 * 事情会怎么走。所以角色必须跟着新分支走,绝不能把用户拉回"可你当时明明说…"。
 * 性格固定,剧情自由;新分支可能更好也可能更糟,不强行圆成温暖结局。
 */
const REPLAY_RULE = `This is a REPLAY of that day, not a retelling of it. The person living it again may now say or do things that never happened the first time.
- Follow them into the new version. Never correct them back to what "really" happened, never reply with "but you said…".
- Your personality never changes. The events are free to.
- Let the new branch land honestly: it may go better than the first time, or worse. Don't force it warm, and don't punish them for trying it.`;

const systemFor = (p: PersonaIn, transcript: string) => `${personaVoice(p)}
How that day went the first time, told by the person who lived it: """${transcript}"""

${REPLAY_RULE}

${ROOM_CONDUCT}`;

/** true only when the WHOLE reply is the abstention token — not just a prefix,
 *  so a reply that ends with a stray "SILENT" after real content doesn't count. */
const isPureSilence = (text: string) => /^SILENT[.!]?$/i.test(text.trim());

function promptFor(mode: TurnMode, historyText: string, userName: string): string {
  switch (mode) {
    case "opening":
      return "The story has just been told, and everyone is hearing it for the first time. Give your first reaction. You must speak.";
    case "continue":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\nA quiet lull has fallen — but the gathering isn't over. Pick up the most recent thread and go one layer deeper: name a specific detail from the story it recalls, a question about it, or what it reveals about them. Do NOT start a new topic, do NOT argue, do NOT repeat what was said. Only if you truly have nothing new, reply with EXACTLY the single word SILENT and nothing else.`;
    case "invite":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\n${userName} has been quiet for a while. Address them BY NAME, gently, and invite them in with one small question tied to a specific detail from the story — not a generic "how are you". You must speak.`;
    case "answer":
      return `Conversation so far:\n${historyText || "(nothing yet)"}\n\n${userName} just spoke — their words are the last line above. Respond to what they ACTUALLY just said, in character, even if it takes the day somewhere it never went the first time. You must speak.`;
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
    userMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "请求体不是合法 JSON" }, { status: 422 });
  }
  const { transcript, personas = [], speakers = [], mode = "answer", history = [], userName = "the narrator", userMessage } = body;
  if (!transcript || personas.length === 0 || speakers.length === 0) {
    return NextResponse.json({ message: "transcript / personas / speakers 缺失" }, { status: 422 });
  }

  const nameOf = (id: string) =>
    id === "user" ? userName : personas.find((p) => p.id === id)?.name ?? id;
  // 客户端 setMessages 是异步的,发起 answer 轮时用户这句往往还没进 history(ref 未随重渲染更新)。
  // 单独收 userMessage 并在此补进对话尾巴 —— 少了这句,角色就是在没看见用户说什么的情况下"回应用户",
  // 重演分支(REPLAY_RULE)也就无从谈起。已在尾部则不重复追加。
  const fullHistory = [...history];
  const lastLine = fullHistory[fullHistory.length - 1];
  if (userMessage?.trim() && !(lastLine?.speakerId === "user" && lastLine.text === userMessage)) {
    fullHistory.push({ speakerId: "user", text: userMessage });
  }
  const historyText = fullHistory
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
      if (isPureSilence(text) && mode !== "continue") {
        text = await chat(cfg, {
          keyIndex,
          system: systemFor(p, transcript),
          user: `${visiblePrompt}\n\nYou MUST say something. One short sentence is enough.`,
          maxTokens: 800,
        });
      }
      if (!text || isPureSilence(text)) continue; // 该角色本轮(仅 continue 允许)沉默
      // 清洗:剥掉模型偶尔自带的 "名字:" 前缀、首尾引号,以及必答轮里模型有时在
      // 正常发言后又画蛇添足附一句 SILENT(见 route 顶部注释,已从系统提示移除该矛盾指令,这里兜底)
      let clean = text.replace(/^["']|["']$/g, "").trim();
      clean = clean.replace(new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：]\\s*`), "");
      clean = clean.replace(/\n*\bSILENT\b\.?\s*$/i, "").trim();
      turns.push({ speakerId: id, text: clean });
      roundLines.push(`${p.name}: ${clean}`);
      if (turns.length >= 2) break; // 最多 2 位开口,避免刷屏
    }
    return NextResponse.json({ turns });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "LLM 调用失败" }, { status: 502 });
  }
}
