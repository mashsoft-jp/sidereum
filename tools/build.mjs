#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Sidereum ビルド: src/ の断片を決まった順で連結し index.html を生成する。
//
//   node tools/build.mjs              index.html を生成
//   node tools/build.mjs --check      生成せず既存 index.html と比較 (差分があれば非0終了)
//   node tools/build.mjs --no-markers 境界コメントと自動生成ヘッダを抑止 (移行検証用)
//   node tools/build.mjs --out <path> 出力先を変更
//
// 依存パッケージなし (Node 標準のみ)。圧縮・難読化・トランスパイルは行わない。
//
// ★ これは「モジュール分割」ではなく「ソース断片の分離」である。
//   全断片は同一 IIFE のスコープを共有し、連結順そのものが意味を持つ:
//     - 関数宣言のホイスティングに依存した前方参照がある
//       (positionInfoPanel / setMenu / updateHint / bindHold など)
//     - 即時実行文が前方の const に依存する TDZ 箇所が多数ある
//   したがって順序は下の MANIFEST で明示的に固定する。
//   ディレクトリ走査やファイル名順に依存してはならない。
//
//   また 2箇所にトップレベル return があるため (WebGL 取得失敗・シェーダ
//   コンパイル失敗時の早期脱出)、各断片は単独の JS ファイルとしては構文的に
//   不正である。構文確認は連結後の生成物に対して行うこと。
// ---------------------------------------------------------------------------

import { readFile, writeFile, rename, readdir, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

// ★ 連結順 (並べ替え禁止)
const MANIFEST = [
  "data/bodies.js",      // 基本定数・天体/太陽/月・衛星
  "data/probes.js",      // 探査機の軌跡 (i18n が英語名を作るのでその前に)
  "data/i18n.js",        // UI 辞書・EN_DATA・画像クレジット
  "data/tours.js",       // ガイドツアーのシーン定義
  "core/math.js",        // 表示スケール・ケプラー軌道・mat4
  "core/atmos.js",       // 大気の定数 (GLSL と共有) と空の明るさ
  "gl/setup.js",         // canvas/gl・シェーダ・プログラム・ジオメトリ  ※return を含む
  "data/models.js",      // 探査機の 3D モデル (base64, NASA 3D Resources)
  "data/textures.js",    // テクスチャ (base64)
  "gl/resources.js",     // テクスチャの GL ロード・星空宣言・小惑星帯・軌道線
  "gl/post.js",          // Bloom (画面を取り込んで明るいところを滲ませる)
  "core/state.js",       // 実行時状態・月の位置 (ELP-2000)・位置更新
  "core/eclipse.js",     // 食 (日食・月食・衛星の影) の遮蔽体えらび
  "core/events.js",      // 天文イベント (食・満月・衝・最大離角・接近・流星群) の探索
  "render/body.js",      // リサイズ・描画基盤・drawBody・project
  "render/milkyway.js",  // 天の川 (全天マップを天球へ貼る。両ビュー共用)
  "data/sky.js",         // 恒星カタログ・星座線/名・黄道
  "data/showers.js",     // 流星群の放射点・出現数
  "data/dso.js",         // 星雲・星団・銀河 (メシエ天体, OpenNGC 由来)
  "render/dso.js",       // 星雲・星団の描画 (両ビュー共用)
  "render/ground.js",    // 地上ビュー (観測者フレーム・renderGround)
  "ui/view-mode.js",     // ビュー切替・月面観測地点・月の表側マップ
  "render/space.js",     // hitTestGround・render (宇宙ビュー)
  "render/comet.js",     // 彗星のコマ・尾 (両ビュー共用)
  "render/meteor.js",    // 流星 (地上ビュー)
  "render/intro.js",     // 初回の導入 (太陽系のはるか外から寄る)
  "runtime/perf.js",     // 描画負荷の表示 (?perf=1 のときだけ)
  "runtime/frame.js",    // オーバーレイ・時刻表示・メインループ
  "ui/observe.js",       // 選択・観測モード・観測地・天体リスト
  "ui/controls.js",      // 入力・操作パネル・設定保存
  "ui/ar.js",            // AR モード (端末の姿勢センサーで地上ビューのカメラを向ける)
  "ui/menu.js",          // メニュー・共有URL・About
  "ui/panels.js",        // 操作方法・初回ガイド・言語切替・ヒント
  "ui/tour.js",          // ガイドツアーの実行・ナレーションバー・一覧
  "ui/calendar.js",      // 天文カレンダー (イベント一覧とその日時への移動)
  "main.js",             // 起動処理 (必ず最後)
];

// IIFE の外枠はここが出力する。これにより各断片は波括弧が均衡する
const IIFE_HEAD = '(() => {\n  "use strict";\n\n';
const IIFE_TAIL = "})();\n";

const GEN_HEADER =
  "<!-- このファイルは tools/build.mjs による自動生成物です。直接編集しないでください。\n" +
  "     編集は src/ 以下を変更し、node tools/build.mjs を実行してください。 -->\n";

function fail(msg) {
  console.error("build: " + msg);
  process.exit(1);
}

async function readText(abs, rel) {
  let s;
  try {
    s = await readFile(abs, "utf8");
  } catch {
    fail(`${rel} を読めません`);
  }
  if (s.includes("\r")) fail(`${rel}: CRLF が含まれています (改行は LF に統一してください)`);
  return s;
}

// src 以下の実ファイルを再帰列挙 (MANIFEST との突き合わせ用)
async function listFiles(dir, base, out, exts) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) await listFiles(abs, rel, out, exts);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}

