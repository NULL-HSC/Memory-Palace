"use client";

import React, { useState } from "react";
import type { ProfileData } from "@/lib/types";
import { Companion } from "../characters";
import { Toast } from "../ui";

/**
 * Profile — 个人资料(2026-08-29 产品确认,纯前端 mock)
 * 入口:Home 右下角 companion(product-flow 既定:点 companion → 数字人资料编辑)。
 * 三块:用户信息 / 数字人资料(角色特征 + 记忆,生成数字人的数据源)/ 安全设置(改绑手机号 + 退出登录)。
 * 持久化:localStorage「answerland.profile.v1」;改绑手机号与退出登录的后端接口就绪后,
 * 只把标注 mock 的两段换成 lib/api 调用,组件结构不变。
 */

const PROFILE_KEY = "answerland.profile.v1";
const CODE_RE = /^\d{6}$/;

const DEFAULT_PROFILE: ProfileData = {
  username: "我",
  phone: "13800000000",
  traits: ["慢热", "心软", "想得有点多"],
  memories: ["外婆家院子里的夏天", "第一次一个人坐火车的夜晚"],
};

function loadProfile(): ProfileData {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    /* 本地存储不可用时用默认资料 */
  }
  return DEFAULT_PROFILE;
}

function saveProfile(p: ProfileData) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const maskPhone = (p: string) => (p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p);

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  borderBottom: "1px solid var(--line-strong)",
  background: "transparent",
  fontSize: 15,
  padding: "8px 0",
  color: "var(--ink)",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="meta-italic" style={{ fontSize: 13, marginTop: 24, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function Profile({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<ProfileData>(loadProfile);
  const [toast, setToast] = useState<string | null>(null);

  /* 改绑手机号(mock 流程:发码 → 预填演示码 → 校验) */
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  /* 退出登录:两段式确认 */
  const [confirmLogout, setConfirmLogout] = useState(false);

  /* 数字人资料编辑 */
  const [traitInput, setTraitInput] = useState("");
  const [memoryInput, setMemoryInput] = useState("");
  const [editingMemory, setEditingMemory] = useState<number | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");

  const update = (patch: Partial<ProfileData>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  };

  /* mock:本地生成 6 位演示码并预填(同 Auth 的 demo 行为);真后端换成 POST /auth/verification-codes */
  const sendCode = () => {
    if (!newPhone.trim()) {
      setPhoneError("先输入新手机号");
      return;
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setDemoCode(generated);
    setCode(generated);
    setPhoneError(null);
  };

  const confirmPhone = () => {
    if (!newPhone.trim()) return setPhoneError("先输入新手机号");
    if (!demoCode) return setPhoneError("先发送验证码");
    if (!CODE_RE.test(code.trim()) || code.trim() !== demoCode) return setPhoneError("验证码是 6 位数字,和短信里的一致");
    update({ phone: newPhone.trim() });
    setEditingPhone(false);
    setNewPhone("");
    setCode("");
    setDemoCode(null);
    setPhoneError(null);
    setToast("手机号换绑好啦");
  };

  const addTrait = () => {
    const t = traitInput.trim();
    if (!t || profile.traits.includes(t)) return;
    update({ traits: [...profile.traits, t] });
    setTraitInput("");
  };

  const addMemory = () => {
    const m = memoryInput.trim();
    if (!m) return;
    update({ memories: [...profile.memories, m] });
    setMemoryInput("");
  };

  const saveMemoryEdit = () => {
    if (editingMemory === null) return;
    const m = memoryDraft.trim();
    if (m) update({ memories: profile.memories.map((old, i) => (i === editingMemory ? m : old)) });
    setEditingMemory(null);
    setMemoryDraft("");
  };

  return (
    <div className="frame frame-enter">
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">我的资料</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 12 }}>
        {/* ══ 用户信息 ══ */}
        <div
          style={{
            marginTop: 16,
            background: "var(--raised)",
            borderRadius: "var(--r-panel)",
            padding: "16px",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--mist)",
              overflow: "hidden",
              flexShrink: 0,
              display: "block",
            }}
          >
            <Companion size={56} style={{ width: 64, height: 64, objectFit: "cover", objectPosition: "50% 12%" }} />
          </span>
          <span>
            <span style={{ display: "block", fontFamily: "var(--font-hand)", fontSize: 20, color: "var(--ink-blue)" }}>
              {profile.username}
            </span>
            <span className="meta-italic" style={{ display: "block", fontSize: 12, marginTop: 3 }}>
              {maskPhone(profile.phone)}
            </span>
          </span>
        </div>

        {/* ══ 数字人资料(生成数字人的数据源) ══ */}
        <SectionTitle>数字人资料 · TA 由这些长成</SectionTitle>
        <div style={{ background: "var(--raised)", borderRadius: "var(--r-panel)", padding: "14px 16px", boxShadow: "var(--shadow-card)" }}>
          <div className="meta-italic" style={{ fontSize: 12, color: "var(--faint)" }}>角色特征</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {profile.traits.map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--mist)",
                  borderRadius: "var(--r-chip)",
                  padding: "6px 12px",
                  fontSize: 13.5,
                }}
              >
                {t}
                <button
                  onClick={() => update({ traits: profile.traits.filter((x) => x !== t) })}
                  aria-label={`删掉特征「${t}」`}
                  style={{ color: "var(--faint)", fontSize: 15, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
            <input
              value={traitInput}
              onChange={(e) => setTraitInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTrait()}
              placeholder="添一个特征,比如「怕黑」…"
              aria-label="新特征"
              maxLength={12}
              style={inputStyle}
            />
            <button onClick={addTrait} disabled={!traitInput.trim()} className="btn btn--sky" style={{ minHeight: 36, padding: "0 16px", fontSize: 13.5 }}>
              添加
            </button>
          </div>
        </div>

        <div style={{ background: "var(--raised)", borderRadius: "var(--r-panel)", padding: "14px 16px", boxShadow: "var(--shadow-card)", marginTop: 12 }}>
          <div className="meta-italic" style={{ fontSize: 12, color: "var(--faint)" }}>记忆</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
            {profile.memories.length === 0 && (
              <span className="meta-italic" style={{ fontSize: 12.5, color: "var(--placeholder)", padding: "8px 0" }}>
                还没有存下记忆。
              </span>
            )}
            {profile.memories.map((m, i) => (
              <div
                key={`${i}-${m}`}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: i < profile.memories.length - 1 ? "1px solid var(--line)" : "none" }}
              >
                {editingMemory === i ? (
                  <>
                    <input
                      value={memoryDraft}
                      onChange={(e) => setMemoryDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveMemoryEdit()}
                      autoFocus
                      aria-label="编辑记忆"
                      style={inputStyle}
                    />
                    <button onClick={saveMemoryEdit} style={{ flexShrink: 0, fontSize: 13, fontStyle: "italic", color: "var(--muted)", borderBottom: "1px solid var(--line-strong)" }}>
                      存好
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.6 }}>{m}</span>
                    <button
                      onClick={() => {
                        setEditingMemory(i);
                        setMemoryDraft(m);
                      }}
                      style={{ flexShrink: 0, fontSize: 12.5, fontStyle: "italic", color: "var(--faint)" }}
                    >
                      改改
                    </button>
                    <button
                      onClick={() => update({ memories: profile.memories.filter((_, x) => x !== i) })}
                      style={{ flexShrink: 0, fontSize: 12.5, fontStyle: "italic", color: "var(--faint)" }}
                    >
                      删掉
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <input
              value={memoryInput}
              onChange={(e) => setMemoryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}
              placeholder="添一条记忆…"
              aria-label="新记忆"
              maxLength={60}
              style={inputStyle}
            />
            <button onClick={addMemory} disabled={!memoryInput.trim()} className="btn btn--sky" style={{ minHeight: 36, padding: "0 16px", fontSize: 13.5 }}>
              添加
            </button>
          </div>
        </div>

        {/* ══ 安全设置 ══ */}
        <SectionTitle>安全设置</SectionTitle>
        <div style={{ background: "var(--raised)", borderRadius: "var(--r-panel)", padding: "4px 16px", boxShadow: "var(--shadow-card)" }}>
          {/* 改绑手机号 */}
          <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14.5 }}>
                绑定手机号
                <span className="meta-italic" style={{ fontSize: 12, marginLeft: 8 }}>{maskPhone(profile.phone)}</span>
              </span>
              <button
                onClick={() => {
                  setEditingPhone(!editingPhone);
                  setPhoneError(null);
                  setDemoCode(null);
                  setCode("");
                }}
                style={{ fontSize: 13, fontStyle: "italic", color: "var(--muted)", borderBottom: "1px solid var(--line-strong)" }}
              >
                {editingPhone ? "收起" : "换绑"}
              </button>
            </div>
            {editingPhone && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    setPhoneError(null);
                  }}
                  placeholder="新手机号"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-label="新手机号"
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPhoneError(null);
                    }}
                    placeholder="6 位验证码"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    aria-label="验证码"
                    style={inputStyle}
                  />
                  <button onClick={sendCode} style={{ flexShrink: 0, fontSize: 13, fontStyle: "italic", color: "var(--muted)", borderBottom: "1px solid var(--line-strong)", paddingBottom: 8 }}>
                    {demoCode ? "重发" : "发验证码"}
                  </button>
                </div>
                {demoCode && (
                  <span className="meta-italic" style={{ fontSize: 12 }}>
                    演示验证码 {demoCode} · 已帮你填好
                  </span>
                )}
                {phoneError && (
                  <span style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--ink)" }}>{phoneError}</span>
                )}
                <button onClick={confirmPhone} className="btn" style={{ width: "100%", minHeight: 42, fontSize: 15 }}>
                  确认换绑
                </button>
              </div>
            )}
          </div>

          {/* 退出登录(两段式确认) */}
          <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14.5 }}>退出登录</span>
            {confirmLogout ? (
              <span style={{ display: "flex", gap: 14 }}>
                <button onClick={onLogout} style={{ fontSize: 13, fontStyle: "italic", color: "var(--coral)", borderBottom: "1px solid var(--coral)" }}>
                  确定退出
                </button>
                <button onClick={() => setConfirmLogout(false)} style={{ fontSize: 13, fontStyle: "italic", color: "var(--faint)" }}>
                  再想想
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmLogout(true)} style={{ fontSize: 13, fontStyle: "italic", color: "var(--muted)", borderBottom: "1px solid var(--line-strong)" }}>
                退出
              </button>
            )}
          </div>
        </div>

        <div className="meta-italic" style={{ fontSize: 11.5, textAlign: "center", marginTop: 20, color: "var(--placeholder)" }}>
          这些资料会让你的数字人更像你。
        </div>
      </div>

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
