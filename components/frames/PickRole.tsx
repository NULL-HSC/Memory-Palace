"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Persona } from "@/lib/types";
import { prepareSandplay, type CreateSessionResponse, type PreparedSandplay } from "@/lib/api";

/**
 * 沙盘演绎 · 板块一 —— 选带入角色（docs/product-flow.md F4）
 * 输入页确认后进入:LLM 从故事里识别出 Top 3 角色,用户选一个带入,
 * 然后才进直播间(板块二)。提取期间展示友好的加载态。
 */
export default function PickRole({
  transcript,
  prepared,
  onBack,
  onPick,
}: {
  transcript: string; // 用户转写文本,LLM 从中提取 Top 3 人设
  /** 阶段一已经准备好的结果。给了就直接用,不再请求一次(解构很贵,且会另起一个视频任务)。
   *  没给则自行加载 —— 保留 ?frame=pick 调试捷径能单独进这一帧。 */
  prepared?: PreparedSandplay | null;
  onBack: () => void;
  onPick: (persona: Persona, cast: Persona[], session?: CreateSessionResponse) => void; // 带入者 + 完整 Top 3 阵容
}) {
  const [personas, setPersonas] = useState<Persona[] | null>(prepared?.personas ?? null);
  const [session, setSession] = useState<CreateSessionResponse | undefined>(prepared?.session);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // 提取失败:不塞 mock,给重试 + 真实原因
  const inflightRef = useRef<string | null>(null); // dev StrictMode 双挂会双发同一请求,按 transcript 去重
  /** 数据在进场前就备好(等候室已完成解构):角色直接出现,不走加载动画;
   *  loading/shimmer 只留给真的要等网络的时候(?frame=pick 捷径或弱网) */
  const readyAtEntry = prepared?.personas != null;

  const load = () => {
    if (inflightRef.current === transcript) return;
    inflightRef.current = transcript;
    setError(null);
    setPersonas(null);
    prepareSandplay(transcript)
      .then((prep) => {
        setPersonas(prep.personas);
        setSession(prep.session);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        if (inflightRef.current === transcript) inflightRef.current = null;
      });
  };

  useEffect(() => {
    if (prepared?.personas) {
      setPersonas(prepared.personas);
      setSession(prepared.session);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, prepared]);

  const chosen = personas?.find((p) => p.id === picked) ?? null;

  return (
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">沙盘</span>
        <span className="nav-side" />
      </div>

      {/* 引导语 */}
      <div style={{ marginTop: 34, flexShrink: 0 }}>
        {/* 文案按实际提取到的角色数走,不写死(用户说得少时可能只有一两个) */}
        <span className="meta-italic">
          {personas === null
            ? "正在倾听这个故事里的声音"
            : personas.length === 1
              ? "这个故事里有一个声音"
              : `这个故事里有${["", "一", "两", "三"][personas.length] ?? personas.length}个声音`}
        </span>
        <div style={{ fontSize: 25, fontWeight: 400, lineHeight: 1.3, marginTop: 8 }}>
          你想成为故事里的谁?
        </div>
      </div>

      {/* 人设卡列表 / 提取中加载态 / 失败重试 */}
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        {error !== null ? (
          <div style={{ textAlign: "center", padding: "26px 0" }}>
            <div className="meta-italic" style={{ fontSize: 13.5 }}>
              刚才没能读懂这个故事。
            </div>
            {/* 演示期调试:把真实失败原因露出来,方便区分 503 未配置 / 502 解析失败 / 网络 */}
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--placeholder)", wordBreak: "break-word" }}>
              {error}
            </div>
            <button
              onClick={load}
              style={{
                marginTop: 14,
                height: 44,
                padding: "0 22px",
                borderRadius: 22,
                border: "1px solid var(--line)",
                background: "var(--raised)",
                fontSize: 14.5,
                color: "var(--ink)",
              }}
            >
              再试一次
            </button>
          </div>
        ) : personas === null ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer" style={{ height: 76, borderRadius: 16, background: "var(--mist)" }} />
            ))}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span className="meta-italic" style={{ fontSize: 13 }}>reading your story…</span>
            </div>
          </>
        ) : (
          personas.map((p, i) => {
            const selected = picked === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPicked(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: selected ? "1.5px solid var(--ink-blue)" : "1px solid var(--line)",
                  background: selected ? "var(--mist)" : "var(--raised)",
                  boxShadow: selected ? "none" : "var(--shadow-card)",
                  transition: "all 250ms var(--ease-soft)",
                  textAlign: "left",
                  animation: readyAtEntry ? undefined : `bubbleIn 400ms var(--ease-soft) ${i * 90}ms both`,
                }}
              >
                {/* 角色贴纸:整只立绘,不裁圆 */}
                <span
                  style={{
                    width: 56,
                    height: 60,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt={p.name} style={{ maxWidth: 56, maxHeight: 60, objectFit: "contain", display: "block" }} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16.5, fontWeight: 500, color: selected ? "var(--ink-blue)" : "var(--ink)" }}>
                    {p.name}
                  </span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 300, lineHeight: 1.45, color: "var(--readable)", marginTop: 3 }}>
                    {p.profile}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* CTA:选完才可进入直播间 */}
      <div style={{ flex: 1 }} />
      <button
        onClick={() => chosen && onPick(chosen, personas ?? [], session)}
        className="btn"
        disabled={!chosen}
        style={{ width: "100%", marginTop: 22, flexShrink: 0 }}
      >
        <span>{chosen ? `以「${chosen.name}」进入` : "选一个声音进入"}</span>
      </button>
    </div>
  );
}
