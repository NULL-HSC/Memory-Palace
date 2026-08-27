import type { Story } from "../types";

/** 预置故事 —— 首次打开时种入（之后走 localStorage / 后端） */
export const SEED_STORIES: Story[] = [
  {
    id: "seed-1",
    title: "A Day About Courage",
    date: "the twelfth of June, 2024",
    cover: "sage",
    transcript:
      "I finally spoke up in the meeting today. My hands were shaking the whole time, but I said the thing I had been holding for weeks. Nobody laughed. Actually, two people nodded.",
    createdAt: new Date("2024-06-12T20:30:00").getTime(),
  },
  {
    id: "seed-2",
    title: "The Quiet Win at Noon",
    date: "the third of August, 2026",
    cover: "blush",
    transcript:
      "Lunch alone on the rooftop. I used to think eating alone meant something was wrong. Today it just felt like mine. The wind was warm and I finished my sandwich slowly.",
    createdAt: new Date("2026-08-03T13:10:00").getTime(),
  },
  {
    id: "seed-3",
    title: "An Almost-Phone-Call",
    date: "the twenty-first of August, 2026",
    cover: "lavender",
    transcript:
      "I almost called my mom tonight. I typed the number and stared at it. I didn't press call, but I wrote down what I wanted to say. Maybe that's a first step. Maybe tomorrow.",
    createdAt: new Date("2026-08-21T22:05:00").getTime(),
  },
];
