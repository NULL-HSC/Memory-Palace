"use client";

import React, { useRef, useState } from "react";

/**
 * StoryPlayer —— 故事演绎视频播放器(首映页同款交互,共用组件)
 * - 点播放碟/画面:播放、暂停;播完碟变重播
 * - 进度条:跟随真实进度,点按跳转;时间 m:ss / m:ss
 * - 本地演示统一用 /videos/demo.mp4;真后端传 playbackUrl 即可
 */
export default function StoryPlayer({
  src,
  poster,
  onEnded,
}: {
  src: string;
  /** 封面海报(图片路径);加载前/未播时显示 */
  poster?: string;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);

  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
          onEnded?.();
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
      />
      {/* 播放/重播碟:暂停或播完时居中 */}
      {!playing && (
        <button
          onClick={togglePlay}
          aria-label={ended ? "重播" : "播放"}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--butter)",
            boxShadow: "0 4px 0 var(--butter-under)",
            zIndex: 3,
          }}
        >
          {ended ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ink-blue)" aria-hidden>
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>
      )}
      {/* 进度条:真实进度 + 点按跳转(压在画面底部) */}
      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 7,
          zIndex: 3,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--story)", flexShrink: 0 }} />
        <span
          onClick={(e) => {
            const v = videoRef.current;
            if (!v || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            v.currentTime = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * duration;
          }}
          style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(47,159,200,0.3)", cursor: "pointer", position: "relative" }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${duration ? (current / duration) * 100 : 0}%`,
              borderRadius: 2,
              background: "var(--story)",
              transition: "width 200ms linear",
            }}
          />
        </span>
        <span style={{ fontSize: 11, color: "var(--story)", fontVariantNumeric: "tabular-nums" }}>
          {fmt(current)} / {duration ? fmt(duration) : "0:00"}
        </span>
      </div>
    </>
  );
}
