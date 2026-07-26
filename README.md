# Cosmoseum

**Cosmoseum**(コスモセウム)は、ブラウザだけで動く単一 HTML ファイルの「バーチャル宇宙博物館」— 天体運行 3D シミュレータです。
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

## 精度について(免責)

教育・可視化を目的とした近似シミュレーションです。天文計算・観測用途の精度はありません。

- 惑星位置は J2000 平均軌道要素による二体問題のケプラー軌道です(惑星間摂動は無視)
- 小惑星(ケレス/ベスタ/パラス/ジュノー)の軌道上の位相(初期平均黄経)は概略です
- 月の軌道は簡略化した円軌道(傾斜約5.2°)です
- 恒星 (宇宙ビューの背景・地上ビューとも) はヨール輝星星表 (視等級5.0以下・約1,600星) の実位置ですが、色味は擬似的な着色です

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

## ライセンス

© 2026 [Mashsoft Inc.](https://www.mashsoft.co.jp)

コードは [MIT License](LICENSE) です。埋め込みの天体画像はパブリックドメイン(米国政府著作物)であり、MIT ライセンスの対象外です。
