import type { Character } from "../types";

/** 房间常驻角色 —— 理理理.md §3；美术用 handoff assets（§5，占位 PNG，后续整体替换）
 *  color = Other Spaces 卡片 field tint（handoff 05-other-spaces.html 实测值） */
export const CHARACTERS: Character[] = [
  {
    id: "pico",
    name: "Pico",
    species: "dog",
    personality: "温暖、稳定、陪伴感；先接住情绪再给回应；用户最熟的声音",
    color: "#E9EDE2",
  },
  {
    id: "mira",
    name: "Mira",
    species: "cat",
    personality: "敏锐、温和地追问；擅长问出“谁允许的？”这类问题",
    color: "#E7EDE0",
  },
  {
    id: "renn",
    name: "Renn",
    species: "fox",
    personality: "智慧的 reframer；把自责重新框架（“房间没有拒绝你”）",
    color: "#F1E4DC",
  },
  {
    id: "tola",
    name: "Tola",
    species: "bear",
    personality: "柔软、肯定型；负责拥抱和兜底",
    color: "#E8E6EF",
  },
  {
    id: "sena",
    name: "Sena",
    species: "bunny",
    personality: "轻快、好奇；带来小视角和小惊喜",
    color: "#EFEADA",
  },
  {
    id: "ivo",
    name: "Ivo",
    species: "owl",
    personality: "冷静的观察者；给结构化的小洞察",
    color: "#E4EAEC",
  },
];

export const characterById = (id: string): Character =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
