"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MountedPrint, BlankMount } from "../ui";
import { Companion } from "../characters";

/**
 * F1 — My Space（v3 · 手机手感 + 温馨化修订）
 * - 拖拽丝滑化：滑动期间直接写 DOM transform（rAF 节流，不走 React 渲染），
 *   松手才吸附并提交状态；卡片 will-change: transform
 * - 温馨化：卡片圆角、波浪错位布局、层级重排（标题/CTA 加大）
 * - 交互不变：拖/滑翻牌，点侧卡到最前；点前置卡看故事详情(只读+留言)
 * - Create 开新故事；点 companion 进个人资料(数字人资料/安全设置)
 */

const STEP = 148;
const FAN_TRANSITION = "transform 380ms cubic-bezier(0.32, 0.72, 0.32, 1), opacity 380ms cubic-bezier(0.32, 0.72, 0.32, 1)";

/** 波浪布局:前置卡最高,两侧按 1−cos(πd) 一高一低交替;
 *  滑动时 d 连续变化,卡片就像海浪一样此起彼伏(拖动本身不变,依旧跟手) */
function fan(d: number) {
  const ad = Math.abs(d);
  const scale = d === 0 ? 1.16 : 0.88 - Math.min(ad * 0.05, 0.26);
  const waveY = 17 * (1 - Math.cos(Math.PI * d)); // d=±1 时最低 +34px,d=±2 回到高位
  return {
    transform: `translate(-50%, -50%) translateX(${d * STEP}px) translateY(${waveY}px) scale(${scale})`,
    opacity: Math.max(1 - ad * 0.15, 0),
    zIndex: 100 - Math.round(ad * 10),
    visible: ad <= 3.4,
  };
}

