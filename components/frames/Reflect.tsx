"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { prepareSandplay, runGodfather, type PreparedSandplay } from "@/lib/api";
import { Companion } from "../characters";
import { TypeText } from "../ui";

/**
 * 阶段一 · 旁观者陪聊(docs/product-flow.md「两个阶段」)
 *
 * 说完故事之后、场景还在准备的那段等待里,一个**站在故事外**的声音陪用户说几句,
 * 谈「这件事说明什么」,而不是演绎剧情。准备就绪 → 它说一句话把人送进重演,然后退场。
 *
 * 与阶段二群聊的关键区别:这里只有一个声音、没有 SILENT / 轮内可见 / 2 人上限,
 * 且**由外部事件(解构完成)结束**,所以任何时刻都要可被打断 —— 不能写成定长脚本。
 *
 * 这一帧同时承担真正的等待:挂载即并行发起 prepareSandplay(建 session → 触发视频任务
 * → 提取人设),对话只是把这段等待填上。结果向上传给 PickRole,避免它再请求一次。
 */

const LINGER_AFTER = 22000; // 用户沉默且尚未就绪 → 再补一句
const MAX_LINGER = 2; // 补句上限,避免话痨
const AUTO_ADVANCE = 4200; // handoff 说完后自动进场的宽限(输入框有字则不自动走)

type Line = { who: "them" | "you"; text: string; id: number };

