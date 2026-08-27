// Sidereum の Service Worker — 一度取った画像を二度取らせないためのもの。
//
// tex/ の全球マップは 2K 一組で約 7MB、4K に切り替えると約 30MB ある。
// 開くたびに引き直すのは重いし、HTTP キャッシュは端末の都合で先に捨てられる
// (特に iOS)。Cache API に自分で控えておけば、そこは自分たちで決められる。
//
//   tex/ ・アイコン        キャッシュ優先。あればネットワークへ出ない
//   それ以外 (index.html・manifest)
//                          ネットワーク優先。取れたら控えを更新し、
//                          オフラインのときだけ控えを使う
//
// index.html をキャッシュ優先にしてはいけない。配信した修正が届かなくなる。
// 実機の確認はハンバーガーメニュー末尾の build 時刻でやっているので、そこが
// 古いまま止まると「直したのに直っていない」の区別がつかなくなる。
// なお fetch() は HTTP キャッシュを通るので、毎回まるごと落ちてくるわけでは
// ない (GitHub Pages の max-age=600 の間は無通信、その後は 304 の往復だけ)。
//
// ★ tex/ の画像を差し替えたら TEX_VER を上げること。ファイル名は固定なので、
//   上げないとキャッシュを持っている人には新しい画像が永久に届かない。
//   上げると古い組を丸ごと捨てるので、差し替えた1枚だけでなく全部を引き直す
//   ことになる (画像の差し替えは滅多に無いので、この単純さを採る)。

const TEX_VER = 1;
const TEX_CACHE = "sidereum-tex-" + TEX_VER;
const SHELL_CACHE = "sidereum-shell";

// キャッシュ優先で扱うもの。中身が変わるときはファイル名か TEX_VER が変わる
const isAsset = (path) => path.indexOf("/tex/") >= 0 || /\/icon-\d+\.png$/.test(path);
// キャッシュの鍵。?v=3 のような確認用のクエリで別物にしない
const bare = (u) => { const x = new URL(u); x.search = ""; x.hash = ""; return x.href; };

self.addEventListener("install", () => {
  // ここでは何も先読みしない。初回に 7〜30MB を先払いさせるより、ページが
  // 読み終わってから「いま使ったぶん」を控える方が無駄が無い (message の keep)
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      for (const k of await caches.keys()) {
        if (k.indexOf("sidereum-tex-") === 0 && k !== TEX_CACHE) await caches.delete(k);
      }
    } catch (err) { /* ストレージが使えない。掃除できないだけ */ }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // 他所のものには触らない
  e.respondWith(isAsset(url.pathname) ? cacheFirst(req) : networkFirst(req));
});

// キャッシュが使えない場合 (プライベートモード・ストレージ拒否) は null。
// respondWith した約束が壊れると、ネットワークは無事でもその要求が失敗する。
// 控えられないことと、読めないことを混ぜてはいけない
async function openCache(name) {
  try { return await caches.open(name); } catch (err) { return null; }
}
// 控えの書き込みは表示に影響しないので、失敗しても黙って続ける (容量切れなど)
async function keepIn(c, key, res) {
  if (!c || !res.ok) return;                   // 404・5xx は控えない
  try { await c.put(key, res.clone()); } catch (err) { /* 容量切れ等 */ }
}

async function cacheFirst(req) {
  const c = await openCache(TEX_CACHE);
  if (c) {
    const hit = await c.match(req).catch(() => null);
    if (hit) return hit;
  }
  const res = await fetch(req);
  await keepIn(c, req, res);
  return res;
}

async function networkFirst(req) {
  const c = await openCache(SHELL_CACHE);
  try {
    const res = await fetch(req);
    await keepIn(c, bare(req.url), res);
    return res;
  } catch (err) {
    // オフライン。クエリを外した控え → 入口 (index.html と /) の順に探す
    if (c) {
      const hit = await c.match(bare(req.url)) ||
                  await c.match(new URL("./index.html", location).href) ||
                  await c.match(new URL("./", location).href);
      if (hit) return hit;
    }
    throw err;
  }
}

// ページから「この画像を控えておいて」と渡される。一覧を sw.js にも書くと
// 二重管理になるので、URL はアプリ側 (data/textures.js) から受け取る。
// 送られてくるのはページが読み終わったあとなので、force-cache で HTTP
// キャッシュから拾える — 同じものをもう一度ネットワークから落とさない
self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.type !== "keep" || !Array.isArray(d.urls)) return;
  e.waitUntil(keep(d.urls));
});

async function keep(urls) {
  const c = await openCache(TEX_CACHE);
  if (!c) return;
  for (const u of urls) {
    if (await c.match(u).catch(() => null)) continue;
    try {
      const res = await fetch(u, { cache: "force-cache" });
      await keepIn(c, u, res);
    } catch (err) { /* オフライン等。次に開いたときに拾い直す */ }
  }
}
