import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";
export default function ActionIcon({ name, color = "#1B2437", size = 28 }: { name: "bus" | "fuel" | "repair" | "route"; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {name === "bus" && <><Rect x={5} y={3} width={14} height={16} rx={3}/><Path d="M5 11h14M8 19v2m8-2v2M9 3v8m6-8v8"/><Circle cx={8} cy={15} r={1}/><Circle cx={16} cy={15} r={1}/></>}
    {name === "fuel" && <><Path d="M3 21h12M5 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17M5 10h8m0 3h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9l-4-4M19 7v4h2"/></>}
    {name === "repair" && <Path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z"/>}
    {name === "route" && <><Circle cx={6} cy={6} r={3}/><Circle cx={18} cy={18} r={3}/><Path d="M9 6h7a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8"/></>}
  </Svg>;
}
