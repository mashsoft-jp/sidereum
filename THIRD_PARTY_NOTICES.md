# 第三者素材と解説の参考資料

確認日: 2026-09-21。コードのMITライセンスは、以下の第三者素材を再ライセンスするものではありません。確認範囲と未解決事項は [著作権監査記録](COPYRIGHT_AUDIT.md) を参照してください。

## 明示された利用条件

| 対象 | 出典・権利者 | 条件と加工 |
| --- | --- | --- |
| 星座線 | [d3-celestial / Olaf Frohn](https://github.com/ofrohn/d3-celestial) | Copyright 2015 Olaf Frohn。BSD-3-Clause。[原文](licenses/d3-celestial-BSD-3-Clause.txt)。座標ベースで再編集 |
| 星雲・星団・銀河カタログ | [OpenNGC / Mattia Verga](https://github.com/mattiaverga/OpenNGC) | CC BY-SA 4.0。[原文](licenses/OpenNGC-CC-BY-SA-4.0.txt)。位置・等級・視直径・種別を抜粋し配列に再構成、和名を付加。`src/data/dso.js` の該当データは同じ条件で提供 |
| ロゴ書体 | [Megrim / Daniel Johnson](https://fonts.google.com/specimen/Megrim) | © 2009, 2010, 2011 Daniel Johnson。SIL OFL 1.1。[原文](src/fonts/Megrim-OFL.txt)。SIDEREUMに使う文字へサブセット化 |
| M1・M13・M16・M31・M42・M45・M51・M57の写真と解説 | ESA/Hubble、写真ごとの権利者は [個別クレジット](tex/dso/CREDITS.md) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、[提供元の条件](https://esahubble.org/copyright/)。解説は要約・再構成、日本語訳。写真の完全なクレジットは省略しない |
| ベガの写真 | [Chuck Ayoub (Cpayoub)](https://commons.wikimedia.org/wiki/File:Star-Vega.png) | CC0 1.0。[個別記録](tex/stars/CREDITS.md)。縮小・JPEG変換 |

## 事実を確認するための参考資料

参考資料へのリンクは、文章の転載・翻訳許諾を示すものではありません。天体の数値・名称・歴史上の出来事と、著者独自の説明文・比喩・構成は区別して扱います。

- 恒星名・由来: [IAU WGSNの恒星名一覧](https://exopla.net/star-names/modern-iau-star-names/)。`src/data/star-info.js` の各項目に参照先があります。
- 一部の恒星の性質: [James B. Kaler / STARS](https://stars.astro.illinois.edu/kaler.html)。同サイトは著作権を留保しています。ここにリンクがあることを転載許諾と解釈しないでください。Sidereumの説明は短い事実説明として確認しましたが、原文の再利用許諾を得たものではありません。
- 天体と探査機の確認資料: [NASA Solar System](https://science.nasa.gov/solar-system/)、[Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/)、[Voyager 2](https://science.nasa.gov/mission/voyager/voyager-2/)、[Cassini](https://science.nasa.gov/mission/cassini/)、[月食](https://science.nasa.gov/moon/eclipses/)。これは今回の確認に使った資料であり、既存の全文章の執筆元を特定した一覧ではありません。
- 恒星の位置・等級: Yale Bright Star Catalogue, 5th Revised Edition, Hoffleit & Warren (1991), [CDS V/50](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/V/50?format=html&tex=true)、[NASA HEASARCの説明](https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html)。カタログ全体の明示的な再配布条件・パブリックドメイン宣言は今回確認できていません。

## 既存の表面画像・モデル

[READMEの画像一覧](README.md#画像クレジット)とアプリのクレジットに提供元・既知の加工内容を記載しています。[NASAの画像利用条件](https://www.nasa.gov/nasa-brand-center/images-and-media/)は第三者の権利が残る素材を区別しています。NASA・USGS・共同研究機関という名前だけで、一律に米国政府著作物／パブリックドメインとは扱いません。

今回、既存の全球マップ・標高データ・探査機モデルすべてについて、取得ファイルと個別の権利表示を照合するところまでは完了していません。未確認の範囲は監査記録に記載しています。提供元の承認・推奨は意味しません。
