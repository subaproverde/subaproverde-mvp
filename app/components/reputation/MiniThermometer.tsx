"use client";

import React from "react";
import type { ReputationLevel } from "./ReputationThermometer";

type Props = {
  level: ReputationLevel;
  className?: string;
};

function norm(level: ReputationLevel): "verde" | "amarelo" | "vermelho" {
  if (level === "laranja") return "amarelo";
  return level;
}

export function MiniThermometer({ level, className }: Props) {
  const lv = norm(level);

  const bg =
    lv === "vermelho"
      ? "bg-red-500"
      : lv === "amarelo"
      ? "bg-yellow-500"
      : "bg-green-500";

  return <div className={`h-3 w-3 rounded-full ${bg} ${className ?? ""}`} title={level} />;
}
