import type { DialogueTurn, Persona, SpeakerTurn } from "../types";
import { NARRATOR_ID } from "../types";

const AVATARS = ["/avatars/av-cat.png", "/avatars/av-glasses.png", "/avatars/av-bunny.png"];

function otherPartyName(transcript: string): string {
  if (/妈妈|母亲/.test(transcript)) return "妈妈";
  if (/同事|团队|老板/.test(transcript)) return "那个同事";
  if (/朋友|闺蜜/.test(transcript)) return "那个朋友";
  if (/伴侣|男友|女友|前任/.test(transcript)) return "故事里的对方";
  return "故事里的对方";
}

/** Frontend-only cast. It is deterministic so the demo remains coherent after refreshes. */
export function createDemoPersonas(transcript: string): Persona[] {
  const other = otherPartyName(transcript);
  return [
    {
      id: "demo-me",
      name: "我",
      profile: "讲述这件事的人，想把感受和事实慢慢分开。",
      avatar: AVATARS[0],
      voice: "说得克制，但会把在意的细节反复拿出来确认。",
    },
    {
      id: "demo-other",
      name: other,
      profile: "故事里的另一方，只代表一种可能的视角，不替现实中的任何人下结论。",
      avatar: AVATARS[1],
      voice: "先解释自己的处境，也愿意在被清楚表达时停下来听。",
    },
    {
      id: "demo-observer",
      name: "留在场景里的旁观者",
      profile: "记得事情经过，也提醒大家哪些是事实、哪些仍然未知。",
      avatar: AVATARS[2],
      voice: "语气平静，常把讨论带回已经发生的事和下一步。",
    },
  ];
}

export function createDemoGroupMessages(storyId: string, cast: Persona[], selectedId?: string): DialogueTurn[] {
  const speakers = cast.filter((persona) => persona.id !== selectedId);
  const first = speakers[0] ?? cast[0];
  const second = speakers[1] ?? cast[1] ?? first;
  const now = Date.now();

  return [
    {
      storyId,
      speakerId: NARRATOR_ID,
      text: "这里演的是一次重新看见，不是对现实关系的判决。",
      ts: now - 4_000,
    },
    {
      storyId,
      speakerId: first.id,
      text: "我先听见的是，你在那一刻很想把话说出来，却一直担心会不会不合适。",
      ts: now - 3_000,
    },
    {
      storyId,
      speakerId: second.id,
      text: "我们可以先把发生过的事放在这里，暂时不替任何人猜动机。",
      ts: now - 2_000,
    },
    {
      storyId,
      speakerId: first.id,
      text: "你现在最想让我们听见的，是哪一句？",
      ts: now - 1_000,
    },
  ];
}

export function createDemoTurns(mode: "opening" | "continue" | "invite" | "answer", speakers: string[], cast: Persona[], userMessage?: string): SpeakerTurn[] {
  const available = speakers.length > 0 ? speakers : cast.map((persona) => persona.id);
  const first = available[0];
  const second = available[1] ?? available[0];
  if (!first) return [];

  if (mode === "answer") {
    return [
      {
        speakerId: first,
        text: userMessage
          ? `我听见你说“${userMessage}”。这句话很具体，也是在把你真正需要的东西放到桌面上。`
          : "我在听。你可以先从最想说的一句开始。",
      },
      {
        speakerId: second,
        text: "先不用急着得到结论。我们可以一起看看，这句话希望对方明白什么。",
      },
    ];
  }

  return [
    { speakerId: first, text: "这里可以慢一点。先分清已经发生的事，再照顾当时的感受。" },
    { speakerId: second, text: "当你准备好了，我们再练习一句既清楚又不委屈自己的表达。" },
  ];
}

export function createDemoGodfatherReply(mode: "open" | "respond" | "linger" | "handoff", userMessage?: string): string {
  if (mode === "respond" && userMessage) return `我听见了：“${userMessage}”。先不用急着把它说得完美，能把真实感受放在这里已经很重要。`;
  if (mode === "handoff") return "房间已经准备好了。接下来可以换一个位置，再看看这件事。";
  return "你已经把这件事带到这里了。我们先不急着判断谁对谁错，慢慢把当时发生的、感受到的和猜测到的分开。";
}
