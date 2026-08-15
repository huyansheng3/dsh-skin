# DreamSkin Gallery Top 100 Audit

Audited 100 themes from [DreamSkin Gallery](https://dreamskin.cc/gallery) using `sort=popular` on 2026-08-15.
Packages were downloaded from the official API, SHA-256 verified, imported through dsh-skin, Safe CSS checked, and source contrast-tested without changing author colors.

## Summary

- Package hash verified: 100/100
- Imported successfully: 93/100
- Safe CSS passed: 93/100
- Source readability passed: 69/100
- Source quality warnings: 24/100
- Gallery marks as one-click apply incompatible: 7/100

## Browser Rendering Follow-up

The browser audit activates themes one by one and treats missing backgrounds,
interactive background layers, horizontal overflow, missing theme tokens, and
missing native controls as failures. It also fails visible text-bearing code,
button, input, select, tab, and tree-item surfaces below 3:1 when their own
background alpha is at least 0.85. Ordinary wallpaper/body contrast remains a
warning and is deliberately not used to rewrite author colors. The audit also
requires the compact sidebar expand/collapse control to inherit the author's
primary text token instead of the lower-emphasis secondary label token.

After removing the 24 source-quality failures, all 76 retained Gallery themes
were rerun on three existing conversations through this structural browser
audit. Every conversation passed 76/76 with no background-safety, overflow,
token, opaque-surface contrast, or control failures. The set included a view
with about 10,000 body text characters and more than 100 rendered controls.
Wallpaper contrast warnings remain expected and are not counted as structural
failures.

## Local Built-in Integration

The raw audit freezes all 100 official API package versions. The curated
`gallery/catalog.json` removes the 24 IDs in `gallery/exclusions.json` and pins
the remaining 76 package versions, sizes, SHA-256 hashes, authors, and declared
licenses. Running `npm run vendor:gallery` materializes those retained packages
into `gallery/themes/` without changing the active theme.

The seven upstream packages below contain a background and theme metadata but
omit `theme.css`. Normal ZIP imports continue to reject them. The explicit
vendoring workflow supplies one bounded Safe CSS compatibility rule and writes
the repair to `_dsh-skin.json`; it does not alter or misrepresent the official
package hash. Those seven continue to use the recorded compatibility CSS only
during explicit vendoring. All 76 retained IDs remain available locally; author
colors and custom CSS are otherwise left unchanged by the runtime adapter.

Across the audited Top 100, 51 packages declare MIT and 21 declare CC BY 4.0.
The other 28 use non-commercial, personal-use, proprietary, all-rights-reserved,
theme-code-only, or ambiguous custom license strings and are not redistributed.

The release directly bundles a conservative subset of 20 native packages from
the MIT/CC BY pool. Selection additionally requires passing source readability,
avoids obvious third-party characters, system wallpapers, and scraped-source
artwork, and favors a varied general-purpose collection. The exact pinned list
is `gallery/bundled-themes.json`; attribution and license notices are in
`THIRD_PARTY_NOTICES.md`. All other materialized Gallery directories remain
ignored and cannot enter the package through a broad glob.

Gallery publishers retain responsibility for the accuracy of their license and
asset-rights declarations. dsh-skin records that provenance but cannot
independently establish chain of title for uploaded artwork.

## Upstream Package Completeness Failures

These remain strict import failures in the original packages even though the
local built-in workflow records and applies the bounded compatibility repair.

| Rank | Theme | Author | Issues |
| ---: | --- | --- | --- |
| 5 | 保险柜 办公室 卡通 DreamSkin 2560x1440 (`dreamskin-2560x1440`) | 陆健辉 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 7 | mikuu full background (`mikuu-full-background`) | powerdog996 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 42 | 三体-智子 (`12333`) | CC Aoye | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 57 | BHIEICJGDEGAB 73sX6Aglmp (`bhieicjgdegab-73sx6aglmp`) | Callie | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 89 | 我独自升级 (`shengji`) | qihang10010 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 91 | call BsIIsjqEQfnfkYb1LclWK1PO (`call-bsiisjqeqfnfkyb1lclwk1po`) | Sky Lonely (Augenstern) | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 100 | wallpaper动态壁纸 风景 1 小羊（主页娶图） 来自小红书网页版 (`wallpaper-1`) | 王章鉴 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |

## Source Themes Excluded From Defaults

These importable packages contain low or unparseable source contrast. `gallery/exclusions.json` removes all 24 from the default catalog instead of rewriting author colors.

| Rank | Theme | Downloads | Source issues |
| ---: | --- | ---: | --- |
| 1 | 晨雾山水 (`guiming.ink.morning-mist`) | 3748 | source-muted-contrast |
| 9 | 三上悠亚 (`poster`) | 1079 | source-muted-contrast, source-accent-contrast |
| 10 | firefly (`firefly`) | 1062 | source-muted-contrast, source-accent-contrast |
| 14 | 大肥鱼（8.1） (`111`) | 877 | source-muted-contrast |
| 17 | 灵感小宇宙 (`usr-49e16299682ecef4aa46.idea-engine`) | 780 | source-accent-contrast |
| 19 | Cyber · 紫罗兰永恒花园 · Violet Evergarden (`violet-evergarden`) | 698 | source-muted-contrast |
| 20 | Claude EVA 暖奶油 (`claude-eva-warm`) | 668 | source-muted-contrast, source-accent-contrast |
| 22 | 清透定制 (`usr-49e16299682ecef4aa46.quiet-paper`) | 576 | source-muted-contrast, source-accent-contrast |
| 23 | 云上仙途 (`usr-49e16299682ecef4aa46.cloud-ascent`) | 574 | source-muted-contrast, source-accent-contrast |
| 26 | 雨过青瓷 (`guiming.ink.rainwashed-celadon`) | 536 | source-muted-contrast |
| 34 | 缎带夜曲 · Ribbon Nocturne (`ribbon-nocturne`) | 445 | source-muted-contrast |
| 43 | Sunrise Coast Lab (`sunrise-coast-lab`) | 369 | source-muted-contrast, source-accent-contrast |
| 44 | 不干活就没饭吃 (`work-xixia`) | 364 | source-muted-contrast, source-accent-contrast |
| 49 | 青空の旅 (`aozora-no-tabi`) | 338 | source-muted-contrast, source-accent-contrast |
| 52 | 仙剑问情 (`xianjian`) | 330 | source-muted-contrast, source-accent-contrast |
| 59 | 明日香 (`preview`) | 288 | source-muted-contrast, source-accent-contrast |
| 66 | 推理 · 报社小姐 (`miss-dirty-investigation`) | 261 | source-muted-contrast |
| 69 | 黑神话 (`wukong1`) | 255 | source-muted-contrast |
| 75 | 雷姆酱 (`leimu`) | 237 | source-muted-contrast |
| 80 | 灵宠奇旅 (`usr-49e16299682ecef4aa46.spirit-trail`) | 226 | source-muted-contrast, source-accent-contrast |
| 86 | 渔女 (`fisher-girl`) | 220 | source-muted-contrast |
| 93 | 墨影江湖 (`usr-49e16299682ecef4aa46.ink-horizon`) | 207 | source-muted-contrast |
| 96 | 蔚蓝档案-阿洛娜 (`blue-archive-arona`) | 200 | source-muted-contrast |
| 98 | 绘梨衣·星海绯梦 (`erii-celestial-dream`) | 199 | source-muted-contrast |

## Gallery Compatibility Warnings

These are Gallery metadata warnings, not dsh-skin import failures.

| Rank | Theme | Author |
| ---: | --- | --- |
| 5 | 保险柜 办公室 卡通 DreamSkin 2560x1440 (`dreamskin-2560x1440`) | 陆健辉 |
| 7 | mikuu full background (`mikuu-full-background`) | powerdog996 |
| 42 | 三体-智子 (`12333`) | CC Aoye |
| 57 | BHIEICJGDEGAB 73sX6Aglmp (`bhieicjgdegab-73sx6aglmp`) | Callie |
| 89 | 我独自升级 (`shengji`) | qihang10010 |
| 91 | call BsIIsjqEQfnfkYb1LclWK1PO (`call-bsiisjqeqfnfkyb1lclwk1po`) | Sky Lonely (Augenstern) |
| 100 | wallpaper动态壁纸 风景 1 小羊（主页娶图） 来自小红书网页版 (`wallpaper-1`) | 王章鉴 |

## Full Results

| Rank | Theme | Downloads | Import | Source |
| ---: | --- | ---: | :---: | :---: |
| 1 | 晨雾山水 (`guiming.ink.morning-mist`) | 3748 | pass | warn |
| 2 | 休闲室内居家 (`cecilylove002`) | 2021 | pass | pass |
| 3 | 露西 (`lucy-moon`) | 1737 | pass | pass |
| 4 | 月下松岚 (`guiming.ink.moonlit-pine`) | 1327 | pass | pass |
| 5 | 保险柜 办公室 卡通 DreamSkin 2560x1440 (`dreamskin-2560x1440`) | 1296 | fail | warn |
| 6 | 悟空（WUKONG） (`wukong`) | 1289 | pass | pass |
| 7 | mikuu full background (`mikuu-full-background`) | 1175 | fail | warn |
| 8 | DeepSeek-鲸鱼娘 (`deepseek`) | 1159 | pass | pass |
| 9 | 三上悠亚 (`poster`) | 1079 | pass | warn |
| 10 | firefly (`firefly`) | 1062 | pass | warn |
| 11 | 橘子洲头-毛主席 (`juzizhoutou`) | 983 | pass | pass |
| 12 | 蕾塞 (`reze`) | 930 | pass | pass |
| 13 | 人民的AI (`usr-49e16299682ecef4aa46.republic`) | 900 | pass | pass |
| 14 | 大肥鱼（8.1） (`111`) | 877 | pass | warn |
| 15 | 芙宁娜 小白袜 (`123456`) | 806 | pass | pass |
| 16 | 寂静星轨 (`guiming.cosmos.quiet-orbit`) | 793 | pass | pass |
| 17 | 灵感小宇宙 (`usr-49e16299682ecef4aa46.idea-engine`) | 780 | pass | warn |
| 18 | 安静氛围 森林 (`forest`) | 716 | pass | pass |
| 19 | Cyber · 紫罗兰永恒花园 · Violet Evergarden (`violet-evergarden`) | 698 | pass | warn |
| 20 | Claude EVA 暖奶油 (`claude-eva-warm`) | 668 | pass | warn |
| 21 | 46 morning 4k (`46-morning-4k`) | 598 | pass | pass |
| 22 | 清透定制 (`usr-49e16299682ecef4aa46.quiet-paper`) | 576 | pass | warn |
| 23 | 云上仙途 (`usr-49e16299682ecef4aa46.cloud-ascent`) | 574 | pass | warn |
| 24 | miku-猛男版 (`miku`) | 559 | pass | pass |
| 25 | 蓬松栗棕色长卷发小美女 (`jimeng-2026-08-04-5645`) | 549 | pass | pass |
| 26 | 雨过青瓷 (`guiming.ink.rainwashed-celadon`) | 536 | pass | warn |
| 27 | 202509061917596371 (`20250906191759-6023-71`) | 515 | pass | pass |
| 28 | 好看户外治愈 (`cecilylove003`) | 513 | pass | pass |
| 29 | art (`art`) | 510 | pass | pass |
| 30 | SPIDER-MAN (`wuzhenghua.redline-breakout`) | 456 | pass | pass |
| 31 | 【哲风壁纸】凡人修仙传 古建 (`fanrenpc`) | 448 | pass | pass |
| 32 | cat (`cat`) | 447 | pass | pass |
| 33 | 海岸 (`120458`) | 446 | pass | pass |
| 34 | 缎带夜曲 · Ribbon Nocturne (`ribbon-nocturne`) | 445 | pass | warn |
| 35 | mingchao_yongzhuang (`mingchao`) | 429 | pass | pass |
| 36 | 朱影 (`custom-1785220478580`) | 411 | pass | pass |
| 37 | 栗棕日光-专注版 (`hx24007-2026-08-012-0001`) | 400 | pass | pass |
| 38 | 罗小黑 (`the-legend-of-hei`) | 386 | pass | pass |
| 39 | 薰子 (`xunzi`) | 378 | pass | pass |
| 40 | ZhangBoBo Freedom Lab (`zhangbobo-freedom-lab`) | 376 | pass | pass |
| 41 | 月色安纳普尔纳 (`annapurna-peak-v0.1.1`) | 374 | pass | pass |
| 42 | 三体-智子 (`12333`) | 372 | fail | warn |
| 43 | Sunrise Coast Lab (`sunrise-coast-lab`) | 369 | pass | warn |
| 44 | 不干活就没饭吃 (`work-xixia`) | 364 | pass | warn |
| 45 | Go fight (`usr-loki.apple-light-guardian-popup-contrast`) | 358 | pass | pass |
| 46 | 洛天依 (`myfirstheme`) | 357 | pass | pass |
| 47 | 银河 Milky Way (`milky-way`) | 355 | pass | pass |
| 48 | 超级赛亚人·觉醒 (`super-saiyan-awakening`) | 341 | pass | pass |
| 49 | 青空の旅 (`aozora-no-tabi`) | 338 | pass | warn |
| 50 | 月下松岚 (`anye`) | 338 | pass | pass |
| 51 | 初音 · 星海舞台 (`hatsune-miku-cyan-stage`) | 331 | pass | pass |
| 52 | 仙剑问情 (`xianjian`) | 330 | pass | warn |
| 53 | 珊瑚穹顶之城 (`custom-1784270668889`) | 328 | pass | pass |
| 54 | yangyang (`yangyang`) | 309 | pass | pass |
| 55 | 斯卡蒂 | (`skadi-terminal`) | 303 | pass | pass | pass |
| 56 | 月影轻吻 (`moonlight-kiss`) | 299 | pass | pass |
| 57 | BHIEICJGDEGAB 73sX6Aglmp (`bhieicjgdegab-73sx6aglmp`) | 299 | fail | warn |
| 58 | 霓虹雨城 (`guiming.future.neon-rain-city`) | 291 | pass | pass |
| 59 | 明日香 (`preview`) | 288 | pass | warn |
| 60 | IMG 5509 (`img-5509`) | 284 | pass | pass |
| 61 | summer time rei (`summer-time-rei`) | 276 | pass | pass |
| 62 | 上杉绘梨衣（v2优化版） (`crimson-dusk`) | 274 | pass | pass |
| 63 | Forever Kun Red (`ikun-red`) | 273 | pass | pass |
| 64 | hacker IT (`hacker-it`) | 271 | pass | pass |
| 65 | 雷姆 (`rem0`) | 263 | pass | pass |
| 66 | 推理 · 报社小姐 (`miss-dirty-investigation`) | 261 | pass | warn |
| 67 | 暮云风野 · Windbound Dusk (`windbound-dusk`) | 261 | pass | pass |
| 68 | ChatGPT Image 2026年8月1日 02 47 08 (`chatgpt-image-2026-8-1-02-47-08`) | 255 | pass | pass |
| 69 | 黑神话 (`wukong1`) | 255 | pass | warn |
| 70 | 菈妮 (`ranni`) | 252 | pass | pass |
| 71 | Green Meadow (`green-meadow`) | 251 | pass | pass |
| 72 | 星潮（v2优化版） (`astral-tidev2`) | 245 | pass | pass |
| 73 | 金笺书室 · Amber Letters (`amber-letters`) | 245 | pass | pass |
| 74 | exec 89fd6732 b964 42fc a1d8 3ca1a153bdc8 (`exec-89fd6732-b964-42fc-a1d8-3ca1a153bdc8`) | 241 | pass | pass |
| 75 | 雷姆酱 (`leimu`) | 237 | pass | warn |
| 76 | 星际守望者 (`stellar-watcher`) | 235 | pass | pass |
| 77 | 浪客行 宫本武藏 (`musashi`) | 230 | pass | pass |
| 78 | 奥创（Ultron） (`ultron`) | 230 | pass | pass |
| 79 | 阳光少年 (`sunny-boy`) | 228 | pass | pass |
| 80 | 灵宠奇旅 (`usr-49e16299682ecef4aa46.spirit-trail`) | 226 | pass | warn |
| 81 | 坚持 (`insist-on`) | 225 | pass | pass |
| 82 | 伊蕾娜 (`elaina-witch`) | 223 | pass | pass |
| 83 | 蓝灰夜航 · Navy Ice (`navy-ice`) | 221 | pass | pass |
| 84 | 这就是金克斯 (`this-is-jenkins`) | 221 | pass | pass |
| 85 | 蜘蛛侠 · 暗网徽记 (`spider-man-dark-web`) | 220 | pass | pass |
| 86 | 渔女 (`fisher-girl`) | 220 | pass | warn |
| 87 | 财神打工版 (`usr-49e16299682ecef4aa46.prosperity-mode`) | 219 | pass | pass |
| 88 | 山海异闻 (`usr-49e16299682ecef4aa46.mountain-sea`) | 218 | pass | pass |
| 89 | 我独自升级 (`shengji`) | 216 | fail | warn |
| 90 | 见夕阳 (`jian-xi-yang-theme`) | 211 | pass | pass |
| 91 | call BsIIsjqEQfnfkYb1LclWK1PO (`call-bsiisjqeqfnfkyb1lclwk1po`) | 211 | fail | warn |
| 92 | macos 27 beta3 black teal gradient dark 高质量压缩版 (`macos-27-beta3-black-teal-gradient-dark`) | 207 | pass | pass |
| 93 | 墨影江湖 (`usr-49e16299682ecef4aa46.ink-horizon`) | 207 | pass | warn |
| 94 | Character 01 (`character-01`) | 202 | pass | pass |
| 95 | 动漫少女素描 (`anime-girl-sketch-black-bg`) | 201 | pass | pass |
| 96 | 蔚蓝档案-阿洛娜 (`blue-archive-arona`) | 200 | pass | warn |
| 97 | 金陵晴川 · Jinling Sunlit (`jinling-sunlit`) | 200 | pass | pass |
| 98 | 绘梨衣·星海绯梦 (`erii-celestial-dream`) | 199 | pass | warn |
| 99 | 323 (`323`) | 195 | pass | pass |
| 100 | wallpaper动态壁纸 风景 1 小羊（主页娶图） 来自小红书网页版 (`wallpaper-1`) | 195 | fail | warn |
