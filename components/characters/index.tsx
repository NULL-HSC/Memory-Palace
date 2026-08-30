import React from "react";

/**
 * 角色头像 —— handoff assets/ 占位 PNG（spec §5：全部为 placeholder，
 * 正式美术交付后只换 public/avatars/ 下的文件，组件不动）。
 * 统一底对齐（ anchored to bottom ），object-fit: contain。
 */

export type FaceId = "pico" | "mira" | "renn" | "tola" | "sena" | "ivo";

const AVATAR_SRC: Record<FaceId, string> = {
  pico: "/avatars/av-dog.png",
  mira: "/avatars/av-cat.png",
  renn: "/avatars/av-fox.png",
  tola: "/avatars/av-bear.png",
  sena: "/avatars/av-bunny.png",
  ivo: "/avatars/av-duck.png", // handoff 里 Ivo 是鸭；product-flow.md §3 写作 owl，美术交付时统一
};

/** companion（用户自己的角色）：My Space 勋章 / Speak It 倾听者 */
export const COMPANION_SRC = "/avatars/companion.png";

export interface AvatarProps {
  id: FaceId;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CharacterFace({ id, size = 96, className, style }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={AVATAR_SRC[id]}
      alt={id}
      className={className}
      style={{ width: size, height: size * 1.12, objectFit: "contain", display: "block", ...style }}
    />
  );
}

export function Companion({ size = 96, className, style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={COMPANION_SRC}
      alt="companion"
      className={className}
      style={{ width: size, height: size * 1.02, objectFit: "contain", display: "block", ...style }}
    />
  );
}
