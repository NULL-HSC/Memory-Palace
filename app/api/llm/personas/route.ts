import { NextRequest, NextResponse } from "next/server";
import { chat, getLlmConfig } from "@/lib/llm-server";

/**
 * 故事解构 —— 把一段自然口述的日常,拆成「场景」+「角色」两份产物。
 * 这一步在整条链路的最上游,后面每一环都吃它的输出:
 *   scene    → 交给 VLM 生成情景演绎视频(本地演示路径暂无 VLM,先产出备用)
 *   appearance → 同样给 VLM,保证画面里的人就是群聊里的人
 *   name/profile → PickRole 给用户选"带入谁"
 *   voice/stance → 阶段二群聊里这个角色怎么说话、站在哪一边(见 /api/llm/turn)
 * 一次 LLM 调用同时产出场景与角色,避免分两次调用导致「画面里的人」和「群聊里的人」对不上。
 *
 * POST /api/llm/personas  { transcript }
 *   → { scene: {setting,mood,beats[]}, personas: [{ id,name,profile,voice,stance,appearance,isUser }] }
 * 未配置 LLM → 503。契约对应:GET /api/sessions/{id}/personas。
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You turn a spoken, first-person account of someone's day into the scene and cast for a small sandplay reenactment.

Return ONLY valid JSON, no markdown:
{"scene":{"setting":"...","mood":"...","beats":["...","..."]},
 "personas":[{"name":"...","profile":"...","voice":"...","stance":"...","appearance":"...","is_user":true|false}]}

The account was spoken aloud, so it is vague, repetitive and out of order. Your job is to find the people inside it — including the ones mentioned only as a blur ("some of my colleagues", "everyone else") — and make each one a specific, separable character.

scene — for the illustrator who will draw this:
- setting: where this happens, one concrete phrase.
- mood: the emotional weather, one phrase.
- beats: 2-4 short visual moments in order. What a viewer would SEE. Never inner monologue.

personas:
- EXACTLY 3 when the account genuinely supports that many; otherwise as many as truly appear, minimum 1.
- Exactly one persona is the teller themselves, marked is_user=true.
- When a vague plural hides more than one distinct pressure, split it into separate characters — but only when the account really shows more than one.
- name: short and specific to this account, never a bare generic label like "Friend" or "Colleague"; for the teller, a warm self-name like "Me, the one who …" is welcome.
- profile: ONE sentence, max 25 words — who they are and their part in what happened.
- voice: HOW this one SOUNDS when they speak — rhythm, vocabulary, what they dodge or over-explain. One sentence. No two characters may share a voice. Every persona will be a speaking participant in a live group chat, so never describe one as silent, absent, wordless, or "implied only": a presence that never actually spoke in the account still gets a real speaking voice here.
- stance: what this one wants, and where they stand on the tension at the centre of the account. One sentence. Stances must genuinely differ, so the room has real friction rather than agreement.
- appearance: one visual sentence for the illustrator — build, clothing, what their hands are doing.
- Reply in the same language as the account.`;

export async function POST(req: NextRequest) {
  const cfg = getLlmConfig();
  if (!cfg) return NextResponse.json({ message: "LLM 未配置" }, { status: 503 });

  let transcript: unknown;
  try {
    ({ transcript } = await req.json());
  } catch {
    return NextResponse.json({ message: "请求体不是合法 JSON" }, { status: 422 });
  }
  if (typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json({ message: "transcript 缺失" }, { status: 422 });
  }

  try {
    const raw = await chat(cfg, { keyIndex: 0, system: SYSTEM, user: transcript, maxTokens: 2000 });
    // 容错:模型偶尔在 JSON 外包 markdown 或带前后缀废话,截取首个 { 到末个 } 再解析
    const text = raw.replace(/```json|```/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("LLM 返回不含 JSON");
    const parsed = JSON.parse(text.slice(start, end + 1));
    const list = Array.isArray(parsed?.personas) ? parsed.personas : [];
    const personas = list.slice(0, 3).map((p: Record<string, unknown>, i: number) => ({
      id: `per-${i + 1}`,
      name: String(p?.name ?? `Voice ${i + 1}`),
      profile: String(p?.profile ?? ""),
      // 下面三项是新增解构产物;模型偶尔漏字段 → 留空,下游按可选处理,不阻断主链路
      voice: p?.voice ? String(p.voice) : undefined,
      stance: p?.stance ? String(p.stance) : undefined,
      appearance: p?.appearance ? String(p.appearance) : undefined,
      isUser: Boolean(p?.is_user),
    }));
    if (personas.length === 0) throw new Error("LLM 未提取到人设");
    const s = parsed?.scene;
    const scene = s
      ? {
          setting: String(s.setting ?? ""),
          mood: String(s.mood ?? ""),
          beats: Array.isArray(s.beats) ? s.beats.map(String) : [],
        }
      : undefined;
    return NextResponse.json({ scene, personas });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "LLM 调用失败" }, { status: 502 });
  }
}
