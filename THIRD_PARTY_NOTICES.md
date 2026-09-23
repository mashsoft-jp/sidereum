# 第三者素材と解説の参考資料

確認日: 2026-09-21。コードのMITライセンスは、以下の第三者素材を再ライセンスするものではありません。確認範囲と未解決事項は [著作権監査記録](COPYRIGHT_AUDIT.md) を参照してください。

## 明示された利用条件

| 対象 | 出典・権利者 | 条件と加工 |
| --- | --- | --- |
| 恒星カタログ | [HYG 4.2 / David Nash, Astronomy Nexus](https://www.astronexus.com/projects/hyg) | CC BY-SA 4.0。[提供元の表示](licenses/HYG-NOTICE.md)。太陽を除く6.5等以下の位置・等級・色指数を選択・量子化。`src/data/star-catalog.js` も同ライセンス。[変換記録](ASSET_RIGHTS.md) |
| 月の周期項数表 | ERFA / NumFOCUS Foundation | Copyright 2013–2023 NumFOCUS Foundation。[全条件](licenses/ERFA.txt)。SOFA由来のERFAから項を抜粋・並べ替え・単位変換。SOFAそのものではなくIAUの承認を意味しない |
| 星座線 | [d3-celestial / Olaf Frohn](https://github.com/ofrohn/d3-celestial) | Copyright 2015 Olaf Frohn。BSD-3-Clause。[原文](licenses/d3-celestial-BSD-3-Clause.txt)。座標ベースで再編集 |
| 星雲・星団・銀河カタログ | [OpenNGC / Mattia Verga](https://github.com/mattiaverga/OpenNGC) | CC BY-SA 4.0。[原文](licenses/OpenNGC-CC-BY-SA-4.0.txt)。位置・等級・視直径・種別を抜粋し配列に再構成、和名を付加。`src/data/dso.js` の該当データは同じ条件で提供 |
| ロゴ書体 | [Megrim / Daniel Johnson](https://fonts.google.com/specimen/Megrim) | © 2009, 2010, 2011 Daniel Johnson。SIL OFL 1.1。[原文](src/fonts/Megrim-OFL.txt)。SIDEREUMに使う文字へサブセット化 |
| M1・M13・M16・M31・M42・M45・M51・M57の写真と解説 | ESA/Hubble、写真ごとの権利者は [個別クレジット](tex/dso/CREDITS.md) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、[提供元の条件](https://esahubble.org/copyright/)。解説は要約・再構成、日本語訳。写真の完全なクレジットは省略しない |
| ベガの写真 | [Chuck Ayoub (Cpayoub)](https://commons.wikimedia.org/wiki/File:Star-Vega.png) | CC0 1.0。[個別記録](tex/stars/CREDITS.md)。縮小・JPEG変換 |

## 事実を確認するための参考資料

追加照合の範囲と修正内容は [文章確認記録](TEXT_REVIEW.md) を参照してください。参考資料へのリンクは、文章の転載・翻訳許諾を示すものではありません。天体の数値・名称・歴史上の出来事と、著者独自の説明文・比喩・構成は区別して扱います。

- 恒星名・由来: [IAU WGSNの恒星名一覧](https://exopla.net/star-names/modern-iau-star-names/)。`src/data/star-info.js` の各項目に参照先があります。
- 一部の恒星の性質: [James B. Kaler / STARS](https://stars.astro.illinois.edu/kaler.html)。同サイトは著作権を留保しています。ここにリンクがあることを転載許諾と解釈しないでください。Sidereumの説明は短い事実説明として確認しましたが、原文の再利用許諾を得たものではありません。
- 天体と探査機の確認資料: [NASA Solar System](https://science.nasa.gov/solar-system/)、[Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/)、[Voyager 2](https://science.nasa.gov/mission/voyager/voyager-2/)、[Cassini](https://science.nasa.gov/mission/cassini/)、[月食](https://science.nasa.gov/moon/eclipses/)。これは今回の確認に使った資料であり、既存の全文章の執筆元を特定した一覧ではありません。

## 既存の表面画像・モデル

[READMEの画像一覧](README.md#画像クレジット)とアプリのクレジットに提供元・既知の加工内容を記載しています。[NASAの画像利用条件](https://www.nasa.gov/nasa-brand-center/images-and-media/)は第三者の権利が残る素材を区別しています。NASA・USGS・共同研究機関という名前だけで、一律に米国政府著作物／パブリックドメインとは扱いません。

2026-09-21に19製品（2解像度、38ファイル）とNASA提供の2モデルについて、導入履歴・製品ページ・利用条件を対応付けました。[個別確認記録](ASSET_RIGHTS.md)を参照してください。ホイヘンスはアプリ独自の概形モデルです。配布元の許諾を根拠とし、共同制作物を一律にパブリックドメインとは扱いません。提供元の承認・推奨は意味しません。

## Surface feature labels

Names and central coordinates are individual facts from the USGS/IAU [Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/), checked 2026-09-23. No descriptive text or map imagery is reproduced. Japanese labels and approximate texture-map placement were added for Sidereum.

Records: [Tycho](https://planetarynames.wr.usgs.gov/Feature/6163), [Mare Tranquillitatis](https://planetarynames.wr.usgs.gov/Feature/3691), [Olympus Mons](https://planetarynames.wr.usgs.gov/Feature/4453), [Valles Marineris](https://planetarynames.wr.usgs.gov/Feature/6288), [Caloris Planitia](https://planetarynames.wr.usgs.gov/Feature/979), [Sputnik Planitia](https://planetarynames.wr.usgs.gov/Feature/15669), [Occator](https://planetarynames.wr.usgs.gov/Feature/15341).

Caloris: 198.02 degrees west converted to 161.98 degrees east. Texture longitude origins: -180 degrees for Moon/Mars; 0 degrees for Mercury/Pluto/Ceres. Existing image terms are recorded above.
