"use client";

import React, { useState } from "react";
import { ApiError, USE_BACKEND, login, register, requestVerificationCode } from "@/lib/api";
import { Companion } from "../characters";

/**
 * Auth — 登录 / 注册同屏切换(2026-08-28 接入后端认证契约)
 * - 登录:phone + password → POST /api/auth/login
 * - 注册:phone → POST /api/auth/verification-codes(demo 直接返回码并预填)→ POST /api/auth/register
 * - 前端按契约校验:password 8–128 位、verification_code ^\d{6}$、username 1–64 位;错误行内提示
 * - USE_BACKEND=false(mock)时提供 demo 一键跳过,仅演示用
 */

type Mode = "login" | "register";
type FieldKey = "phone" | "username" | "password" | "code";

/* 契约约束(docs/backend-progress.md 2026-08-27 实测) */
const CODE_RE = /^\d{6}$/;

function validate(mode: Mode, f: Record<FieldKey, string>): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!f.phone.trim()) errors.phone = "请填手机号";
  if (f.password.length < 8 || f.password.length > 128)
    errors.password = "密码需要 8–128 位";
  if (mode === "register") {
    const username = f.username.trim();
    if (username.length < 1 || username.length > 64)
      errors.username = "名字要在 1–64 个字之间";
    if (!CODE_RE.test(f.code.trim())) errors.code = "The code is 6 digits";
  }
  return errors;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  fontSize: 16,
  fontWeight: 400,
  color: "var(--ink)",
  padding: 0,
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          borderBottom: `1px solid ${error ? "var(--accent)" : "var(--line-strong)"}`,
          paddingBottom: 8,
          transition: "border-color 200ms var(--ease-soft)",
        }}
      >
        {children}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, minHeight: 16 }}>
        <span className="meta-italic" style={{ fontSize: 12 }}>
          {label}
        </span>
        {error && (
          <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink)" }}>{error}</span>
        )}
      </div>
    </div>
  );
}

export default function Auth({
  onAuthed,
  onSkipDemo,
}: {
  onAuthed: (username: string) => void;
  onSkipDemo: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    phone: "",
    username: "",
    password: "",
    code: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const set = (key: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError(null);
  };

  const backendMessage = (error: unknown, fallback: string) =>
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;

  /* 注册第一步:发验证码;demo 环境后端直接返回码,预填并展示 */
  const sendCode = async () => {
    if (!fields.phone.trim()) {
      setErrors((prev) => ({ ...prev, phone: "先填手机号再发验证码" }));
      return;
    }
    setSendingCode(true);
    setFormError(null);
    try {
      const result = await requestVerificationCode(fields.phone.trim());
      if (result.verification_code) {
        setFields((prev) => ({ ...prev, code: result.verification_code! }));
        setErrors((prev) => ({ ...prev, code: undefined }));
        setCodeHint(`demo 验证码 ${result.verification_code},已帮你填好`);
      } else {
        setCodeHint(`code sent · expires in ${Math.round(result.expires_in_seconds / 60)} min`);
      }
    } catch (error) {
      setFormError(backendMessage(error, "Could not send the code"));
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async () => {
    const nextErrors = validate(mode, fields);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true);
    setFormError(null);
    try {
      const auth =
        mode === "login"
          ? await login(fields.phone.trim(), fields.password)
          : await register({
              phone: fields.phone.trim(),
              verification_code: fields.code.trim(),
              username: fields.username.trim(),
              password: fields.password,
            });
      onAuthed(auth.user.username);
    } catch (error) {
      setFormError(backendMessage(error, "Something went wrong — please try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="frame frame-enter" style={{ overflow: "hidden" }}>
      {/* header:品牌布标签 + companion */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div>
          <span
            style={{
              display: "inline-block",
              background: "var(--story)",
              color: "var(--text-on-ink)",
              fontSize: 17,
              fontWeight: 500,
              padding: "5px 16px 6px",
              borderRadius: 9,
              transform: "rotate(-2deg)",
              boxShadow: "var(--lift-2)",
            }}
          >
            理理理 lilili
          </span>
          <div className="meta-italic" style={{ marginTop: 10 }}>
            every story gets a room
          </div>
        </div>
        <Companion size={72} className="anim-bob" />
      </div>

      {/* 表单 */}
      <div style={{ marginTop: 34, flexShrink: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 400, lineHeight: 1.2 }}>
          {mode === "login" ? "欢迎回来" : "布置你的房间"}
        </div>
        <div className="meta-italic" style={{ fontSize: 13, marginTop: 6 }}>
          {mode === "login" ? "登录,把故事放在身边" : "一个手机号就够了"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
          <Field label="手机号" error={errors.phone}>
            <input
              value={fields.phone}
              onChange={set("phone")}
              placeholder="138 0000 0000"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Phone number"
              style={inputStyle}
            />
          </Field>

          {mode === "register" && (
            <>
              <Field label="6 位验证码" error={errors.code}>
                <input
                  value={fields.code}
                  onChange={set("code")}
                  placeholder="······"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  aria-label="Verification code"
                  style={inputStyle}
                />
                <button
                  onClick={sendCode}
                  disabled={sendingCode}
                  style={{
                    flexShrink: 0,
                    fontSize: 13,
                    fontStyle: "italic",
                    color: sendingCode ? "var(--placeholder)" : "var(--muted)",
                    borderBottom: "1px solid var(--line-strong)",
                    paddingBottom: 1,
                    marginBottom: 2,
                  }}
                >
                  {sendingCode ? "发送中…" : fields.code ? "重发" : "发验证码"}
                </button>
              </Field>
              {codeHint && (
                <div className="meta-italic" style={{ fontSize: 12, marginTop: -8 }}>
                  {codeHint}
                </div>
              )}
              <Field label="怎么称呼你?" error={errors.username}>
                <input
                  value={fields.username}
                  onChange={set("username")}
                  placeholder="你的名字"
                  maxLength={64}
                  autoComplete="nickname"
                  aria-label="Username"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          <Field label="密码 · 8–128 位" error={errors.password}>
            <input
              value={fields.password}
              onChange={set("password")}
              placeholder="········"
              type="password"
              maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-label="Password"
              style={inputStyle}
            />
          </Field>
        </div>

        {/* 后端错误:统一信封的 message 原样展示 */}
        {formError && (
          <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--ink)", marginTop: 12 }}>
            {formError}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }} />

      {/* CTA */}
      <button
        onClick={submit}
        disabled={busy}
        className="btn"
        style={{ width: "100%", flexShrink: 0 }}
      >
        <span style={{ fontSize: 19, fontWeight: 700 }}>
          {busy ? "稍等一下…" : mode === "login" ? "回到我的房间" : "布置我的房间"}
        </span>
      </button>

      {/* 切换登录/注册 */}
      <div style={{ textAlign: "center", marginTop: 16, flexShrink: 0 }}>
        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setErrors({});
            setFormError(null);
          }}
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--readable)",
            borderBottom: "1px solid var(--line-strong)",
            paddingBottom: 2,
          }}
        >
          {mode === "login" ? "第一次来?注册一个" : "已有房间?直接登录"}
        </button>
      </div>

      {/* mock 模式演示入口(仅 demo,后端未启用时渲染) */}
      {!USE_BACKEND && (
        <div style={{ textAlign: "center", marginTop: 14, flexShrink: 0 }}>
          <button
            onClick={onSkipDemo}
            style={{ fontSize: 12, fontStyle: "italic", color: "var(--placeholder)" }}
          >
            先逛逛 · 仅演示
          </button>
        </div>
      )}
    </div>
  );
}
