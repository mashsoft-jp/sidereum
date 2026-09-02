#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AR モードの姿勢 → 視線の変換 (src/ui/ar.js の arOnOrient) を代表的な姿勢で確かめる。
//
//   node tools/ar-test.mjs
//
// ブラウザペインにはセンサーが無く、実機では「北を向いたら南が出た」程度にしか
// 分からないので、行列と画面の向きの符号をここで押さえる。ar.js から関数の本文を
// 切り出して評価する (写しを持つと片方だけ腐る)。
// ---------------------------------------------------------------------------
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = await readFile(path.join(ROOT, "src/ui/ar.js"), "utf8");
const m = src.match(/\n  function arOnOrient\(e\) \{[\s\S]*?\n  \}\n/);
if (!m) { console.error("ar-test: arOnOrient が見つかりません"); process.exit(1); }

const DEG = Math.PI / 180;
// 関数が触る断片スコープの変数を用意して、その中で評価する
const make = new Function("DEG", `
  let arAbs = false, arRel = false, arHeadOff = 0, arHeadHave = false, arHave = false, arAzOff = 0;
  const arFwdT = [0, 0, -1], arUpT = [0, 1, 0], arFwd = [0, 0, -1], arUp = [0, 1, 0];
  let screenAngle = () => 0;
  const updateHint = () => {};
  const wrapPi = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const window = { removeEventListener() {}, addEventListener() {} };
  ${m[0]}
  return (e, screen, azOff, abs) => {
    arAbs = !!abs; arRel = false; arHeadHave = false; arHeadOff = 0; arHave = false; arAzOff = azOff || 0;
    screenAngle = () => screen || 0;
    arOnOrient(e);
    return { fwd: [...arFwdT], up: [...arUpT], rel: arRel };
  };
`);
const run = make(DEG);

function pose(alpha, beta, gamma, opt = {}) {
  const e = { alpha, beta, gamma, absolute: !!opt.abs };
  if (opt.heading != null) e.webkitCompassHeading = opt.heading;
  const { fwd, up, rel } = run(e, opt.screen, (opt.azOff || 0) * DEG, opt.abs);
  const az = ((Math.atan2(fwd[0], -fwd[2]) / DEG) + 360) % 360, alt = Math.asin(fwd[1]) / DEG;
  const r = [fwd[1]*up[2]-fwd[2]*up[1], fwd[2]*up[0]-fwd[0]*up[2], fwd[0]*up[1]-fwd[1]*up[0]];
  const roll = Math.atan2(r[1], up[1]) / DEG;   // 画面の上が天頂からどれだけ傾いているか
  const dot = fwd[0]*up[0] + fwd[1]*up[1] + fwd[2]*up[2];
  return { az: +az.toFixed(1), alt: +alt.toFixed(1), roll: +roll.toFixed(1), dot: +dot.toFixed(6), rel };
}
// [名前, 実測, 期待]。期待の null はその項目を見ない
const cases = [
  ["立てて北へ (地平線)",                    pose(0, 90, 0, { abs: true }),        { az: 0, alt: 0, roll: 0 }],
  ["東の高度45° (α=270, β=135)",             pose(270, 135, 0, { abs: true }),     { az: 90, alt: 45, roll: 0 }],
  ["南の高度45°",                            pose(180, 135, 0, { abs: true }),     { az: 180, alt: 45, roll: 0 }],
  ["寝かせて画面を上に (裏は真下)",           pose(0, 0, 0, { abs: true }),         { az: null, alt: -90 }],
  ["天頂 (β=180)",                           pose(0, 180, 0, { abs: true }),       { az: null, alt: 90 }],
  ["立てた端末の γ はヨー (西→250°)",         pose(90, 90, 20, { abs: true }),      { az: 250, alt: 0, roll: 0 }],
  ["横持ち 上端が左 (angle 90) で北",         pose(90, 0, -90, { abs: true, screen: 90 }),   { az: 0, alt: 0, roll: 0 }],
  ["横持ち 上端が右 (angle 270) で北",        pose(270, 0, 90, { abs: true, screen: 270 }),  { az: 0, alt: 0, roll: 0 }],
  ["方位の基準が無い (相対のみ) → arRel",     pose(270, 135, 0, { abs: false }), { az: null, rel: true }],
  ["iOS: α は無意味、コンパスが東",            pose(37, 90, 0, { heading: 90 }),     { az: 90, alt: 0, roll: 0, rel: false }],
  ["iOS: 寝かせぎみ (β=30) コンパス北",        pose(123, 30, 0, { heading: 0 }),     { az: 0, alt: -60, roll: 0 }],
  ["iOS: 天頂を過ぎた (β=120) コンパス南",     pose(200, 120, 0, { heading: 180 }),  { az: 180, alt: 30, roll: 0 }],
  ["方位補正 +10°",                          pose(0, 90, 0, { abs: true, azOff: 10 }), { az: 10, alt: 0 }],
];
let bad = 0;
for (const [name, got, exp] of cases) {
  let ok = Math.abs(got.dot) < 1e-6;   // 視線と画面の上は直交していること
  for (const k of Object.keys(exp)) {
    if (exp[k] == null) continue;
    if (typeof exp[k] === "boolean") { if (got[k] !== exp[k]) ok = false; continue; }
    if (Math.abs(((got[k] - exp[k] + 540) % 360) - 180) > 0.2) ok = false;
  }
  if (!ok) bad++;
  console.log((ok ? "ok  " : "NG  ") + name.padEnd(36) + JSON.stringify(got));
}
console.log(bad ? `ar-test: ${bad} 件 NG` : "ar-test: すべて一致");
process.exit(bad ? 1 : 0);
