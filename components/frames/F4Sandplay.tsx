"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, Persona, SpeakerTurn, Story } from "@/lib/types";
import { NARRATOR_ID } from "@/lib/types";
import { runTurn, transcribeAudio, type TurnMode } from "@/lib/api";
import { MOCK_PERSONAS } from "@/lib/mock/personas";
import { TypeText, Waveform } from "../ui";
import StoryPlayer from "../ui/StoryPlayer";
import ChatInput from "../ui/ChatInput";

/**
 * F4 — The sandplay · 板块二（直播间形态,全真实 LLM,无 mock）
 * 群聊节奏(docs/product-flow.md F4):
 *   opening  暖场几句 → 停下来等用户(WAIT_AFTER_OPENING)
 *   continue 用户沉默 → AI 之间续聊一轮 → 再等(WAIT_AFTER_CONTINUE)
 *   invite   仍沉默 → 一位 AI 点名邀请用户带入的角色 → 再等(WAIT_AFTER_INVITE)
 *   end      三轮仍无互动 → 弹窗问用户要不要结束(Keep / 再待会儿)
 *   用户开口 → answer:所有 AI 直接回应用户 → 节奏重置回 opening 后的等待
 * 防打架/防卡死:AI 自聊每轮最多 2 位开口、每段沉默期只续一轮;prompt 禁争论禁复读;
 * 轮内串行可见(后者读得到前者本轮发言)。
 */

const WAIT_AFTER_OPENING = 18000;
const WAIT_AFTER_CONTINUE = 18000;
const WAIT_AFTER_INVITE = 20000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toTurn = (storyId: string, t: SpeakerTurn): DialogueTurn => ({
  storyId,
  speakerId: t.speakerId,
  text: t.text,
  ts: Date.now(),
});

