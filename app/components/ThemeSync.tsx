"use client";
import { useEffect } from "react";
import { applySpvTheme, readSpvTheme } from "@/lib/spvTheme";
export default function ThemeSync() {
  useEffect(() => {
    const sync = () => applySpvTheme(readSpvTheme());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("spv-theme-change", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("spv-theme-change", sync); };
  }, []);
  return null;
}
