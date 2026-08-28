import { NextRequest, NextResponse } from "next/server";
import { chat, getLlmConfig } from "@/lib/llm-server";

/**
 * 人设提取 —— 从用户转写文本中提取 Top 3 角色(含叙述者"我")
 * POST /api/llm/personas  { transcript } → { personas: [{ id, name, profile, isUser }] }
 * 未配置 LLM → 503,前端回退 mock。契约对应:GET /api/sessions/{id}/personas。
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You extract the cast of a personal, first-person story for a gentle group-chat reenactment.
Return ONLY valid JSON, no markdown: {"personas":[{"name":"...","profile":"...","is_user":true|false}]}
Rules:
- Return EXACTLY 3 personas when the story has that many notable presences (people, animals, places or things the narrator addressed, inner voices); otherwise as many as genuinely appear, minimum 1.
- Exactly one persona is the narrator themselves, marked is_user=true.
- name: short and specific to the story (never generic labels like "Friend" or "Stranger"); for the narrator, a warm self-name like "Me, the one who …" is welcome.
- profile: ONE sentence, max 25 words — personality and role in the story.
- Reply in the same language as the story.`;

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
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const list = Array.isArray(parsed?.personas) ? parsed.personas : [];
    const personas = list.slice(0, 3).map((p: Record<string, unknown>, i: number) => ({
      id: `per-${i + 1}`,
      name: String(p?.name ?? `Voice ${i + 1}`),
      profile: String(p?.profile ?? ""),
      isUser: Boolean(p?.is_user),
    }));
    if (personas.length === 0) throw new Error("LLM 未提取到人设");
    return NextResponse.json({ personas });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "LLM 调用失败" }, { status: 502 });
  }
}
