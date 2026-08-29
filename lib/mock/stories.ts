import type { Story } from "../types";

/** 预置故事 —— 首次打开时种入（之后走 localStorage / 后端） */
export const SEED_STORIES: Story[] = [
  {
    id: "seed-1",
    title: "鼓起勇气的一天",
    date: "2024年6月12日",
    cover: "sage",
    transcript:
      "今天开会我终于把话说出来了。手一直在抖,但憋了好几周的那句话,我说出口了。没有人笑我。其实,有两个人还点了点头。",
    createdAt: new Date("2024-06-12T20:30:00").getTime(),
  },
  {
    id: "seed-2",
    title: "午间的小胜利",
    date: "2026年8月3日",
    cover: "blush",
    transcript:
      "中午一个人在天台吃午饭。以前总觉得一个人吃饭是哪里不对劲。今天只觉得,这是属于我自己的时间。风很暖,我慢慢地把三明治吃完了。",
    createdAt: new Date("2026-08-03T13:10:00").getTime(),
  },
  {
    id: "seed-3",
    title: "一通没拨出去的电话",
    date: "2026年8月21日",
    cover: "lavender",
    transcript:
      "今晚差点给妈妈打了电话。号码都输好了,我盯着看了很久。最后没拨出去,但把想说的话写了下来。也许这算第一步吧。也许,明天。",
    createdAt: new Date("2026-08-21T22:05:00").getTime(),
  },
];
