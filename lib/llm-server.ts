/**
 * 服务端 LLM 调用封装 —— OpenAI 兼容 chat.completions
 * 仅服务端(app/api/llm/*)使用;API key 只存在服务端环境变量,不进浏览器包。
 * 每个故事人设分配独立 key(第 i 个角色用第 i 个),对应"每角色独立 LLM session"。
 */

export interface LlmConfig {
  baseUrl: string;
  model: string;
  keys: string[];
}

/** 未配置完整时返回 null → 路由回 503,前端自动回退 mock */
export function getLlmConfig(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;
  const keys = (process.env.LLM_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (!baseUrl || !model || keys.length === 0) return null;
  return { baseUrl, model, keys };
}

export async function chat(
  cfg: LlmConfig,
  opts: {
    keyIndex: number; // 人设序号 → 独立 key
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const key = cfg.keys[opts.keyIndex % cfg.keys.length];
  // 部分模型(如 kimi-k3)只允许 temperature=1:默认不传,需要调参时用 LLM_TEMPERATURE 显式指定
  const temperature = process.env.LLM_TEMPERATURE ? Number(process.env.LLM_TEMPERATURE) : undefined;
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(temperature !== undefined && { temperature }),
      // kimi-k3 等 reasoning 模型会先烧 reasoning_content,token 上限要留足
      max_tokens: opts.maxTokens ?? 800,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: unknown = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("LLM 返回为空");
  return text.trim();
}
