# Sidereum

> 見上げる空から、太陽系の果てまで

**Sidereum**(シデレウム)は、ブラウザだけで動く単一 HTML ファイルの **Webプラネタリウム** — 天体運行 3D シミュレータです。実際の星空・月の満ち欠けを再現する地上ビュー、実寸比の太陽系を自由に探索できる宇宙ビュー、そして月面に立って空(天頂近くの地球など)を見上げる月面ビューを備えます。
現在は太陽系を対象に、J2000 ケプラー軌道要素にもとづいて太陽・8惑星・月・冥王星・主要小惑星(ケレス/ベスタ/パラス/ジュノー)の位置を計算し、軌道間隔・天体サイズとも**実寸比**で表示します。将来的には太陽系以外の惑星系への対応も予定しています。

## 特徴

- 依存ライブラリなし・ビルド不要。`index.html` を開くだけで動作(WebGL 使用)
- ケプラー軌道(J2000 軌道要素、ニュートン法による離心近点角の求解)による天体位置計算
- 軌道間隔・天体の大きさとも実寸比で表示(カメラ相対レンダリングによる float32 精度対策済み)
- NASA/USGS の探査機実写全球マップをテクスチャとして使用(下記クレジット参照)
- 日時の指定(1900〜2199年)、現在時刻への同期、再生速度 1秒=1秒 〜 約240年
- 火星〜木星間の小惑星帯、月の軌道、自転軸の表示
- タッチ操作対応(モバイルレイアウトあり)

## 使い方

`index.html` をブラウザで開くだけです。

- **ドラッグ**: 視点回転 / **ホイール・ピンチ**: ズーム / **天体クリック**: 選択・接近
- 左のボタンで天体を選択(再クリックで解除)
- 右上の日付をクリックすると任意の日付へジャンプ、「現在時刻に合わせる」で実時刻に同期
- 下部バーで再生/停止、速度調整(−/＋ボタンまたはスライダー)、軌道・名前の表示切り替え

## 開発

**`index.html` は生成物です。直接編集しないでください。** 編集は `src/` 以下を変更し、再生成します。

```
node tools/build.mjs           # src/ から index.html を生成
node tools/build.mjs --check   # index.html が src/ と一致するか検証 (CI でも実行)
```

ビルドは Node 標準機能だけで動きます(依存パッケージ・バンドラなし)。圧縮も難読化もしないため、生成物はソースをそのまま連結したものです。

```
src/page.html      HTML骨格          src/styles.css   CSS
src/data/          天体・言語・テクスチャ・恒星カタログ・星座線
src/core/          数学・軌道計算・状態
src/gl/            WebGL初期化・リソース生成
src/shaders/*.glsl シェーダ16本
src/render/        天体・地上・宇宙・彗星の描画
src/runtime/       メインループ      src/ui/          UI各種
src/main.js        起動処理
tools/build.mjs    ビルド
```

### 注意: これはモジュール分割ではありません

`src/**/*.js` は独立したモジュールではなく、**同一スコープを共有するソース断片**です。

- 連結順そのものが意味を持ちます。順序は `tools/build.mjs` の `MANIFEST` で固定されており、**並べ替えると壊れます**(関数宣言のホイスティングに依存した前方参照と、即時実行文の TDZ 依存があるため)
- 断片を単独の JS ファイルとして扱わないでください。すべて同一スコープ前提で書かれており、`src/gl/setup.js` は WebGL 初期化失敗時の早期脱出にトップレベル `return` を使っているため**単独では構文的に不正**です。構文チェックは連結後に対して行います(`tools/build.mjs` がビルドのたびに実施)

## 精度について(免責)

教育・可視化を目的とした近似シミュレーションです。天文計算・観測用途の精度はありません。

- 惑星位置は J2000 平均軌道要素による二体問題のケプラー軌道です(惑星間摂動は無視)
- 小惑星(ケレス/ベスタ/パラス/ジュノー)の軌道上の位相(初期平均黄経)は概略です
- 月の位置は ELP-2000 の主要周期項による短縮理論(Meeus 由来、黄経誤差 約0.01°・位相時刻 約数分)+ 測心視差補正で計算しています。楕円軌道・出没・満ち欠け・距離変化(約36〜41万km)を再現しますが、暦計算用途の精度はありません
- 恒星 (宇宙ビューの背景・地上ビューとも) はヨール輝星星表 (視等級6.5以下・約8,400星 ≒ 肉眼で見える全ての星) の実位置・実等級です。色は B-V 色指数にもとづく近似です

## 画像クレジット

天体表面のテクスチャには、以下のパブリックドメイン画像(米国政府著作物)を使用しています。

| 天体 | 元データ | クレジット |
|---|---|---|
| 水星 | MESSENGER MDIS 全球モザイク | NASA/Johns Hopkins University APL/Carnegie Institution of Washington |
| 金星 | Magellan レーダー全球図 (地表) | NASA/JPL |
| 地球 | Blue Marble: Land Surface, Ocean Color and Sea Ice | NASA Earth Observatory (Reto Stöckli, NASA/GSFC) |
| 月 | LRO LROC WAC 全球モザイク (CGI Moon Kit) | NASA/GSFC/Arizona State University, NASA Scientific Visualization Studio |
| 火星 | Viking MDIM 2.1 カラーモザイク | NASA/USGS |
| 木星 | Cassini 円筒図法マップ (PIA07782) | NASA/JPL/Space Science Institute |
| 冥王星 | New Horizons 全球モザイク | NASA/JHUAPL/SwRI |
| ケレス | Dawn 全球マップ (PIA19625) | NASA/JPL-Caltech/UCLA/MPS/DLR/IDA |
| ベスタ | Dawn 全球モザイク | NASA/JPL-Caltech/UCLA/MPS/DLR/IDA |

画像は USGS Astrogeology、JPL Photojournal、NASA SVS、および Wikimedia Commons 経由で取得し、縮小・JPEG 再圧縮のうえ data URI として HTML に埋め込んでいます。

太陽・土星・天王星・海王星・パラス・ジュノーは、実測の全球マップが存在しない(または動的表現の方が適する)ため、シェーダによるプロシージャル生成です。実写ではありません。土星の環も同様です。

本プロジェクトは NASA・USGS とは無関係であり、両機関による承認・推奨を意味するものではありません。

## データ出典

- 惑星の軌道要素・物理諸元: NASA JPL Solar System Dynamics / NASA Planetary Fact Sheet の公表値にもとづく J2000 平均軌道要素
- 小惑星・冥王星の軌道要素: JPL Small-Body Database の公表値(位相は概略)
- 恒星: Yale Bright Star Catalogue, 5th Revised Edition (Hoffleit & Warren 1991、CDS V/50)。事実データの編纂物でありパブリックドメインとして扱われる
- 月の理論: ELP-2000 の主要周期項 (J. Meeus, "Astronomical Algorithms" 2nd ed., Ch.47 の短縮版)
- 星座線: [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn, BSD-2-Clause) の constellations.lines を座標ベースで再編集
- 月面ビュー: 潮汐ロック近似 (表側が地球を向く・月の極 ≈ 黄道北)。物理秤動・月の極の傾斜 (1.5°) は省略

## ライセンス

© 2026 [Mashsoft Inc.](https://www.mashsoft.co.jp)

コードは [MIT License](LICENSE) です。埋め込みの天体画像はパブリックドメイン(米国政府著作物)であり、MIT ライセンスの対象外です。
