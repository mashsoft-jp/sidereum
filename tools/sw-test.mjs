// sw.js の振る舞いを Node 上で確かめる (ブラウザの Cache API / fetch を模した最小の器)。
// 検証したいのは経路の切り分けとキャッシュの出し入れで、登録や claim は標準の作法どおり。
//
//   node tools/sw-test.mjs
//
// 依存パッケージなし (Node 標準のみ)。ブラウザのペインでは Service Worker を
// 登録できないため、経路の切り分けだけはここで押さえる。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert";

const SW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "sw.js");

const ORIGIN = "https://sidereum.mashsoft.co.jp";

function makeRes(body, ok = true) {
  const r = { ok, body, clone: () => makeRes(body, ok) };
  return r;
}

class FakeCache {
  constructor() { this.m = new Map(); }
  static key(k) { return typeof k === "string" ? k : k.url; }
  async match(k) { return this.m.get(FakeCache.key(k)); }
  async put(k, v) { this.m.set(FakeCache.key(k), v); }
  async keys() { return [...this.m.keys()]; }
}

class FakeCaches {
  constructor() { this.c = new Map(); }
  async open(n) { if (!this.c.has(n)) this.c.set(n, new FakeCache()); return this.c.get(n); }
  async keys() { return [...this.c.keys()]; }
  async delete(n) { return this.c.delete(n); }
}

