# 既存画像・モデル・数値データの利用記録

確認日: 2026-09-21。Sidereumによる加工・表示であり、各提供機関による承認・推奨を示すものではありません。

## 判断の根拠と範囲

以下は素材ごとの配布元・公開利用条件と、導入時のGit記録を対応付けた記録です。NASA等の名称だけから一律にパブリックドメインとはしていません。米国内のPDという法的地位と、公開サイトの再利用許諾は区別しています。

- [NASA Images and Media](https://www.nasa.gov/nasa-brand-center/images-and-media/): 情報・教育用途のWebやシミュレーションでの利用方針。出典を表示し、第三者の権利表示・ロゴ・推薦と誤認させる利用は別扱い。
- [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy/): 個別の権利留保がない画像についての再利用方針。キャプションの機関名を表示。
- [SVS利用条件](https://svs.gsfc.nasa.gov/help/): 別記のないコンテンツを公開利用・再配布可能とする方針。下記該当製品のクレジットを保持。
- [USGS制作物の利用](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted): USGS自身の制作物の方針。共同制作物は各製品のAccess/Use Constraintsも確認。「Please cite authors」は下表の作者を表示。
- [NASA Earthdata データ利用方針](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy): NASA主導ミッションの公開データの利用方針。MOLA標高データの根拠。外部の画像を一律にCC0へ再ライセンスするものではない。

古い加工済み画像にはダウンロード原本のハッシュが保存されていません。対応付けは導入記録の製品名・解像度・加工手順と現在の配布ページに基づきます。全ピクセルの原本照合や権利者間の契約の検証を行ったという意味ではありません。現在の38ファイルのSHA-256は [asset-manifest.json](licenses/asset-manifest.json) に固定し、以後の差し替えを識別します。

## 全球画像・法線図（各2K/4K）

ファイル名は `tex/<名前>.jpg` と `tex/4k/<名前>.jpg` です。

| 名前 | 配布製品 | クレジット | 利用の根拠 | Sidereumの加工 |
| --- | --- | --- | --- | --- |
| mercury | [MESSENGER MDIS MD3Color](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m) | Applied Coherent Technology Corporation; NASA/JHUAPL/ASU/Carnegie | USGS掲載製品: Access None / Use Please cite authors | 縮小、JPEG化 |
| venus | [Magellan C3 synthetic color 4641m](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m) | USGS / NASA/JPL | 製品明記: Public domain / Use None | 縮小、JPEG化 |
| earth | [Blue Marble 57752](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_8192.tif) | NASA Earth Observatory; Reto Stöckli (NASA/GSFC), Robert Simmon | NASA画像利用方針 | 縮小、JPEG化 |
| earth-clouds | [Blue Marble clouds 57747](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif) | NASA Earth Observatory | NASA画像利用方針 | 雲マスク、縮小、JPEG化 |
| earth-night | [Black Marble 2016 VIIRS DNB 144898](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km_geo.tif) | NASA Earth Observatory | NASA画像利用方針 | グレースケール化、黒レベル20%除去、縮小、JPEG化 |
| moon | [LROC WAC CGI Moon Kit (2025)](https://svs.gsfc.nasa.gov/4720/) | NASA/GSFC/Arizona State University; NASA Scientific Visualization Studio | SVS公開利用方針 | 縮小、JPEG化 |
| mars | [Viking MDIM 2.1 color mosaic](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) | USGS / NASA Ames | 製品明記: Public domain / Use None | 1km版を縮小、JPEG化 |
| jupiter | [Cassini PIA07782](https://science.nasa.gov/resource/cassinis-best-maps-of-jupiter-cylindrical-map-2/) | NASA/JPL/Space Science Institute | JPL画像利用方針・NASA画像利用方針 | 縮小/拡大、JPEG化 |
| io | [Galileo SSI/Voyager merged 1km](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km) | USGS / NASA/JPL | 製品明記: Public domain / Use None | 縮小、JPEG化 |
| europa | [Voyager/Galileo SSI 500m](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m) | USGS (Tammy Becker; Archinal, Colvin, Davies, Gitlin, Kirk, Weller); NASA/JPL | USGS制作物方針; 製品 Access None / Use None | グレースケール図に着色、縮小、JPEG化 |
| ganymede | [Voyager/Galileo SSI color 1.4km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km) | USGS / NASA/JPL | 製品明記: Public domain / Use None | 縮小、JPEG化 |
| callisto | [Galileo/Voyager 1km](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km) | USGS / NASA/JPL | 製品明記: Public domain / Use None | グレースケール図に着色、縮小、JPEG化 |
| pluto | [New Horizons PIA11707 color map (5926×2963)](https://science.nasa.gov/photojournal/pluto-color-map/) | NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute | JPL画像利用方針・NASA画像利用方針 | 縮小、JPEG化 |
| ceres | [Dawn FC 20ppd Oct2015 400m](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_400m) | NASA/JPL-Caltech/UCLA/MPS/DLR/IDA | USGS掲載製品: Access None / Use Please cite authors | 縮小、JPEG化 |
| vesta | [Dawn FC HAMO 74ppd 60m](https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_mosaic_60m) | NASA/JPL-Caltech/UCLA/MPS/DLR/IDA | USGS掲載製品: Access None / Use Please cite authors | 縮小、JPEG化 |
| moon-nrm | [LOLA LDEM 16ppd CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) | NASA/GSFC; NASA Scientific Visualization Studio | SVS公開利用方針 | 標高から傾きを計算し法線図化、解像度別gain、JPEG化 |
| mars-nrm | [MGS MOLA MEGDR 16ppd](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) | NASA/GSFC MGS MOLA Science Team | NASA主導ミッション公開データ利用方針 | 標高から傾きを計算し法線図化、解像度別gain、JPEG化 |
| mercury-nrm | [MESSENGER global DEM v2 665m](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m) | USGS / Kris Becker; NASA/ASU/JHUAPL/Carnegie | USGS制作物方針; 製品 Access None / Use Please cite authors | 標高から傾きを計算し法線図化、解像度別gain、JPEG化 |
| milkyway | [Deep Star Maps 2020 diffuse layer](https://svs.gsfc.nasa.gov/4851/) | NASA/Goddard Space Flight Center Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC | SVS公開利用方針 | milkyway_2020_4k.exrのみ。平滑化、黒レベル除去、sRGB化、JPEG化。星・星座図形レイヤーは不使用 |

主な来歴: `724c233`（2K表面画像）、`46593ce`（4Kと旧画像との比較）、`87c90e9`（DEMから法線再生成）、`6069968`（天の川拡散光）、`ac7be9d` / `13a96b5`（ガリレオ衛星）。ケレスは140m版ではなく20ppd/400m版、冥王星は白黒のPIA19858ではなくカラーのPIA11707へ出典リンクを訂正。独自シェーダで描く太陽・土星等の模様と環内の粒子は外部写真ではありません。

## 探査機モデル

[NASA 3D Resources](https://science.nasa.gov/3d-resources/) と [公式配布リポジトリ](https://github.com/nasa/NASA-3D-Resources) はモデルの無料利用を明示しています。NASAの上記利用方針に従い、作者を表示します。

| 収録 | 元モデル・作者 | 加工 |
| --- | --- | --- |
| Voyager 1/2 | [Voyager Probe (A)](https://science.nasa.gov/3d-resources/voyager-probe-a/), NASA/Christopher R. Meaney | QEMで約2,500三角形へ削減、頂点Int16・面Uint16に変換。外部テクスチャなし |
| Cassini | [Cassini-Huygens (B)](https://science.nasa.gov/3d-resources/cassini-huygens-b/), NASA/JPL/Solar System Simulator; Michael Oberle | 同上。収録は周回機 |
| Huygens | Sidereum独自の概形 | 直径2.7mの円錐・シールド形状を24分割で構成 |

導入記録: `d32843e` / `871df1f`。配布モデルは `src/data/models.js` に含まれます。

## 恒星カタログの置換

[HYG 4.2](https://www.astronexus.com/projects/hyg)、David Nash / Astronomy Nexus。提供者が **CC BY-SA 4.0** を明示しています。[元の表示](licenses/HYG-NOTICE.md)、[ライセンス全文](licenses/OpenNGC-CC-BY-SA-4.0.txt)（同じCC BY-SA 4.0本文）。Yale直取り込みのバイナリを撤去し、この許諾付き配布物から再生成しました。HYGはHipparcos・Yale・Gliese等を統合したもので、原観測まで独立のデータではありません。

- 原本: https://www.astronexus.com/downloads/catalogs/hygdata_v42.csv.gz
- SHA-256: `5ca9431ff364c8002a4a3efa91b2b9296746aea1543374db4cb6b4fab049d601`
- 変換: `python3 tools/import-star-catalog.py /path/to/hygdata_v42.csv.gz`
- 太陽を除くV等級6.5以下、8,920星。J2000赤経/赤緯、V、B-Vを6バイトへ量子化。B-V欠測40件は0.65の表示色。固有運動は未適用。
- 派生データ `src/data/star-catalog.js` もCC BY-SA 4.0。アプリ独自コードのMITとは区別します。

## 月の数値表の置換

[ERFA moon98.c](https://github.com/liberfa/erfa/blob/master/src/moon98.c)、© 2013–2023 NumFOCUS Foundation。原ソースを `third_party/erfa/moon98.c` に無改変で同梱し、[全利用条件](licenses/ERFA.txt)を保存しました。SOFAから許諾を受けたERFAの配布物を使用します。

`python3 tools/import-moon-series.py` で黄経32項・緯度20項・距離25項を抽出し、並べ替え・単位変換して `src/data/moon-series.js` を生成。従来係数と全件数値一致を確認しました。Sidereumの短縮近似であって、SOFA/ERFA全体の実装でも、その精度保証でもありません。

## その他

観測写真8件は [DSO記録](tex/dso/CREDITS.md)、ベガ写真は [恒星写真記録](tex/stars/CREDITS.md)、OpenNGC・星座線・書体は [第三者表示](THIRD_PARTY_NOTICES.md) を参照。惑星・小天体の個別物理量と平均軌道要素はREADME記載のNASA/JPL公表値。説明文の執筆資料に関する不足は [文章監査](COPYRIGHT_AUDIT.md) に残しています。

### 地球の8K画像 (2026-09-22)

`tex/8k/earth.jpg` は上記と同じNASA Blue Marble地表TIFFを再取得し、8192×4096のままJPEG化したものです。既存の地球画像と同じ出典・クレジット・利用方針を適用します。原本SHA-256: `fec3cb8e729347d1c57807cf66b7867c1f3c669bb2f1fc3a8ad1625562591b36`。

### 月・火星・水星の8K画像 (2026-09-22)

既存製品ページの利用条件・クレジットを継承します。月の2K/4Kも2025年版に更新しました。加工手順は `tools/prepare-detail-textures.py` に収録しています。

- 月: [取得原本](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_8k.tif)。8192×4096、16bit sRGB。8bit化し、アプリ内の照明に合わせRGBを0.80倍。2K/4K/8KをJPEG化。 原本SHA-256: `db7808e878b6a55eb409bb231eab8deb477f84b5c9d7396d76ff73e5d54992d9`。
- 火星: [取得原本](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg)。21339×10670の1km版を8192×4096に縮小しJPEG化。 原本SHA-256: `fdfcd335559c3dc67052b7e8a9565d850e336ac0d1f3ea7f5eb7826ffb44ecb2`。
- 水星: [取得原本](https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif)。23040×11520を8192×4096に縮小。従来の見た目を保つためグレースケール化し、既存4Kの平均明度に合わせて約1.050倍、JPEG化。 原本SHA-256: `1f7af8fe53a02e46d9dca74b68b4eead8a451bf2578845a5a303a695bfd1c666`。
