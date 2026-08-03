# Sidereum — 作業上の約束

配信物は依存ライブラリなしの `index.html` 1枚と、天体テクスチャ `tex/*.jpg`。バックエンドは導入せず「いけるところまで」進める方針。

テクスチャを HTML に埋め込まないのは、コードを1行直すたびに全員に画像ぜんぶを引き直させないため。代わりに `file://` では動かない (不透明オリジンのため `texImage2D` が SecurityError で弾かれ、天体が仮色になる) — HTTP で配信する前提。

## index.html は生成物

直接編集しない。`src/` を編集してビルドし直す。

```
node tools/build.mjs           # src/ → index.html
node tools/build.mjs --check   # index.html が src/ と一致するか検証 (CI でも実行)
```

生成物 `index.html` もリポジトリに含めるので、**コミットには `src/` の変更と `index.html` の両方を入れる**。`--check` が通らない状態で push しない。

## `src/**/*.js` はモジュールではない

同一スコープを共有するソース断片で、連結順そのものが意味を持つ (順序は `tools/build.mjs` の `MANIFEST` で固定)。並べ替えると壊れる。

個々の断片に構文チェック・型チェックをかけない。`src/gl/setup.js` は WebGL 初期化失敗時の早期脱出にトップレベル `return` を使っており、単独では構文的に不正。構文検査はビルドが連結後に行う。詳しくは README の「注意: これはモジュール分割ではありません」。

## 動作確認

```
python3 -m http.server 8934
```

`http://localhost:8934/index.html?v=N` を開く (`v` はキャッシュ回避用の任意の値)。描画に触れた変更は宇宙・地上・月面の3ビューを見る。再現用の URL 例:

```
?d=1910-05-20T06:00&sel=halley&play=0     # ハレー彗星のコマ・尾
```

実機 (GitHub Pages) は `max-age=600` でキャッシュされる。**ハンバーガーメニュー末尾の `build YYYY/MM/DD HH:MM` が最新ビルドか確認してから**、直った・直っていないを判断する。

## 描画コードを触るとき

WebGL の状態 (uniform・blend・depth・cull) はグローバルなので、経路ごとに暗黙で引き継がせない。設定漏れがあると直前の描画の値がそのまま残る (実際に `uComet` の設定漏れで、地上ビューの全天体が彗星核として描かれうる状態になっていた)。

天体の描画は `bodyRenderer.beginPass / draw / endPass` を通す。`draw()` は呼ばれるたびに天体単位の uniform を**すべて**設定する — 条件分岐で省かない。

### 色はリニアで計算する

`src/gl/setup.js` の `PRE` に `srgbToLinear` / `linearToSrgb` / `acesToneMap` / `tonemap` がある。照明を計算するシェーダは次の順で書く。

```
sRGB のテクスチャ・定数 → リニア → 照明・大気・発光を加算 → tonemap() → gl_FragColor
```

- **アルベド** (テクスチャ、天体の色) は `srgbToLinear`。天体の `colA/colB/colC/rim` は `bodies.js` で変換済みの `colAL/colBL/colCL/rimL` を渡す (画素ごとに `pow` を回さないため)。シェーダ内の即値も、リニア値を直に書いてコメントに元の sRGB を残す
- **見た目を決め打ちした色** (空の色、霞、地球照) は「`tonemap` を通すと狙った画面色になる」逆算値を書く。EXPOSURE を変えたら計算し直す
- **透過率・光学的厚さ・マスク**はもともとリニアなので変換しない (環プロファイルの `.a` など)
- 加算合成だけの発光パス (`point` / `bill` / `coma` / `tail` / `line`) は画面色を直に書いており、トーンマップを通していない

## その他

- コミットメッセージは日本語。何をなぜ変えたかを本文に書く
- `docs/` は未追跡のまま (コミットしない)