function load({ offline = false } = {}) {
  const handlers = {};
  const fetchLog = [];
  const caches = new FakeCaches();
  const ctx = {
    caches,
    location: new URL(ORIGIN + "/"),
    URL, Request: class {}, console,
    fetch: async (u, opt) => {
      const url = typeof u === "string" ? u : u.url;
      fetchLog.push({ url, cache: opt && opt.cache });
      if (offline) throw new Error("offline");
      if (url.endsWith("/missing.jpg")) return makeRes("404", false);
      return makeRes("BODY " + url);
    },
  };
  ctx.self = ctx;
  ctx.addEventListener = (t, f) => { handlers[t] = f; };
  ctx.skipWaiting = async () => {};
  ctx.clients = { claim: async () => {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(SW, "utf8"), ctx, { filename: "sw.js" });

  const waits = [];
  const fire = async (type, extra = {}) => {
    let responded = null;
    const e = {
      ...extra,
      respondWith: (p) => { responded = p; },
      waitUntil: (p) => { waits.push(p); },
    };
    handlers[type](e);
    await Promise.all(waits.splice(0));
    return responded ? await responded : null;
  };
  const req = (path, method = "GET") => ({ url: ORIGIN + path, method });
  return { fire, req, fetchLog, caches, ctx };
}

const results = [];
const t = async (name, fn) => {
  try { await fn(); results.push("  ok   " + name); }
  catch (e) { results.push("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
};

await t("画像は初回だけ取りに行き、2回目はキャッシュから返す", async () => {
  const { fire, req, fetchLog, caches } = load();
  await fire("install"); await fire("activate");
  const a = await fire("fetch", { request: req("/tex/earth.jpg") });
  assert.equal(a.body, "BODY " + ORIGIN + "/tex/earth.jpg");
  assert.equal(fetchLog.length, 1);
  const b = await fire("fetch", { request: req("/tex/earth.jpg") });
  assert.equal(b.body, "BODY " + ORIGIN + "/tex/earth.jpg");
  assert.equal(fetchLog.length, 1, "2回目にネットワークへ出た");
  const names = await caches.keys();
  assert.deepEqual(names, ["sidereum-tex-1"]);
});

await t("4K も同じ扱い (別 URL なので別に貯まる)", async () => {
  const { fire, req, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("fetch", { request: req("/tex/4k/earth.jpg") });
  await fire("fetch", { request: req("/tex/4k/earth.jpg") });
  assert.equal(fetchLog.length, 1);
});

await t("アイコンもキャッシュ優先", async () => {
  const { fire, req, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("fetch", { request: req("/icon-192.png") });
  await fire("fetch", { request: req("/icon-192.png") });
  assert.equal(fetchLog.length, 1);
});

await t("取れなかった画像は残さない (次に開いたら取り直す)", async () => {
  const { fire, req, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("fetch", { request: req("/tex/missing.jpg") });
  await fire("fetch", { request: req("/tex/missing.jpg") });
  assert.equal(fetchLog.length, 2);
});

await t("index.html は毎回ネットワークへ出る (古い版を配らない)", async () => {
  const { fire, req, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("fetch", { request: req("/index.html") });
  await fire("fetch", { request: req("/index.html") });
  assert.equal(fetchLog.length, 2, "2回目がキャッシュから返った");
});

await t("オフラインでは控えを返す。?v= 付きでも同じ控えに当たる", async () => {
  const on = load();
  await on.fire("install"); await on.fire("activate");
  await on.fire("fetch", { request: on.req("/index.html") });
  // 同じキャッシュのまま offline の器へ差し替える
  const off = load({ offline: true });
  off.ctx.caches.c = on.caches.c;
  const r = await off.fire("fetch", { request: off.req("/index.html?v=9") });
  assert.equal(r.body, "BODY " + ORIGIN + "/index.html");
});

await t("POST と他所のオリジンには触らない", async () => {
  const { fire, req } = load();
  await fire("install"); await fire("activate");
  assert.equal(await fire("fetch", { request: req("/tex/earth.jpg", "POST") }), null);
  assert.equal(await fire("fetch", { request: { url: "https://example.com/x.jpg", method: "GET" } }), null);
});

await t("keep: 未取得ぶんだけ HTTP キャッシュ優先で控える", async () => {
  const { fire, req, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("fetch", { request: req("/tex/earth.jpg") });     // 1件は取得済み
  fetchLog.length = 0;
  await fire("message", { data: { type: "keep", urls: [
    ORIGIN + "/tex/earth.jpg", ORIGIN + "/tex/moon.jpg", ORIGIN + "/tex/mars.jpg"] } });
  assert.deepEqual(fetchLog.map((f) => f.url),
    [ORIGIN + "/tex/moon.jpg", ORIGIN + "/tex/mars.jpg"], "取得済みを取り直した");
  assert.ok(fetchLog.every((f) => f.cache === "force-cache"), "force-cache が付いていない");
  // 控えたぶんは以後ネットワークへ出ない
  fetchLog.length = 0;
  await fire("fetch", { request: req("/tex/moon.jpg") });
  assert.equal(fetchLog.length, 0);
});

await t("keep: 妙な中身は無視する", async () => {
  const { fire, fetchLog } = load();
  await fire("install"); await fire("activate");
  await fire("message", { data: null });
  await fire("message", { data: { type: "keep" } });
  await fire("message", { data: { type: "other", urls: ["x"] } });
  assert.equal(fetchLog.length, 0);
});

await t("TEX_VER を上げると古い組だけ捨てる (shell は残す)", async () => {
  const { fire, req, caches } = load();
  await caches.open("sidereum-tex-0");      // 前の版
  await caches.open("sidereum-shell");
  await fire("install"); await fire("activate");
  // 新しい組は使うまで作られないので、消えたことと残ったことだけ見る
  assert.deepEqual((await caches.keys()).sort(), ["sidereum-shell"]);
  await fire("fetch", { request: req("/tex/earth.jpg") });
  assert.deepEqual((await caches.keys()).sort(), ["sidereum-shell", "sidereum-tex-1"]);
});

await t("キャッシュが使えない環境でも、素通しで表示できる", async () => {
  const { fire, req, fetchLog, ctx } = load();
  await fire("install"); await fire("activate");
  ctx.caches.open = async () => { throw new Error("storage disabled"); };
  const a = await fire("fetch", { request: req("/tex/earth.jpg") });
  assert.equal(a.body, "BODY " + ORIGIN + "/tex/earth.jpg", "画像が返らなかった");
  const b = await fire("fetch", { request: req("/index.html") });
  assert.equal(b.body, "BODY " + ORIGIN + "/index.html", "index.html が返らなかった");
  assert.equal(fetchLog.length, 2);
});

await t("控えの書き込みに失敗しても、取れたものはそのまま返す (容量切れ)", async () => {
  const { fire, req, caches } = load();
  await fire("install"); await fire("activate");
  const c = await caches.open("sidereum-tex-1");
  c.put = async () => { throw new Error("QuotaExceededError"); };
  const r = await fire("fetch", { request: req("/tex/earth.jpg") });
  assert.equal(r.body, "BODY " + ORIGIN + "/tex/earth.jpg");
});

console.log(results.join("\n"));
console.log(process.exitCode ? "\n失敗あり" : "\nすべて通過");