export default function F1Home({
  onOpenStory,
  onNewStory,
  onVisitSpaces,
  onOpenProfile,
  enterClass = "frame-enter-left",
}: {
  onOpenStory: (storyId: string) => void;
  onNewStory: () => void;
  onVisitSpaces: () => void;
  onOpenProfile: () => void;
  enterClass?: string;
}) {
  const { stories } = useStore();
  const [front, setFront] = useState(0); // 只在吸附/点按时变化 → 标题联动
  const story = stories[front];
  const maxOffset = Math.max(stories.length - 1, 0);

  const offsetRef = useRef(0);
  const dragRef = useRef({ startX: 0, startOffset: 0, moved: 0, active: false, tapIdx: null as number | null });
  const rafRef = useRef(0);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const blankRef = useRef<HTMLButtonElement>(null);

  /* 直接写 DOM：滑动帧不经过 React */
  const applyFan = (off: number, animate: boolean) => {
    stories.forEach((s, i) => {
      const el = cardRefs.current.get(s.id);
      if (!el) return;
      const t = fan(i - off);
      el.style.transition = animate ? FAN_TRANSITION : "none";
      el.style.transform = t.transform;
      el.style.opacity = String(t.opacity);
      el.style.zIndex = String(t.zIndex);
      el.style.visibility = t.visible ? "visible" : "hidden";
    });
    const blank = blankRef.current;
    if (blank) {
      const t = fan(stories.length - off);
      blank.style.transition = animate ? FAN_TRANSITION : "none";
      blank.style.transform = t.transform;
      blank.style.opacity = String(t.opacity);
      blank.style.zIndex = String(t.zIndex);
      blank.style.visibility = t.visible ? "visible" : "hidden";
    }
  };

  /* stories 变化（新故事飞入）后重排一次 */
  useEffect(() => {
    offsetRef.current = Math.min(offsetRef.current, maxOffset);
    applyFan(offsetRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories.length]);

  const scheduleApply = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyFan(offsetRef.current, false));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // 记录按下的卡:容器 setPointerCapture 会把 click 重定向到容器,
    // 卡片 onClick 永远收不到 → 点按改在 pointerUp 里按 tapIdx 分发
    const cardEl = (e.target as HTMLElement).closest("[data-card-idx]");
    dragRef.current = {
      startX: e.clientX,
      startOffset: offsetRef.current,
      moved: 0,
      active: true,
      tapIdx: cardEl ? Number(cardEl.getAttribute("data-card-idx")) : null,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.moved = Math.abs(dx);
    offsetRef.current = Math.min(Math.max(dragRef.current.startOffset - dx / STEP, 0), maxOffset);
    scheduleApply();
  };
  const snapTo = (idx: number) => {
    const clamped = Math.min(Math.max(idx, 0), maxOffset);
    offsetRef.current = clamped;
    applyFan(clamped, true);
    setFront(clamped);
  };
  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (dragRef.current.moved <= 8 && dragRef.current.tapIdx != null) {
      handleCardTap(dragRef.current.tapIdx); // 点按:侧卡吸附 / 前置卡进沙盘
      return;
    }
    snapTo(Math.round(offsetRef.current));
  };

  const handleCardTap = (idx: number) => {
    if (dragRef.current.moved > 8) return; // 拖拽后的抬手不算点按
    if (idx === front && story) onOpenStory(story.id);
    else snapTo(idx);
  };

  return (
    <div className={`frame ${enterClass}`} style={{ padding: 0, overflow: "hidden" }}>
      {/* ══ 顶部:雾蓝波浪布带(2.5D 渐变:上浅蓝→波浪沿深蓝;不规则波;轻微外投影) ══ */}
      <svg
        aria-hidden
        viewBox="0 0 390 120"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 120, pointerEvents: "none", zIndex: 102, filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.05))" }}
      >
        <defs>
          <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mist)" />
            <stop offset="55%" stopColor="var(--mist)" />
            <stop offset="100%" stopColor="var(--sky)" />
          </linearGradient>
        </defs>
        {/* 不规则波浪下沿:每个波的宽度/深度都不一样,像布帘自然垂坠 */}
        <path
          d="M0 0 H390 V46 Q370 72 348 54 Q326 36 306 50 Q286 66 262 48 Q238 30 216 46 Q194 62 168 44 Q142 26 118 44 Q94 62 70 46 Q46 30 22 48 Q10 60 0 46 Z"
          fill="url(#bandG)"
        />
        {/* 虚线车缝:沿同一条不规则波浪,上移 8px */}
        <path
          d="M390 38 Q370 64 348 46 Q326 28 306 42 Q286 58 262 40 Q238 22 216 38 Q194 54 168 36 Q142 18 118 36 Q94 54 70 38 Q46 22 22 40 Q10 52 0 38"
          fill="none"
          stroke="var(--ink-blue)"
          strokeOpacity="0.4"
          strokeWidth="1.3"
          strokeDasharray="5 6"
          strokeLinecap="round"
        />
      </svg>

      {/* header:进横条;只留 Visit 入口(实心按钮) */}
      <div style={{ position: "relative", zIndex: 103, display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "22px var(--screen-x) 0" }}>
        <button
          onClick={onVisitSpaces}
          className="btn btn--sky"
          style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }}
        >
          看看别人的空间
        </button>
      </div>

      {/* ══ Gallery：波浪错位(海浪式起伏)+ 氛围光 ══ */}
      <div
        style={{ position: "relative", flex: 1, minHeight: 0, touchAction: "pan-y", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 氛围光：温暖、极低对比，永不抢注意力 */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "8% -20%",
            background: "radial-gradient(ellipse at 50% 42%, rgba(142,212,232,0.30) 0%, rgba(217,238,244,0.20) 45%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {stories.length === 0 ? (
          /* 空态:格子布纹内芯的拍立得槽 + 奶油黄大圆 +(示意图手法) */
          <button
            onClick={onNewStory}
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              transform: "translate(-50%, -50%) rotate(-1.5deg)",
              width: 198,
              height: 255,
              background: "var(--raised)",
              border: "none",
              borderRadius: 12,
              padding: "10px 10px 34px",
              boxShadow: "0 6px 16px rgba(15,45,66,0.10)",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: "100%",
                height: "100%",
                borderRadius: 6,
                border: "1.5px dashed var(--slot-border)",
                background:
                  "repeating-linear-gradient(0deg, rgba(47,159,200,0.26) 0 8px, transparent 8px 16px), repeating-linear-gradient(90deg, rgba(47,159,200,0.26) 0 8px, transparent 8px 16px), var(--cream)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--butter)",
                  boxShadow: "0 6px 14px rgba(15,45,66,0.18)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </span>
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 9, textAlign: "center", fontSize: 12.5, fontStyle: "italic", color: "var(--muted)" }}>
              你的第一个故事
            </span>
          </button>
        ) : (
          stories.map((s, i) => {
            const t = fan(i - offsetRef.current);
            return (
              <div
                key={s.id}
                data-card-idx={i}
                ref={(el) => {
                  if (el) cardRefs.current.set(s.id, el);
                  else cardRefs.current.delete(s.id);
                }}
                onClick={() => handleCardTap(i)}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "38%",
                  transform: t.transform,
                  opacity: t.opacity,
                  zIndex: t.zIndex,
                  visibility: t.visible ? "visible" : "hidden",
                  willChange: "transform",
                }}
              >
                <div
                  className={i === front ? "anim-float" : undefined}
                  style={i === front ? { filter: "drop-shadow(0 6px 12px rgba(15,45,66,0.10))" } : undefined}
                >
                  <MountedPrint variant="focused" cover={s.cover} caption={s.title} date={s.date} />
                </div>
              </div>
            );
          })
        )}
        {stories.length > 0 && (
          <button
            ref={blankRef}
            aria-label="创建新沙盘"
            onClick={() => {
              if (dragRef.current.moved > 8) return; // 拖拽后的抬手不算点按
              onNewStory();
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              ...(() => {
                const t = fan(stories.length - offsetRef.current);
                return { transform: t.transform, opacity: t.opacity, zIndex: t.zIndex, visibility: t.visible ? ("visible" as const) : ("hidden" as const) };
              })(),
            }}
          >
            <BlankMount />
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--butter)",
                boxShadow: "0 3px 0 var(--butter-under)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>
        )}

        {/* ══ 固定在墙上的挂绳夹子:不随卡片移动;挂绳一路连到顶部波浪布带底下;图层在卡片之上 ══ */}
        {stories.length > 0 && (
          <>
            {[-50, 50].map((dx) => (
              <svg
                key={dx}
                aria-hidden
                width="26"
                height="150"
                viewBox="0 0 26 150"
                style={{ position: "absolute", left: `calc(50% + ${dx}px - 13px)`, top: "calc(38% - 320px)", zIndex: 101, pointerEvents: "none" }}
              >
                {/* 挂绳:从布带底下一路垂到夹子 */}
                <line x1="13" y1="0" x2="13" y2="117" stroke="var(--story)" strokeWidth="1.8" />
                {/* 金属提手三角 */}
                <path d="M13 115 L5.5 131 L20.5 131 Z" fill="none" stroke="var(--story)" strokeWidth="2.2" strokeLinejoin="round" />
                {/* 夹子主体:咬住卡片上沿 */}
                <rect x="4" y="129" width="18" height="17" rx="4.5" fill="var(--story)" />
                {/* 夹身凹槽 */}
                <rect x="9" y="135" width="8" height="3.2" rx="1.6" fill="var(--cream)" opacity="0.85" />
              </svg>
            ))}
          </>
        )}
      </div>

      {/* ══ 底部:平地地板(比背景深一档的色块)—— 拍立得像挂在墙上,companion 站在地上 ══ */}
      <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 88, background: "#F1E5CB", pointerEvents: "none" }} />

      {/* Create:奶油黄圆 + 号(示意图 CTA) */}
      <div style={{ position: "absolute", left: "24%", bottom: "max(26px, env(safe-area-inset-bottom))", zIndex: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <button
          onClick={onNewStory}
          aria-label="创建新沙盘"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "var(--butter)",
            boxShadow: "0 5px 0 var(--butter-under), var(--lift-2)",
            transition: "transform 160ms var(--ease-soft)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <span style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--ink-blue)" }}>新沙盘</span>
      </div>

      {/* companion:脚踩地板,站在右下角;点击进个人资料(数字人资料/安全设置) */}
      <button
        onClick={onOpenProfile}
        aria-label="我的资料"
        style={{ position: "absolute", right: 8, bottom: 12, lineHeight: 0, zIndex: 120 }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%)",
            width: 150,
            height: 24,
            borderRadius: "50%",
            background: "rgba(15,45,66,0.12)",
            filter: "blur(4px)",
          }}
        />
        <Companion size={172} className="anim-bob" />
      </button>
    </div>
  );
}