// マーカーはちょうど1個であることを要求する
function replaceOnce(text, marker, value, where) {
  const parts = text.split(marker);
  if (parts.length === 1) fail(`${where}: マーカー ${marker} が見つかりません`);
  if (parts.length > 2) fail(`${where}: マーカー ${marker} が ${parts.length - 1} 個あります (1個であるべき)`);
  return parts[0] + value + parts[1];
}

// GLSL をテンプレート文字列へ安全に埋め込む。
// 現在の GLSL には該当文字が無いため、初回のバイト一致には影響しない
function escapeForTemplate(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

async function build({ markers }) {
  // --- MANIFEST と実ファイルの突き合わせ ---
  const actual = (await listFiles(SRC, "", [], [".js"])).sort();
  const listed = [...MANIFEST].sort();
  const missing = listed.filter((f) => !actual.includes(f));
  const extra = actual.filter((f) => !listed.includes(f));
  if (missing.length) fail(`MANIFEST にあるが存在しないファイル: ${missing.join(", ")}`);
  if (extra.length) fail(`存在するが MANIFEST にないファイル: ${extra.join(", ")}`);
  const dup = MANIFEST.filter((f, i) => MANIFEST.indexOf(f) !== i);
  if (dup.length) fail(`MANIFEST に重複: ${dup.join(", ")}`);

  // --- GLSL を読み込む ---
  const glslNames = await listFiles(path.join(SRC, "shaders"), "", [], [".glsl"]);
  const glsl = new Map();
  for (const n of glslNames) {
    const body = await readText(path.join(SRC, "shaders", n), `src/shaders/${n}`);
    glsl.set(n.replace(/\.glsl$/, ""), body);
  }

  // --- JS 断片を連結 ---
  const usedGlsl = new Set();
  let js = "";
  for (const rel of MANIFEST) {
    let body = await readText(path.join(SRC, rel), `src/${rel}`);
    body = body.replace(/@@glsl:([A-Za-z0-9._-]+)@@/g, (_, name) => {
      if (!glsl.has(name)) fail(`src/${rel}: シェーダ ${name}.glsl が見つかりません`);
      usedGlsl.add(name);
      return escapeForTemplate(glsl.get(name));
    });
    js += markers ? `  //#region src/${rel}\n${body}  //#endregion\n` : body;
  }
  const unusedGlsl = [...glsl.keys()].filter((n) => !usedGlsl.has(n));
  if (unusedGlsl.length) fail(`参照されていないシェーダ: ${unusedGlsl.join(", ")}`);

  const script = IIFE_HEAD + js + IIFE_TAIL;
  // HTML のタグ名は ASCII 大小文字を区別しないので、</SCRIPT> なども終了タグになる
  if (/<\/script/i.test(script)) fail("生成した JS に </script> が含まれます (インラインを壊します)");
  // 断片単位ではなく、連結して IIFE に戻したものだけを構文検査する。
  // (gl/setup.js はトップレベル return を含むため単独では構文的に不正)
  try {
    new vm.Script(script, { filename: "index.html (inline script)" });
  } catch (e) {
    fail(`連結した JS が構文エラーです: ${e.message}`);
  }

  // --- CSS ---
  // @@font:名前@@ は src/fonts/名前.woff2 を base64 にして埋める。ロゴの書体は
  // 外部リクエストを増やさないため data: URL で持つ (1KB ほどなので、テクスチャと
  // 違って毎回引き直させても問題にならない)
  let css = await readText(path.join(SRC, "styles.css"), "src/styles.css");
  const fontNames = await listFiles(path.join(SRC, "fonts"), "", [], [".woff2"]);
  const usedFont = new Set();
  for (const m of css.matchAll(/@@font:([A-Za-z0-9._-]+)@@/g)) {
    const name = m[1];
    if (!fontNames.includes(name + ".woff2")) fail(`src/styles.css: フォント ${name}.woff2 が見つかりません`);
    usedFont.add(name + ".woff2");
  }
  for (const n of fontNames) {
    if (!usedFont.has(n)) fail(`参照されていないフォント: ${n}`);
  }
  for (const n of usedFont) {
    const b64 = (await readFile(path.join(SRC, "fonts", n))).toString("base64");
    css = css.split("@@font:" + n.replace(/\.woff2$/, "") + "@@").join(b64);
  }
  if (/<\/style/i.test(css)) fail("CSS に </style> が含まれます (インラインを壊します)");

  // --- ページ骨格へ差し込む ---
  let html = await readText(path.join(SRC, "page.html"), "src/page.html");
  html = replaceOnce(html, "@@include:styles.css@@\n", css, "src/page.html");
  html = replaceOnce(html, "@@script@@\n", script, "src/page.html");
  if (markers) html = GEN_HEADER + html;
  return html;
}

// --- 引数 (未知の引数は黙って無視せずエラーにする。--chek のような打ち間違いで
//     検査のつもりが再生成になる事故を防ぐ) ---
const argv = process.argv.slice(2);
let check = false;
let markers = true;
let outArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--check") check = true;
  else if (a === "--no-markers") markers = false;
  else if (a === "--out") {
    if (outArg !== null) fail("--out が複数指定されています");
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) fail("--out には出力先のパスが必要です");
    outArg = v;
  } else {
    fail(`不明な引数: ${a}\n       使い方: node tools/build.mjs [--check] [--no-markers] [--out <path>]`);
  }
}
const outPath = outArg !== null ? path.resolve(outArg) : path.join(ROOT, "index.html");

const html = await build({ markers });

if (check) {
  let current = "";
  try {
    current = await readFile(outPath, "utf8");
  } catch {
    fail(`${path.relative(ROOT, outPath)} が存在しません`);
  }
  if (current !== html) {
    fail(
      `${path.relative(ROOT, outPath)} が src/ と一致しません。\n` +
      "       node tools/build.mjs を実行して再生成し、コミットしてください。"
    );
  }
  console.log(`build --check: ${path.relative(ROOT, outPath)} は src/ と一致しています`);
} else {
  // 生成途中で既存ファイルを壊さないよう、一時ファイルに書いてから置換する。
  // 名前は一意にし、flag "wx" で排他生成する (並行実行での衝突と、既存の
  // シンボリックリンク経由でリンク先を切り詰めてしまう事故を避ける)
  const tmp = `${outPath}.${process.pid}-${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, html, { encoding: "utf8", flag: "wx" });
    await rename(tmp, outPath);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    fail(`${outPath} への書き込みに失敗: ${e.message}`);
  }
  const bytes = Buffer.byteLength(html, "utf8");
  console.log(`build: ${path.relative(ROOT, outPath)} (${bytes.toLocaleString()} bytes)`);
}
