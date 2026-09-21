  // Catalogue identifiers and name histories: IAU Working Group on Star Names.
  // Summaries are independently written; magnitude uses the rendered star catalogue.
  const STAR_INFO_SOURCE = "https://exopla.net/star-names/modern-iau-star-names/";
  const STAR_INFO = {
  "Sirius": {
    "con": "CMa",
    "designation": "α CMa",
    "note": [
      "夜空で最も明るく見える恒星です。約8.6光年先にあり、白色矮星シリウスBと互いの周りを回っています。",
      "The brightest star in the night sky lies about 8.6 light-years away. It shares an orbit with the white dwarf Sirius B."
    ],
    "reference": "https://science.nasa.gov/asset/hubble/the-dog-star-sirius-and-its-tiny-companion/"
  },
  "Canopus": {
    "con": "Car",
    "designation": "α Car",
    "note": [
      "シリウスに次いで夜空で2番目に明るく見える恒星です。南の空にあるため、日本では見える地域でも地平線近くの低い位置に現れます。",
      "The second-brightest star in the night sky after Sirius. Its southerly position keeps it low on the horizon from places in Japan where it is visible."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/canopus.html"
  },
  "Arcturus": {
    "con": "Boo",
    "designation": "α Boo",
    "note": [
      "北の空で目を引く、オレンジ色の明るい星です。名前には「熊の守り手」や「北の守り手」という意味があります。",
      "A bright orange star of the northern sky. Its name can mean either guardian of the bear or guardian of the north."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/arcturus.html"
  },
  "Rigil Kentaurus": {
    "con": "Cen",
    "designation": "α Cen",
    "note": [
      "名前はアラビア語の「ケンタウルスの足」に由来します。星座の姿の中で、星が置かれた場所を表す名前です。",
      "Its Arabic-derived name means the foot of the Centaur, describing its position in the constellation figure."
    ]
  },
  "Vega": {
    "con": "Lyr",
    "designation": "α Lyr",
    "note": [
      "非常に速く自転している星で、自転によって赤道付近が膨らんでいます。名前は、アラビア語の「舞い降りるワシ」に由来します。",
      "Vega rotates so rapidly that its equator bulges outward. Its name comes from an Arabic expression for a swooping eagle."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/vega.html"
  },
  "Capella": {
    "con": "Aur",
    "designation": "α Aur",
    "note": [
      "名前はラテン語で「雌ヤギ」を意味します。星の名前には、現在の星座名とは異なる古い星の見立ても残っています。",
      "Its Latin name means she-goat, preserving an older way of imagining this part of the sky."
    ]
  },
  "Rigel": {
    "con": "Ori",
    "designation": "β Ori",
    "note": [
      "名前は、アラビア語でオリオンにあたる人物の「足」を表す言葉から来ています。",
      "Its name comes from an Arabic expression for the foot of the figure associated with Orion."
    ]
  },
  "Procyon": {
    "con": "CMi",
    "designation": "α CMi",
    "note": [
      "名前はギリシャ語の「犬の前」に由来します。シリウスより先に昇ることに結びついた名前です。",
      "Its Greek name means before the dog, referring to its rising before Sirius."
    ]
  },
  "Achernar": {
    "con": "Eri",
    "designation": "α Eri",
    "note": [
      "名前はアラビア語の「川の果て」に由来します。かつて別の星に使われた名前が、この星に引き継がれました。",
      "Its name means the end of the river in Arabic. The name was transferred here from another star."
    ]
  },
  "Betelgeuse": {
    "con": "Ori",
    "designation": "α Ori",
    "note": [
      "大きく膨らんだ超巨星です。名前は古いアラビア語の星の呼び名が、翻訳や書き写しを経て変化したものです。",
      "An enormous supergiant. Its name evolved through translations and transcriptions of an older Arabic star name."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/sunstar.html"
  },
  "Hadar": {
    "con": "Cen",
    "designation": "β Cen",
    "note": [
      "古くから使われるアラビア語由来の名前を持つ星です。名前の正確な意味は、はっきり分かっていません。",
      "It bears an old Arabic-derived name whose exact meaning remains uncertain."
    ]
  },
  "Altair": {
    "con": "Aql",
    "designation": "α Aql",
    "note": [
      "10時間足らずで一回転するほど自転が速く、赤道付近が膨らんでいます。名前はアラビア語の「飛ぶワシ」に由来します。",
      "It rotates in less than ten hours, causing an equatorial bulge. Its name comes from Arabic for the flying eagle."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/altair.html"
  },
  "Acrux": {
    "con": "Cru",
    "designation": "α Cru",
    "note": [
      "名前は「アルファ」と、みなみじゅうじ座を表すラテン語「Crux」を組み合わせたものです。",
      "Its modern name combines Alpha with Crux, the Latin name of the Southern Cross."
    ]
  },
  "Aldebaran": {
    "con": "Tau",
    "designation": "α Tau",
    "note": [
      "名前はアラビア語の「後に続くもの」に由来します。すばるを追うように昇る姿に結びついた名前と考えられています。",
      "Its name means the follower in Arabic, probably referring to its following the Pleiades across the sky."
    ]
  },
  "Antares": {
    "con": "Sco",
    "designation": "α Sco",
    "note": [
      "赤い色が火星を思わせる星です。名前も、火星に対応するギリシャ神話のアレスになぞらえたものです。",
      "Its reddish colour recalls Mars. Its name compares it to Ares, the Greek counterpart of Mars."
    ]
  },
  "Spica": {
    "con": "Vir",
    "designation": "α Vir",
    "note": [
      "一つの星に見えますが、二つの高温の星が約4日で互いの周りを回っています。名前はラテン語で「穀物の穂」を意味します。",
      "It looks like one star, but two hot stars orbit each other in about four days. Its Latin name means an ear of grain."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/spica.html"
  },
  "Pollux": {
    "con": "Gem",
    "designation": "β Gem",
    "note": [
      "名前はギリシャ神話の双子の一人に由来します。もう一人の名は、同じふたご座のカストルに残っています。",
      "It is named after one of the mythological twins. The other twin gives his name to nearby Castor in Gemini."
    ]
  },
  "Fomalhaut": {
    "con": "PsA",
    "designation": "α PsA",
    "note": [
      "周囲に塵の帯を持つ星で、赤外線の観測によってその構造が調べられています。名前はアラビア語の「南の魚の口」に由来します。",
      "Infrared observations reveal belts of dust around this star. Its Arabic-derived name means the mouth of the southern fish."
    ],
    "reference": "https://science.nasa.gov/missions/webb/webb-looks-for-fomalhauts-asteroid-belt-and-finds-much-more/"
  },
  "Deneb": {
    "con": "Cyg",
    "designation": "α Cyg",
    "note": [
      "非常に大きな超巨星です。名前はアラビア語の「尾」に由来し、はくちょう座の尾にあたる星です。",
      "A very large supergiant marking the Swan’s tail. Its name comes from the Arabic word for tail."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/sunstar.html"
  },
  "Mimosa": {
    "con": "Cru",
    "designation": "β Cru",
    "note": [
      "ラテン語に由来する名前ですが、なぜこの星に付けられたかは明確ではありません。植物のミモザも同じ語源を持ちます。",
      "Its Latin-derived name shares a root with the plant Mimosa, though why it was applied to this star is uncertain."
    ]
  },
  "Regulus": {
    "con": "Leo",
    "designation": "α Leo",
    "note": [
      "名前はラテン語の「小さな王」を意味します。古くから王に結びつけられてきた星です。",
      "Its Latin name means little king, continuing a long association of this star with royalty."
    ]
  },
  "Adhara": {
    "con": "CMa",
    "designation": "ε CMa",
    "note": [
      "名前はアラビア語で「乙女たち」を意味する、古い星の並びの呼び名に由来します。",
      "Its name derives from an old Arabic asterism known as the maidens."
    ]
  },
  "Castor": {
    "con": "Gem",
    "designation": "α Gem",
    "note": [
      "ギリシャ神話の双子の一人にちなんだ星です。同じふたご座のポルックスと対になる名前です。",
      "Named after one of the mythological twins, it is paired in name with Pollux in Gemini."
    ]
  },
  "Gacrux": {
    "con": "Cru",
    "designation": "γ Cru",
    "note": [
      "名前は「ガンマ」と、みなみじゅうじ座を表す「Crux」を組み合わせたものです。",
      "Its modern name combines Gamma with Crux, the Latin name of the Southern Cross."
    ]
  },
  "Shaula": {
    "con": "Sco",
    "designation": "λ Sco",
    "note": [
      "名前は、サソリの針に見立てた古いアラビア語の星の並びに由来します。",
      "Its name comes from an old Arabic asterism representing a scorpion’s sting."
    ]
  },
  "Bellatrix": {
    "con": "Ori",
    "designation": "γ Ori",
    "note": [
      "名前はラテン語で「女性の戦士」を意味します。星に人物の姿を重ねた呼び名の一つです。",
      "Its Latin name means female warrior, one of the human figures evoked by traditional star names."
    ]
  },
  "Elnath": {
    "con": "Tau",
    "designation": "β Tau",
    "note": [
      "名前はアラビア語の「角で突くもの」に由来します。おうし座の角にあたる星です。",
      "Its Arabic-derived name refers to butting with horns, matching its place on a horn of Taurus."
    ]
  },
  "Miaplacidus": {
    "con": "Car",
    "designation": "β Car",
    "note": [
      "名前の後半は、ラテン語の「穏やかな」に由来します。前半の由来は明確ではありません。",
      "The latter part of its name comes from Latin for calm. The origin of the first part is uncertain."
    ]
  },
  "Alnilam": {
    "con": "Ori",
    "designation": "ε Ori",
    "note": [
      "オリオンの三つ星に属する星です。名前はアラビア語の「真珠の連なり」に由来します。",
      "One of Orion’s Belt stars, with an Arabic-derived name referring to a string of pearls."
    ]
  },
  "Alnair": {
    "con": "Gru",
    "designation": "α Gru",
    "note": [
      "名前はアラビア語の「明るいもの」に由来します。かつてこの付近は、南の魚の尾の一部と考えられていました。",
      "Its name derives from Arabic for the bright one. This area was once associated with the southern fish’s tail."
    ]
  },
  "Alnitak": {
    "con": "Ori",
    "designation": "ζ Ori",
    "note": [
      "オリオンの三つ星に属する星です。名前はアラビア語の「帯」に由来します。",
      "One of Orion’s Belt stars. Its name comes from an Arabic word for a belt."
    ]
  },
  "Alioth": {
    "con": "UMa",
    "designation": "ε UMa",
    "note": [
      "古いアラビア語の名前が変化して伝わった星です。北斗七星を形作る星の一つです。",
      "One of the Big Dipper’s stars, bearing a name that developed from an older Arabic form."
    ]
  },
  "Dubhe": {
    "con": "UMa",
    "designation": "α UMa",
    "note": [
      "メラクとともに北極星を探す目印になります。名前はアラビア語の「熊」に由来します。",
      "Together with Merak it points toward Polaris. Its name comes from the Arabic word for bear."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/dubhe.html"
  },
  "Mirfak": {
    "con": "Per",
    "designation": "α Per",
    "note": [
      "名前はアラビア語の「肘」に由来します。現在の星座よりも古い、空の人物像に結びついた呼び名です。",
      "Its name derives from Arabic for elbow, associated with an older sky figure rather than the modern constellation."
    ]
  },
  "Wezen": {
    "con": "CMa",
    "designation": "δ CMa",
    "note": [
      "古くから使われるアラビア語由来の名前です。元の呼び名がどの星を指したかには不確かさが残っています。",
      "Its old Arabic-derived name has an uncertain early history, including which star it originally identified."
    ]
  },
  "Sargas": {
    "con": "Sco",
    "designation": "θ Sco",
    "note": [
      "名前は古代バビロニアにまでさかのぼり、神マルドゥクの武器に結びつく呼び名とされています。",
      "Its name reaches back to ancient Babylonia and is associated with a weapon of the god Marduk."
    ]
  },
  "Kaus Australis": {
    "con": "Sgr",
    "designation": "ε Sgr",
    "note": [
      "名前はアラビア語の「弓」とラテン語の「南」を組み合わせています。いて座の弓の南側にあたります。",
      "Its name combines Arabic for bow with Latin for southern, identifying the southern part of Sagittarius’s bow."
    ]
  },
  "Avior": {
    "con": "Car",
    "designation": "ε Car",
    "note": [
      "古代からの名前ではなく、航空用の天文暦に載せるために付けられた名前です。",
      "This is a modern name introduced for use in the Air Almanac, rather than one inherited from antiquity."
    ]
  },
  "Alkaid": {
    "con": "UMa",
    "designation": "η UMa",
    "note": [
      "名前は古いアラビア語の星の並びで「先頭」を表す言葉に由来します。北斗七星の柄の先にある星です。",
      "Its name derives from the leader of an old Arabic asterism. It marks the end of the Big Dipper’s handle."
    ]
  },
  "Menkalinan": {
    "con": "Aur",
    "designation": "β Aur",
    "note": [
      "名前はアラビア語で「手綱を持つ者の肩」を表します。ぎょしゃ座の人物の肩に見立てられた星です。",
      "Its Arabic-derived name means the shoulder of the rein-holder, referring to the figure of Auriga."
    ]
  },
  "Atria": {
    "con": "TrA",
    "designation": "α TrA",
    "note": [
      "名前は「アルファ」と、みなみのさんかく座のラテン語名を縮めて組み合わせたものです。",
      "Its modern name is a contraction of Alpha Trianguli Australis."
    ]
  },
  "Alhena": {
    "con": "Gem",
    "designation": "γ Gem",
    "note": [
      "名前は、月の通り道を区切っていた古いアラビアの星の区分に由来します。",
      "Its name comes from an old Arabic lunar mansion, one of the star groups marking the Moon’s path."
    ]
  },
  "Peacock": {
    "con": "Pav",
    "designation": "α Pav",
    "note": [
      "英語で「クジャク」を意味します。くじゃく座に属するこの星のため、航空用の天文暦で採用された名前です。",
      "The English word for the bird represented by Pavo was adopted as this star’s name for the Air Almanac."
    ]
  },
  "Polaris": {
    "con": "UMi",
    "designation": "α UMi",
    "note": [
      "北の天の極の近くに見える、現在の北極星です。名前もラテン語の「極」に結びついています。",
      "Our present North Star lies close to the north celestial pole. Its name is related to the Latin word for pole."
    ]
  },
  "Mirzam": {
    "con": "CMa",
    "designation": "β CMa",
    "note": [
      "古いアラビア語の星の呼び名を受け継いでいます。その言葉の正確な意味は明確ではありません。",
      "It preserves an old Arabic star name whose precise meaning is uncertain."
    ]
  },
  "Alphard": {
    "con": "Hya",
    "designation": "α Hya",
    "note": [
      "名前はアラビア語で「孤独なもの」を意味します。周囲に明るい星が少ないことに由来する名前です。",
      "Its Arabic name means the solitary one, referring to the lack of bright stars around it."
    ]
  },
  "Hamal": {
    "con": "Ari",
    "designation": "α Ari",
    "note": [
      "名前はアラビア語の「子羊」に由来します。おひつじ座の姿と結びついた名前です。",
      "Its name comes from Arabic for lamb, matching the figure of Aries."
    ]
  },
  "Denebola": {
    "con": "Leo",
    "designation": "β Leo",
    "note": [
      "名前はアラビア語の「ライオンの尾」に由来します。しし座の尾にあたる星です。",
      "Its name derives from Arabic for the lion’s tail, marking that part of Leo."
    ]
  },
  "Algol": {
    "con": "Per",
    "designation": "β Per",
    "note": [
      "星同士が手前と奥に重なり、光を遮ることで明るさが変わる「食連星」です。名前はアラビア語の「魔物の頭」に由来します。",
      "An eclipsing binary: its brightness changes as one star passes in front of another. Its Arabic-derived name refers to a demon’s head."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/class.html"
  },
  "Albireo": {
    "con": "Cyg",
    "designation": "β Cyg",
    "note": [
      "名前は、ギリシャ語の星座の記述がアラビア語やラテン語を経て伝わる中で生まれました。",
      "Its name developed through the transmission of Greek constellation writing into Arabic and Latin."
    ]
  },
  "Mira": {
    "con": "Cet",
    "designation": "ο Cet",
    "note": [
      "膨張と収縮を繰り返し、明るさを大きく変える星です。このような星は「ミラ型変光星」と呼ばれます。名前はラテン語で「驚くべきもの」を意味します。",
      "It pulsates and changes greatly in brightness, giving its name to the Mira class of variable stars. Its Latin name means wonderful."
    ],
    "reference": "https://lweb.cfa.harvard.edu/sdu/mira.html"
  },
  "Kochab": {
    "con": "UMi",
    "designation": "β UMi",
    "note": [
      "古くから伝わる名前ですが、その由来には不確かな点があります。こぐま座に属する恒星です。",
      "An old name with an uncertain origin, borne by a star in Ursa Minor."
    ]
  },
  "Rasalhague": {
    "con": "Oph",
    "designation": "α Oph",
    "note": [
      "名前はアラビア語の「蛇を持つ者の頭」に由来します。へびつかい座の頭にあたる星です。",
      "Its Arabic-derived name means the head of the serpent-holder, locating it in Ophiuchus."
    ]
  },
  "Alphecca": {
    "con": "CrB",
    "designation": "α CrB",
    "note": [
      "名前は、途切れた輪に見立てた古いアラビア語の星の並びに由来します。",
      "Its name comes from an old Arabic asterism imagined as an incomplete circle."
    ]
  },
  "Nunki": {
    "con": "Sgr",
    "designation": "σ Sgr",
    "note": [
      "名前は古代メソポタミアに由来し、エリドゥという都市と結びついています。古い呼び名と現在の星の対応には不確かさもあります。",
      "Its ancient Mesopotamian name is associated with the city of Eridu, though its original identification is uncertain."
    ]
  },
  "Alderamin": {
    "con": "Cep",
    "designation": "α Cep",
    "note": [
      "古いアラビア語の名前が変化して伝わったものです。語源の解釈には議論が残っています。",
      "Its name developed from Arabic, but the interpretation of its origin remains debated."
    ]
  },
  "Schedar": {
    "con": "Cas",
    "designation": "α Cas",
    "note": [
      "名前はアラビア語の「胸」に由来します。カシオペヤ座の人物の胸に見立てられた星です。",
      "Its name derives from Arabic for breast, locating it in the figure of Cassiopeia."
    ]
  },
  "Caph": {
    "con": "Cas",
    "designation": "β Cas",
    "note": [
      "名前は、ヘナで染めた手に見立てた古い星の並びに由来します。今のカシオペヤ座とは異なる空の見立てが残っています。",
      "Its name recalls an old asterism imagined as a henna-stained hand, an earlier interpretation of this part of the sky."
    ]
  },
  "Markab": {
    "con": "Peg",
    "designation": "α Peg",
    "note": [
      "名前は、馬の肩のあたりを指す古いアラビア語の呼び名に由来します。別の星から、この星へと名前が移りました。",
      "Its name comes from an Arabic expression for part of a horse’s shoulder and was transferred here from another star."
    ]
  },
  "Alpheratz": {
    "con": "And",
    "designation": "α And",
    "note": [
      "名前はアラビア語の馬に関わる呼び名から伝わりました。現在はアンドロメダ座の恒星として分類されています。",
      "Its name has Arabic roots associated with a horse, although the star is now assigned to Andromeda."
    ]
  },
  "Diphda": {
    "con": "Cet",
    "designation": "β Cet",
    "note": [
      "名前はアラビア語の「2番目のカエル」に由来します。現在のくじら座とは別の、古い星の見立てです。",
      "Its Arabic-derived name means the second frog, preserving an older sky image than modern Cetus."
    ]
  },
  "Enif": {
    "con": "Peg",
    "designation": "ε Peg",
    "note": [
      "名前はアラビア語の「鼻」に結びつくと考えられていますが、由来には不確かな点もあります。",
      "Its name is usually linked to the Arabic word for nose, though its origin has some uncertainty."
    ]
  },
  "Saiph": {
    "con": "Ori",
    "designation": "κ Ori",
    "note": [
      "名前はアラビア語の「剣」に由来します。もとはオリオンの剣にあたる星々の呼び名が、この星に移りました。",
      "Its name derives from Arabic for sword, transferred from the stars of Orion’s Sword to this star."
    ]
  },
  "Mintaka": {
    "con": "Ori",
    "designation": "δ Ori",
    "note": [
      "オリオンの三つ星の一つで、天の赤道のすぐ近くにあります。そのため、ほぼ真東から昇り、真西に沈みます。名前はアラビア語の「帯」に由来します。",
      "One of Orion’s Belt stars, lying very close to the celestial equator. It rises almost due east and sets almost due west. Its name comes from Arabic for a belt."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/mintaka.html"
  },
  "Rasalgethi": {
    "con": "Her",
    "designation": "α1 Her",
    "note": [
      "名前はアラビア語の「ひざまずく者の頭」に由来します。ヘルクレス座の古い人物像を表しています。",
      "Its name means the head of the kneeling one in Arabic, recalling an older image of Hercules."
    ]
  },
  "Sabik": {
    "con": "Oph",
    "designation": "η Oph",
    "note": [
      "アラビア語に由来する名前ですが、正確な意味や伝わり方には不確かな点があります。",
      "Its name has Arabic roots, but its exact meaning and history are uncertain."
    ]
  },
  "Merak": {
    "con": "UMa",
    "designation": "β UMa",
    "note": [
      "名前はアラビア語で熊の「脇腹」を表します。ドゥーベとともに北極星を探す目印になります。",
      "Its name refers to the bear’s flank in Arabic. Together with Dubhe it points toward Polaris."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/dubhe.html"
  },
  "Phecda": {
    "con": "UMa",
    "designation": "γ UMa",
    "note": [
      "名前はアラビア語の熊の「もも」に由来します。北斗七星を形作る星の一つです。",
      "Its name derives from Arabic for the bear’s thigh. It is one of the Big Dipper’s stars."
    ]
  },
  "Megrez": {
    "con": "UMa",
    "designation": "δ UMa",
    "note": [
      "名前はアラビア語で熊の「尾の付け根」を表します。北斗七星の柄とひしゃくがつながるところにある星です。",
      "Its name refers to the root of the bear’s tail. It joins the Big Dipper’s handle to its bowl."
    ]
  },
  "Mizar": {
    "con": "UMa",
    "designation": "ζ UMa",
    "note": [
      "北斗七星の柄にある星です。望遠鏡で見ると二つに分かれて見え、連星の観測史でもよく知られています。",
      "A star in the Big Dipper’s handle that separates into two through a telescope. It has an important place in the history of double-star observations."
    ],
    "reference": "https://stars.astro.illinois.edu/sow/mizar.html"
  }
};
  // Only verified public-domain / CC0 observation photography belongs here.
  const STAR_PHOTOS = {
    Vega: {
      file: 'tex/stars/vega.jpg', credit: 'Chuck Ayoub',
      source: 'https://commons.wikimedia.org/wiki/File:Star-Vega.png',
      license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      caption: ['3時間の露光で撮影されたベガ。肉眼での見え方や恒星表面の拡大像ではありません。光の筋や広がりには、撮影機材の影響が含まれます。',
        'Vega in a three-hour exposure. This is neither a naked-eye view nor a resolved image of its surface. The rays and glow include effects of the imaging equipment.']
    }
  };
