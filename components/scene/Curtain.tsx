"use client";

import React, { useEffect, useState } from "react";

/**
 * 舞台幕布 —— 等候室(Reflect)→ 选角(PickRole)的转场(2026-08-29 产品确认)
 * 隐喻:等候室背后是一座舞台,幕布一直闭着;VLM/解构就绪后进场,幕布向两侧拉开,
 * 露出幕后的角色阵容。配色只用签署色板(ink-blue 幕面 / ink 褶皱 / mist 高光),不加品牌色。
 */

const FOLDS =
  "repeating-linear-gradient(90deg, var(--ink-blue) 0 14px, var(--ink) 14px 22px, var(--ink-blue) 22px 40px, rgba(142,212,232,0.35) 40px 44px)";

/** 垂坠的半圆幕脚(挂在横条下沿的一排扇贝) */
function ScallopHem({ color = "var(--ink-blue)" }: { color?: string }) {
  return (
    <div
      aria-hidden
      style={{
        height: 13,
        backgroundImage: `radial-gradient(circle at 13px 0, ${color} 12px, transparent 13px)`,
        backgroundSize: "26px 13px",
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

/** 顶部帷幔(波浪短幕) */
function Valance({ style }: { style?: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, ...style }}>
      <div style={{ height: 34, background: FOLDS, boxShadow: "0 4px 10px rgba(18,85,113,0.25)" }} />
      <ScallopHem />
    </div>
  );
}

/**
 * 全屏转场幕布:挂载时闭合盖住整个屏幕,下一帧向两侧拉开(帷幔向上收起),
 * 动画结束由 onDone 卸载。底下的目标帧在挂载时就已经渲染好 —— 幕开即亮相。
 */
export function CurtainVeil({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    const t = setTimeout(onDone, 2150); // 1650ms 拉开 + 收尾宽限
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [onDone]);

  const panel = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: 0,
    bottom: -13,
    width: "51.5%",
    [side]: 0,
    background: FOLDS,
    transform: open ? `translateX(${side === "left" ? "-104%" : "104%"})` : "none",
    transition: "transform 1650ms var(--ease-soft)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  });

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 80, pointerEvents: "none", overflow: "hidden" }}>
      {/* 左右两片大幕 */}
      <div style={{ ...panel("left"), boxShadow: "6px 0 18px rgba(18,85,113,0.35)" }}>
        <ScallopHem />
      </div>
      <div style={{ ...panel("right"), boxShadow: "-6px 0 18px rgba(18,85,113,0.35)" }}>
        <ScallopHem />
      </div>
      {/* 中缝(闭合时两片之间的一线暗) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 3,
          transform: "translateX(-50%)",
          background: "rgba(18,85,113,0.55)",
          opacity: open ? 0 : 1,
          transition: "opacity 300ms",
        }}
      />
      {/* 帷幔最后向上收起,比大幕慢半拍 */}
      <Valance
        style={{
          transform: open ? "translateY(-110%)" : "none",
          transition: "transform 1450ms var(--ease-soft) 250ms",
        }}
      />
    </div>
  );
}

/**
 * 等候室里的「闭合幕布背景」:静态的舞台口(帷幔 + 闭合并带中缝的大幕 + 台前光),
 * companion 站在幕前。强调「背后是一座还没拉开的舞台」。
 */
export function ClosedCurtainBackdrop({ height = 132 }: { height?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
        overflow: "hidden",
        borderRadius: "var(--r-panel)",
        boxShadow: "var(--lift-2)",
      }}
    >
      {/* 闭合大幕:整幅褶皱 + 中缝 */}
      <div style={{ position: "absolute", inset: 0, background: FOLDS }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: 3,
          transform: "translateX(-50%)",
          background: "rgba(18,85,113,0.55)",
        }}
      />
      {/* 台前光:一束暖光打在幕前 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 62% 90% at 50% 108%, rgba(255,216,106,0.34) 0%, rgba(255,216,106,0.10) 46%, transparent 72%)",
        }}
      />
      <Valance />
    </div>
  );
}