export default function Reflect({
  transcript,
  onReady,
  onBack,
}: {
  transcript: string;
  onReady: (prepared: PreparedSandplay) => void;
  onBack: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [handedOff, setHandedOff] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState(false); // 陪聊挂了不该挡路,单独标记

  const preparedRef = useRef<PreparedSandplay | null>(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false); // 一次只允许一个 godfather 请求在飞
  const openedRef = useRef(false); // 开场只说一次
  const inflightPrepRef = useRef<string | null>(null); // StrictMode 双挂去重
  const lingerCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef<Line[]>([]);
  linesRef.current = lines;
  const inputRef = useRef("");
  inputRef.current = input;
  const scrollRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const armLinger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!aliveRef.current || preparedRef.current || busyRef.current) return;
      if (lingerCountRef.current >= MAX_LINGER) return;
      lingerCountRef.current += 1;
      void say("linger");
    }, LINGER_AFTER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 说一句(open / respond / linger / handoff)。陪聊失败不阻断主链路,只记一次标记。 */
  const say = useCallback(
    async (mode: "open" | "respond" | "linger" | "handoff", userMessage?: string) => {
      if (busyRef.current || !aliveRef.current) return;
      busyRef.current = true;
      setThinking(true);
      try {
        const text = await runGodfather(mode, {
          transcript,
          history: linesRef.current.map((l) => ({
            storyId: "reflect",
            speakerId: l.who === "you" ? "user" : "godfather",
            text: l.text,
            ts: 0,
          })),
          userMessage,
        });
        if (!aliveRef.current) return;
        setVoiceError(false);
        setThinking(false);
        setStreaming(text);
        if (mode === "handoff") setHandedOff(true);
      } catch (e) {
        console.error(`[reflect] godfather ${mode} 失败:`, e);
        if (!aliveRef.current) return;
        setThinking(false);
        setVoiceError(true);
        // 陪聊说不出话时不能把人卡在这一帧:已就绪就直接放行
        if (mode === "handoff") setHandedOff(true);
      } finally {
        busyRef.current = false;
      }
    },
    [transcript]
  );

  /* 挂载:并行启动「真正的准备」与「开场白」 */
  useEffect(() => {
    aliveRef.current = true;
    if (inflightPrepRef.current !== transcript) {
      inflightPrepRef.current = transcript;
      setPrepError(null);
      prepareSandplay(transcript)
        .then((p) => {
          if (!aliveRef.current) return;
          preparedRef.current = p;
        })
        .catch((e) => {
          if (!aliveRef.current) return;
          setPrepError(e instanceof Error ? e.message : String(e));
          inflightPrepRef.current = null;
        });
    }
    if (!openedRef.current) {
      openedRef.current = true;
      void say("open");
    }
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, streaming, thinking]);

  /** 一句话说完落定:决定下一步 —— 就绪则交接,否则等用户。
   *  必须是稳定引用:TypeText 的 effect 依赖 onDone,每次父组件重渲染换新函数都会重置
   *  正在跑的逐字定时器 —— 用户一边打字一边看它吐字时会把整句卡住。 */
  const settle = useCallback(
    (text: string) => {
      setStreaming(null);
      setLines((l) => [...l, { who: "them", text, id: seqRef.current++ }]);
      if (!aliveRef.current) return;
      if (preparedRef.current && !handedOff) {
        void say("handoff");
      } else if (!handedOff) {
        armLinger();
      }
    },
    [handedOff, say, armLinger]
  );

  const handleStreamDone = useCallback(() => {
    if (streaming !== null) settle(streaming);
  }, [streaming, settle]);

  const send = () => {
    const text = input.trim();
    if (!text || busyRef.current) return;
    setInput("");
    if (timerRef.current) clearTimeout(timerRef.current);
    setLines((l) => [...l, { who: "you", text, id: seqRef.current++ }]);
    void say("respond", text);
  };

  const enter = useCallback(() => {
    if (!preparedRef.current) return;
    onReady(preparedRef.current);
  }, [onReady]);

  /* 交接说完 → 输入框为空时自动进场;有字说明用户还在写,等他按按钮 */
  useEffect(() => {
    if (!handedOff || streaming) return;
    const t = setTimeout(() => {
      if (aliveRef.current && !inputRef.current.trim()) enter();
    }, AUTO_ADVANCE);
    return () => clearTimeout(t);
  }, [handedOff, streaming, enter]);

  const ready = preparedRef.current !== null;

  return (
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">Before the scene</span>
        <span className="nav-side" />
      </div>

      {/* 陪聊的人 —— 站在故事外,所以是 companion 而不是故事人设头像 */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18, flexShrink: 0 }}>
        <Companion size={92} className="anim-bob" />
      </div>

      {/* 对话区 */}
      <div
        ref={scrollRef}
        aria-live="polite"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 8,
        }}
      >
        {lines.map((l) =>
          l.who === "them" ? (
            <ThemBubble key={l.id} text={l.text} />
          ) : (
            <YouBubble key={l.id} text={l.text} />
          )
        )}
        {streaming !== null && <ThemBubble streamingText={streaming} onDone={handleStreamDone} />}
        {thinking && <ThinkingDots />}

        {/* 准备失败:这条路走不下去,给真实原因 + 重试 */}
        {prepError && (
          <div style={{ textAlign: "center", padding: "18px 0" }}>
            <div className="meta-italic" style={{ fontSize: 13.5 }}>Couldn&rsquo;t set the scene just now.</div>
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--placeholder)", wordBreak: "break-word" }}>
              {prepError}
            </div>
            <button
              onClick={() => {
                inflightPrepRef.current = null;
                setPrepError(null);
                inflightPrepRef.current = transcript;
                prepareSandplay(transcript)
                  .then((p) => {
                    if (!aliveRef.current) return;
                    preparedRef.current = p;
                    if (!busyRef.current && !handedOff) void say("handoff");
                  })
                  .catch((e) => {
                    if (!aliveRef.current) return;
                    setPrepError(e instanceof Error ? e.message : String(e));
                    inflightPrepRef.current = null;
                  });
              }}
              style={{
                marginTop: 14,
                minHeight: 44,
                padding: "0 22px",
                borderRadius: 22,
                border: "1px solid var(--line)",
                background: "var(--raised)",
                fontSize: 14.5,
                color: "var(--ink)",
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* 陪聊挂了但准备没挂:不解释技术细节,只把人放行 */}
        {voiceError && !prepError && (
          <div className="meta-italic" style={{ alignSelf: "center", fontSize: 12.5 }}>
            quiet for a moment…
          </div>
        )}
      </div>

      {/* 底部:准备好之前是输入栏,准备好之后换成进场按钮 */}
      <div style={{ flexShrink: 0, paddingTop: 6 }}>
        {handedOff || (ready && voiceError) ? (
          <button className="btn" onClick={enter} style={{ width: "100%" }}>
            <span>Step into the scene</span>
          </button>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 52,
                padding: "0 8px 0 18px",
                borderRadius: 26,
                background: "var(--raised)",
                border: "1px solid var(--line-strong)",
                boxShadow: "var(--shadow-input)",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Say something back…"
                aria-label="Reply"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  background: "transparent",
                  fontSize: 15,
                  color: "var(--ink)",
                  padding: 0,
                }}
              />
              <button
                onClick={send}
                aria-label="Send"
                disabled={!input.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  opacity: input.trim() ? 1 : 0.45,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%", background: "var(--butter)", boxShadow: "var(--press-butter)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
                  </svg>
                </span>
              </button>
            </div>
            <div className="meta-italic" style={{ display: "block", textAlign: "center", marginTop: 10 }}>
              {ready ? "the scene is ready" : "setting the scene…"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* 旁观者的话:靠左,mist 底 —— 不是故事里的人,所以不带角色头像 */
function ThemBubble({
  text,
  streamingText,
  onDone,
}: {
  text?: string;
  streamingText?: string;
  onDone?: () => void;
}) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "88%",
        padding: "13px 16px",
        borderRadius: "20px 20px 20px 6px",
        background: "var(--sunken)",
        color: "var(--text-on-mist)",
        fontSize: 15.5,
        lineHeight: 1.55,
        animation: "bubbleIn 320ms var(--ease-soft) both",
      }}
    >
      {streamingText != null ? <TypeText text={streamingText} speed={24} onDone={onDone} /> : text}
    </div>
  );
}

/* 用户的话:靠右 */
function YouBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "82%",
        padding: "11px 15px",
        borderRadius: "20px 20px 6px 20px",
        background: "var(--sky)",
        color: "var(--text-on-sky)",
        fontSize: 15,
        lineHeight: 1.5,
        animation: "bubbleIn 320ms var(--ease-soft) both",
      }}
    >
      {text}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "14px 16px",
        borderRadius: "20px 20px 20px 6px",
        background: "var(--sunken)",
      }}
      aria-label="thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--ink-blue)",
            opacity: 0.55,
            animation: `think 1.3s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
