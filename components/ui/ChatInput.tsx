"use client";

import React from "react";

/**
 * ChatInput —— 全产品唯一的消息输入条(2026-08-29 产品确认:留言区与群聊共用,不单独开发)
 * 视觉与 F4 群聊输入带同源:奶油胶囊输入框(lift-1)+ 黄油圆形发送钮(纸飞机)。
 * F4 群聊的 mic 钮是直播间专属,不在此组件内;F4 迁移到此组件时只替换「输入框 + 发送」两段。
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "写点什么…",
  autoFocus = false,
  ariaLabel = "输入消息",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          minWidth: 0,
          height: 46,
          border: "none",
          borderRadius: 23,
          background: "var(--cream)",
          boxShadow: "var(--lift-1)",
          padding: "0 18px",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--ink)",
        }}
      />
      <button
        onClick={onSend}
        disabled={!value.trim()}
        aria-label="发送"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "var(--butter)",
          boxShadow: "0 3px 0 var(--butter-under)",
          flexShrink: 0,
          opacity: value.trim() ? 1 : 0.45,
          transition: "opacity 200ms var(--ease-soft)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  );
}
