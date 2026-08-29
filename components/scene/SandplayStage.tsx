"use client";

import React, { useEffect, useState } from "react";
import type { Persona } from "@/lib/types";
import { getPlaybackUrl, getSessionStatus } from "@/lib/api";

/**
 * F4 舞台 v3 —— 竖屏全幅 AIGC video 槽位（直播间形态）
 * - 视频未就绪:友好加载态(呼吸光晕 + "staging the scene…" 提示),对话流照常盖在上面
 * - 就绪后:场景静帧(占位)crossfade 600ms 进场;真视频同槽位替换
 * - 真后端:轮询 GET /api/sessions/{id} 中的 video.status，完成后取 /api/videos/{video.id}/playback
 * - 台上角色 = 故事 Top 3 人设;说话者 step-forward + 提亮,其余退后变暗
 */

interface Props {
  cast: Persona[]; // 故事 Top 3(含用户带入的那位)
  speakerId: string | null; // 当前发言的 persona id
  title?: string;
  sessionId?: string;
}

/** 站位:舞台中部偏上(弹幕浮层之上),中置主角 + 两翼 */
const SLOTS: Array<{ style: React.CSSProperties; size: number; delay: string }> = [
  { size: 74, delay: "0.9s", style: { left: "14%", bottom: "41%" } },
  { size: 128, delay: "0s", style: { left: "50%", marginLeft: -64, bottom: "38%" } },
  { size: 70, delay: "1.8s", style: { right: "14%", bottom: "41%" } },
];

const MOCK_VIDEO_MS = 8000; // mock:VLM 生成 10s 视频的等待时长

export default function SandplayStage({ cast, speakerId, title, sessionId }: Props) {
  const [ready, setReady] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setPlaybackUrl(null);
    if (!sessionId) {
      const timer = setTimeout(() => setReady(true), MOCK_VIDEO_MS);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }

    void (async () => {
      try {
        for (let attempt = 0; attempt < 120 && alive; attempt += 1) {
          const session = await getSessionStatus(sessionId);
          const status = session.video.status.toLowerCase();
          if (["succeeded", "completed", "ready", "success"].includes(status)) {
            const url = await getPlaybackUrl(session.video.id);
            if (alive) setPlaybackUrl(url);
            return;
          }
          if (["failed", "error", "cancelled", "canceled"].includes(status)) {
            throw new Error(session.video.message || session.video.error_code || "视频生成失败");
          }
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        throw new Error("等待视频生成超时");
      } catch (error) {
        console.error("[video] 加载失败，使用本地舞台兜底:", error);
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--mist)" }}>
      {/* ══ 场景(占位静帧 · 后续换 AIGC 视频):就绪后 crossfade 进场 ══ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: ready ? 1 : 0,
          transition: "opacity 600ms var(--ease-soft)",
        }}
      >
        {playbackUrl && (
          <video
            src={playbackUrl}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setReady(true)}
            onError={() => {
              console.error("[video] 播放地址无法加载，使用本地舞台兜底");
              setPlaybackUrl(null);
              setReady(true);
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <svg
          viewBox="0 0 390 844"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: playbackUrl ? 0 : 1 }}
          aria-hidden
        >
          <defs>
            <linearGradient id="skyV" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cream)" />
              <stop offset="45%" stopColor="var(--mist)" />
              <stop offset="100%" stopColor="var(--sky)" />
            </linearGradient>
            <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="var(--butter)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--butter)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="390" height="844" fill="url(#skyV)" />
          {/* 低垂暖阳 */}
          <circle cx="312" cy="168" r="86" fill="url(#sunGlow)" />
          <circle cx="312" cy="168" r="34" fill="var(--butter)" opacity="0.9" />
          {/* 远景山脊 */}
          <path d="M0 420 Q80 372 170 404 T390 388 V844 H0 Z" fill="var(--mist)" opacity="0.8" />
          <path d="M0 470 Q110 430 220 458 T390 446 V844 H0 Z" fill="var(--sky)" opacity="0.9" />
          {/* 中景灌木剪影 */}
          <path d="M-20 560 Q30 500 76 548 Q104 520 128 556 Q160 536 168 580 L168 640 L-20 640 Z" fill="var(--sky)" opacity="0.75" />
          <path d="M410 552 Q356 496 316 550 Q288 524 268 560 Q238 542 232 584 L232 640 L410 640 Z" fill="var(--sky)" opacity="0.75" />
          {/* 近景地面与沙丘 */}
          <path d="M0 600 Q120 560 230 592 T390 584 V844 H0 Z" fill="var(--sand-2)" />
          <ellipse cx="195" cy="760" rx="230" ry="72" fill="var(--mist)" opacity="0.85" />
          <ellipse cx="195" cy="700" rx="90" ry="18" fill="var(--mist)" opacity="0.8" />
        </svg>

        {/* 萤火/光尘:环境微动,低对比不抢注意力 */}
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              left: `${16 + i * 17}%`,
              top: `${34 + (i % 3) * 12}%`,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--butter)",
              animation: `think ${3.2 + i * 0.7}s ease-in-out ${i * 0.9}s infinite`,
            }}
          />
        ))}

        {/* 台上角色 = 故事 Top 3:sway 常驻;说话者 step-forward + 提亮 */}
        {cast.slice(0, 3).map((p, i) => {
          const slot = SLOTS[i];
          if (!slot) return null;
          const focused = speakerId === p.id;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                ...slot.style,
                transition: "transform 450ms var(--ease-soft), opacity 450ms, filter 450ms",
                transform: focused ? "translateY(-12px) scale(1.15)" : "none",
                opacity: speakerId && !focused ? 0.68 : i === 1 ? 1 : 0.94,
                filter: speakerId && !focused ? "saturate(0.75) brightness(0.97)" : "none",
                zIndex: focused ? 3 : 2,
              }}
            >
              <div className="anim-sway" style={{ animationDelay: slot.delay }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.avatar}
                  alt={p.name}
                  style={{ width: slot.size, height: slot.size * 1.12, objectFit: "contain", display: "block" }}
                />
              </div>
              {focused && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: slot.size * 1.6,
                    height: slot.size * 1.6,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(246,241,228,0.55) 0%, transparent 65%)",
                    zIndex: -1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ══ 演绎中加载态:AIGC 视频未就绪时的兜底(永不黑屏) ══ */}
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(170deg, var(--cream), var(--mist))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            zIndex: 2,
          }}
        >
          {/* 三点律动 + 一句提示:安静的等候态,不用大色块 */}
          <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--story)",
                  animation: `think 1.6s ease-in-out ${i * 0.22}s infinite`,
                }}
              />
            ))}
          </div>
          <span className="meta-italic" style={{ color: "var(--ink-blue)", fontSize: 13.5 }}>
            staging the scene…
          </span>
        </div>
      )}

      {/* 故事名:舞台左上小签 */}
      {title && (
        <span
          style={{
            position: "absolute",
            left: 16,
            top: 100,
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.72)",
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--ink-blue)",
            zIndex: 4,
          }}
        >
          {title}
        </span>
      )}
    </div>
  );
}