export default function F4Sandplay({
  story,
  persona,
  cast,
  onBack,
  onKeep,
  onDiscard,
}: {
  story: Story;
  persona?: Persona | null; // 用户带入的角色：发言以该角色身份出现在群聊里
  cast?: Persona[]; // 故事 Top 3；老故事没有时回退到 mock 阵容(仅元数据,发言仍是真 LLM)
  onBack: () => void;
  onKeep?: () => void; // 草稿故事:结束弹窗/End 按钮/返回确认里给 Keep 入口
  onDiscard?: () => void; // 草稿故事:返回确认弹窗里"不要了"丢弃草稿
}) {
  const castList = useMemo(() => (cast && cast.length > 0 ? cast : MOCK_PERSONAS), [cast]);
  /** AI 发言者 = Top 3 中除用户带入者之外的人设(各自独立 LLM session) */
  const aiSpeakers = useMemo(
    () => castList.filter((p) => p.id !== persona?.id).map((p) => p.id),
    [castList, persona]
  );
  const personaById = useCallback((id: string) => castList.find((p) => p.id === id), [castList]);

  const [messages, setMessages] = useState<DialogueTurn[]>([]);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<SpeakerTurn | null>(null);
  const [input, setInput] = useState("");
  const [showEnd, setShowEnd] = useState(false); // 三轮无互动 → 结束弹窗
  const [showLeave, setShowLeave] = useState(false); // 草稿流程返回键 → 二次确认弹窗
  const [llmError, setLlmError] = useState<{ mode: TurnMode; speakers: string[]; after: () => void; userMessage?: string } | null>(null); // 最近失败的一轮,给弹幕区重试入口

  const queueRef = useRef<SpeakerTurn[]>([]);
  const runningRef = useRef(false);
  const resolverRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiSpeakersRef = useRef(aiSpeakers);
  aiSpeakersRef.current = aiSpeakers;
  const castRef = useRef(castList);
  castRef.current = castList;
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const messagesRef = useRef<DialogueTurn[]>([]);
  messagesRef.current = messages;
  const storyRef = useRef(story);
  storyRef.current = story;

  /* ── 节奏原语 ── */

  const armTimer = (ms: number, fn: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (aliveRef.current) fn();
    }, ms);
  };

  /** 依次播出队列里的发言:typing 预告 → 逐字流出 → 落定 */
  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length > 0 && aliveRef.current) {
      const turn = queueRef.current.shift()!;
      setTypingId(turn.speakerId);
      await wait(1000);
      if (!aliveRef.current) break;
      setTypingId(null);
      setStreaming(turn);
      await new Promise<void>((resolve) => {
        resolverRef.current = resolve;
      });
      setStreaming(null);
      await wait(420);
    }
    runningRef.current = false;
  }

  /** 跑一轮 LLM 发言;失败在弹幕区给重试入口、节奏继续(全真实模式,不塞假数据) */
  async function runRound(mode: TurnMode, speakers: string[], after: () => void, userMessage?: string) {
    // 无人可发言(如短转写只提取到"我")→ 直接跳过本轮,不打 422、不挂重试 chip
    if (speakers.length === 0) {
      if (aliveRef.current) after();
      return;
    }
    // 即时反馈:请求期间就先亮出"对方正在输入"(3-6s 的 LLM 等待不再像没人搭理);
    // 返回后若首位发言人相同,pump 接管 typingId 无闪烁
    if (aliveRef.current) setTypingId(speakers[0]);
    try {
      const turns = await runTurn(mode, speakers, {
        transcript: storyRef.current.transcript,
        cast: castRef.current,
        history: messagesRef.current,
        userName: personaRef.current?.name ?? "the narrator",
        sessionId: storyRef.current.backendSessionId,
        userPersonaId: personaRef.current?.id,
        userMessage,
      });
      if (!aliveRef.current) return;
      setLlmError(null);
      if (turns.length > 0) {
        queueRef.current.push(...turns);
        await pump();
      } else {
        setTypingId(null); // 全员沉默 → 收起 typing 预告
      }
    } catch (e) {
      console.error(`[sandplay] ${mode} 轮 LLM 调用失败:`, e);
      if (aliveRef.current) {
        setTypingId(null); // 失败 → 收起 typing,弹幕区给重试入口
        setLlmError({ mode, speakers, after, userMessage });
      }
    }
    if (aliveRef.current) after();
  }

  /** 重试最近失败的一轮(after 闭包原样带上,节奏计时会被 armTimer 去重) */
  const retryRound = () => {
    const r = llmError;
    if (!r) return;
    setLlmError(null);
    void runRound(r.mode, r.speakers, r.after, r.userMessage);
  };

  /* 沉默期推进:continue → invite → 结束弹窗 */
  function stepContinue() {
    void runRound("continue", aiSpeakersRef.current, () => armTimer(WAIT_AFTER_CONTINUE, stepInvite));
  }
  function stepInvite() {
    const inviter = aiSpeakersRef.current[0];
    void runRound("invite", inviter ? [inviter] : [], () => armTimer(WAIT_AFTER_INVITE, () => setShowEnd(true)));
  }
  /** 一轮活动结束后:等用户 WAIT_AFTER_OPENING,不应则进入沉默期推进 */
  function waitForUser() {
    armTimer(WAIT_AFTER_OPENING, stepContinue);
  }

  useEffect(() => {
    aliveRef.current = true;
    queueRef.current = [];
    setMessages([]);
    setStreaming(null);
    setTypingId(null);
    setShowEnd(false);
    setShowLeave(false);
    setLlmError(null);
    void runRound("opening", aiSpeakersRef.current, waitForUser);
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (voiceTickRef.current) clearInterval(voiceTickRef.current);
      if (recorderRef.current) {
        recorderRef.current.onstop = null;
        recorderRef.current.stream.getTracks().forEach((t) => t.stop());
        if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
      }
      resolverRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, typingId]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowEnd(false); // 用户回来了 → 收起结束弹窗
    const userTurn = toTurn(story.id, { speakerId: "user", text });
    // ref 平时靠重渲染赋值,但 runRound 是在 setMessages 之后同步调用的 —— 那时还没重渲染。
    // 不手动同步这一句,发出去的 history 就少了用户刚说的话(下一行 setMessages 会以相同内容覆盖回来)。
    messagesRef.current = [...messagesRef.current, userTurn];
    setMessages((m) => [...m, userTurn]);
    // 用户开口:所有 AI 都要思考如何回应用户,然后节奏重置
    void runRound("answer", aiSpeakersRef.current, waitForUser, text);
  };



  /* ── 语音发言(coding-agent 式:点 mic → 输入条变实时录音条;再点 → 转写落进输入框,
     用户确认/修改后再手动发送;转写走真接口 transcribeAudio,失败提示不挡路) ── */
  const [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceSec, setVoiceSec] = useState(0);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showVoiceNote = (text: string) => {
    setVoiceNote(text);
    setTimeout(() => setVoiceNote(null), 2200);
  };

  const startVoice = async () => {
    if (voice !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showVoiceNote("这个设备用不了麦克风,还是打字吧");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setVoice("idle");
          return;
        }
        const ext = (rec.mimeType || "").includes("mp4") ? "mp4" : "webm";
        setVoice("transcribing");
        transcribeAudio(blob, `voice.${ext}`)
          .then((text) => {
            // 转写结果落进输入框,追加在已有文字后,用户确认后再发
            setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
            setVoice("idle");
          })
          .catch(() => {
            setVoice("idle");
            showVoiceNote("没听清,再试一次");
          });
      };
      rec.start();
      setVoiceSec(0);
      voiceTickRef.current = setInterval(() => setVoiceSec((s) => s + 1), 1000);
      setVoice("recording");
    } catch {
      showVoiceNote("没拿到麦克风权限,还是打字吧");
    }
  };

  const stopVoice = (cancel: boolean) => {
    if (voiceTickRef.current) {
      clearInterval(voiceTickRef.current);
      voiceTickRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      setVoice("idle");
      return;
    }
    if (cancel) {
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
      rec.stop();
      setVoice("idle");
      return;
    }
    rec.stop(); // 完成:onstop 里走转写
  };

  /* 旁白(上帝视角):后端判断时机,回复流里 speakerId = narrator 的一条。
     不走普通聊天气泡 —— 最新一条钉在聊天区顶部,样式完全不同(深底);流式时逐字吐在横幅里 */
  const narratorStreaming = streaming?.speakerId === NARRATOR_ID ? streaming : null;
  const narratorLatest = [...messages].reverse().find((m) => m.speakerId === NARRATOR_ID);
  const settleStreaming = () => {
    const done = streaming;
    if (!done) return;
    setMessages((m) => [...m, toTurn(story.id, done)]);
    resolverRef.current?.();
  };

  return (
    <div className="frame frame-enter" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* ══ 顶部:雾蓝波浪布条(短版,同 Home 的手法) ══ */}
      <svg aria-hidden viewBox="0 0 390 76" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto", aspectRatio: "390 / 76", pointerEvents: "none", zIndex: 102, filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.05))" }}>
        <defs>
          <linearGradient id="roomBandG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EAF6FB" />
            <stop offset="72%" stopColor="var(--mist)" />
            <stop offset="100%" stopColor="var(--sky)" />
          </linearGradient>
        </defs>
        <path d="M0 20 Q0 0 20 0 H370 Q390 0 390 20 V46 Q364 70 338 70 T286 46 Q260 70 234 70 T182 46 Q156 70 130 70 T78 46 Q52 70 26 70 T0 52 Z" fill="url(#roomBandG)" />
        <path d="M390 40 Q364 64 338 64 T286 40 Q260 64 234 64 T182 40 Q156 64 130 64 T78 40 Q52 64 26 64 T0 46" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
      </svg>

      {/* ══ 内容层 ══ */}
      <div style={{ position: "relative", zIndex: 103, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* nav:ribbon 返回(故事房间)+ 右侧 End(草稿才有) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px var(--screen-x) 0", flexShrink: 0 }}>
          <button
            className="ribbon"
            onClick={() => (onKeep ? setShowLeave(true) : onBack())}
            aria-label="返回"
            style={{ border: "none", cursor: "pointer", gap: 7 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
            故事房间
          </button>
          {onKeep && (
            <button onClick={onKeep} style={{ minHeight: 44, fontSize: 14, fontStyle: "italic", color: "var(--ink-blue)" }}>
              结束
            </button>
          )}
        </div>


        {/* ══ 旁白横幅:上帝视角的客观陈述,钉在聊天区顶部,与所有角色气泡完全区分 ══ */}
        {(narratorStreaming || narratorLatest) && (
          <div key={narratorLatest?.ts ?? "stream"} style={{ margin: "10px var(--screen-x) 0", flexShrink: 0 }}>
            <div
              style={{
                background: "var(--ink-blue)",
                borderRadius: "var(--r-chip)",
                padding: "10px 14px 11px",
                boxShadow: "var(--lift-2)",
                animation: "bubbleIn 320ms var(--ease-soft) both",
              }}
            >
              <span style={{ display: "block", fontSize: 11, fontStyle: "italic", letterSpacing: 1.5, color: "rgba(255,249,238,0.65)" }}>
                旁白 · 上帝视角
              </span>
              <span
                aria-live={narratorStreaming ? "polite" : undefined}
                style={{ display: "block", marginTop: 4, fontSize: 13.5, fontStyle: "italic", lineHeight: 1.6, color: "var(--text-on-ink)" }}
              >
                {narratorStreaming ? <TypeText text={narratorStreaming.text} speed={26} onDone={settleStreaming} /> : narratorLatest?.text}
              </span>
            </div>
          </div>
        )}

        {/* ══ 群聊列表(视频放映卡也在流里:随对话自然被顶上去) ══ */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px var(--screen-x) 10px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* 放映卡:拍立得形式(渐变描边卡 + 裱框内阴影 + 底 mat 进度条),全局一致 */}
          <div className="card-frame" style={{ borderRadius: "var(--r-panel)", padding: "10px 10px 0", boxShadow: "var(--lift-3)", flexShrink: 0 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: "var(--r-photo)",
                overflow: "hidden",
                background: "var(--mist)",
              }}
            >
              {/* 与首映同款播放器(StoryPlayer);本地演示统一 demo 片,真后端换 playbackUrl */}
              <StoryPlayer src="/videos/demo.mp4" />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  boxShadow: "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            </div>

          </div>

          {messages.map((m) =>
            m.speakerId === NARRATOR_ID ? null : m.speakerId === "user" ? (
              <div key={m.ts + m.text} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 8, animation: "bubbleIn 300ms var(--ease-soft) both" }}>
                <div
                  style={{
                    maxWidth: "76%",
                    padding: "9px 14px",
                    borderRadius: "16px 4px 16px 16px",
                    background: "var(--butter)",
                    boxShadow: "var(--lift-1)",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>{m.text}</span>
                </div>
                {persona && <ChatAvatar speaker={persona} />}
              </div>
            ) : (
              <ChatMessage key={m.ts + m.text} speaker={personaById(m.speakerId)} text={m.text} />
            )
          )}
          {streaming && streaming.speakerId !== NARRATOR_ID && (
            <ChatMessage
              speaker={personaById(streaming.speakerId)}
              streamingText={streaming.text}
              onStreamDone={settleStreaming}
            />
          )}
          {typingId && typingId !== NARRATOR_ID && <ChatTyping speaker={personaById(typingId)} />}
          {llmError && (
            <button
              onClick={retryRound}
              style={{
                alignSelf: "center",
                padding: "8px 16px",
                borderRadius: 999,
                background: "var(--raised)",
                border: "none",
                boxShadow: "var(--lift-1)",
                fontSize: 12.5,
                fontStyle: "italic",
                color: "var(--readable)",
                animation: "bubbleIn 300ms var(--ease-soft) both",
              }}
            >
              房间突然安静了 · 点我重试
            </button>
          )}
        </div>

        {/* ══ 底部输入带:sky 带 + 车缝;左 mic / 中输入 / 右发送 ══ */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            background: "var(--sky)",
            borderRadius: "22px 22px 0 0",
            padding: "14px var(--screen-x) max(14px, env(safe-area-inset-bottom))",
          }}
        >
          <svg aria-hidden viewBox="0 0 390 10" preserveAspectRatio="none" style={{ position: "absolute", top: -1, left: 0, width: "100%", height: 10 }}>
            <path d="M0 5 Q24 0 48 5 T97 5 T146 5 T195 5 T244 5 T293 5 T342 5 T390 5" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {voice === "idle" ? (
              <>
                <button
                  onClick={startVoice}
                  aria-label="语音发言"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: "var(--cream)",
                    boxShadow: "var(--lift-1)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--story)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
                    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
                  </svg>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={send}
                    placeholder={persona ? `以${persona.name}的身份说…` : "写点什么…"}
                  />
                </div>
              </>
            ) : (
              /* 语音实时交互条:左取消 / 中波形+计时(或整理中)/ 右完成 */
              <>
                <button
                  onClick={() => stopVoice(true)}
                  disabled={voice === "transcribing"}
                  aria-label="取消语音"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: "var(--cream)",
                    boxShadow: "var(--lift-1)",
                    flexShrink: 0,
                    opacity: voice === "transcribing" ? 0.45 : 1,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 46,
                    borderRadius: 23,
                    background: "var(--cream)",
                    boxShadow: "var(--lift-1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "0 16px",
                    position: "relative",
                  }}
                >
                  {voice === "recording" && (
                    <>
                      {/* 录音中:coral 双涟漪(复用 listen keyframes,同 F2) */}
                      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 23, border: "1.5px solid var(--coral)", animation: "listen 1.8s ease-out infinite", pointerEvents: "none" }} />
                      <Waveform active />
                      <span style={{ fontSize: 13, color: "var(--ink)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                        {Math.floor(voiceSec / 60)}:{String(voiceSec % 60).padStart(2, "0")}
                      </span>
                    </>
                  )}
                  {voice === "transcribing" && (
                    <span className="meta-italic" style={{ fontSize: 13 }}>整理成文字…</span>
                  )}
                </div>
                <button
                  onClick={() => stopVoice(false)}
                  disabled={voice === "transcribing"}
                  aria-label="完成语音"
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
                    opacity: voice === "transcribing" ? 0.45 : 1,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {/* 语音提示条 */}
          {voiceNote && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -34,
                transform: "translateX(-50%)",
                padding: "6px 14px",
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--cream)",
                fontSize: 12,
                boxShadow: "var(--lift-2)",
                animation: "bubbleIn 300ms var(--ease-soft) both",
                whiteSpace: "nowrap",
              }}
            >
              {voiceNote}
            </div>
          )}
        </div>
      </div>

      {/* ══ 三轮无互动 → 结束弹窗 ══ */}
      {showEnd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--scrim)",
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: 300,
              background: "var(--raised)",
              borderRadius: 20,
              padding: "26px 22px 18px",
              textAlign: "center",
              boxShadow: "var(--shadow-button)",
              animation: "bubbleIn 400ms var(--ease-soft) both",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>房间安静下来了</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              要把这个故事收起来吗?
            </div>
            <button
              onClick={() => (onKeep ? onKeep() : onBack())}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>{onKeep ? "存下这个故事" : "离开房间"}</span>
            </button>
            <button
              onClick={() => {
                setShowEnd(false);
                waitForUser(); // 再待一会儿:重新进入等待节奏
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              再待一会儿
            </button>
          </div>
        </div>
      )}

      {/* ══ 草稿流程返回键 → 二次确认:Keep 存档 / 丢弃草稿 ══ */}
      {showLeave && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--scrim)",
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: 300,
              background: "var(--raised)",
              borderRadius: 20,
              padding: "26px 22px 18px",
              textAlign: "center",
              boxShadow: "var(--shadow-button)",
              animation: "bubbleIn 400ms var(--ease-soft) both",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>走之前,要存下这个故事吗?</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              它可以留下来陪你,也可以就这么散去。
            </div>
            <button
              onClick={() => {
                setShowLeave(false);
                onKeep?.();
              }}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>存下</span>
            </button>
            <button
              onClick={() => {
                setShowLeave(false);
                (onDiscard ?? onBack)();
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              不要了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 他人的一条消息:头像 + 名字(在气泡上方)+ 白底气泡带阴影 */
function ChatMessage({
  speaker,
  text,
  streamingText,
  onStreamDone,
}: {
  speaker?: Persona;
  text?: string;
  streamingText?: string;
  onStreamDone?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speaker={speaker} />
      <div style={{ minWidth: 0, maxWidth: "76%" }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-blue)", margin: "0 0 3px 4px" }}>
          {speaker?.name ?? "…"}
        </span>
        <div
          style={{
            padding: "9px 14px",
            borderRadius: "4px 16px 16px 16px",
            background: "var(--raised)",
            boxShadow: "var(--lift-1)",
          }}
        >
          <span aria-live={streamingText != null ? "polite" : undefined} style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>
            {streamingText != null ? <TypeText text={streamingText} speed={26} onDone={onStreamDone} /> : text}
          </span>
        </div>
      </div>
    </div>
  );
}

/* typing 预告:头像 + 白底气泡三点 */
function ChatTyping({ speaker }: { speaker?: Persona }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speaker={speaker} />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 18,
          padding: "12px 15px",
          borderRadius: "4px 16px 16px 16px",
          background: "var(--raised)",
          boxShadow: "var(--lift-1)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--story)",
              animation: `think 1.3s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* 群聊头像:40px 圆,裁脸 */
function ChatAvatar({ speaker }: { speaker?: Persona }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--mist)",
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      {speaker && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={speaker.avatar} alt={speaker.name} style={{ width: 40, height: 40, objectFit: "cover", objectPosition: "50% 12%" }} />
      )}
    </span>
  );
}
