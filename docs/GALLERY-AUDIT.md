# DreamSkin Gallery Top 100 Audit

Audited 100 themes from [DreamSkin Gallery](https://dreamskin.cc/gallery) using `sort=popular` on 2026-08-15.
Packages were downloaded from the official API, SHA-256 verified, imported through dsh-skin, Safe CSS checked, and contrast-tested before and after plugin normalization.

## Summary

- Package hash verified: 100/100
- Imported successfully: 93/100
- Safe CSS passed: 93/100
- Source readability passed: 69/100
- Readability passed after plugin normalization: 93/100
- Gallery marks as one-click apply incompatible: 7/100

## Browser Rendering Follow-up

The 93 importable packages were loaded into an isolated DSH Web instance and
activated one by one with `scripts/gallery-browser-audit.js`. All 93 passed the
rendered checks: background image present, `pointer-events: none`, base/panel
opacity floors, primary and muted contrast on all three composited surfaces,
no horizontal overflow, and visible native controls. The minimum observed
worst-case contrast was 4.65:1. Desktop and 390px-wide screenshots were also
checked for a light low-contrast theme and a corrected midtone theme.

## Unresolved Failures

| Rank | Theme | Author | Issues |
| ---: | --- | --- | --- |
| 5 | 保险柜 办公室 卡通 DreamSkin 2560x1440 (`dreamskin-2560x1440`) | 陆健辉 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 7 | mikuu full background (`mikuu-full-background`) | powerdog996 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 42 | 三体-智子 (`12333`) | CC Aoye | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 57 | BHIEICJGDEGAB 73sX6Aglmp (`bhieicjgdegab-73sx6aglmp`) | Callie | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 89 | 我独自升级 (`shengji`) | qihang10010 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 91 | call BsIIsjqEQfnfkYb1LclWK1PO (`call-bsiisjqeqfnfkyb1lclwk1po`) | Sky Lonely (Augenstern) | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |
| 100 | wallpaper动态壁纸 风景 1 小羊（主页娶图） 来自小红书网页版 (`wallpaper-1`) | 王章鉴 | import: Invalid theme in ZIP: DreamSkin ZIP must include a background image and non-empty theme.css |

## Source Theme Quality Warnings

These packages contain low or unparseable source contrast. dsh-skin corrects them at runtime.

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

| Rank | Theme | Downloads | Import | Source | Normalized |
| ---: | --- | ---: | :---: | :---: | :---: |
| 1 | 晨雾山水 (`guiming.ink.morning-mist`) | 3748 | pass | warn | pass |
| 2 | 休闲室内居家 (`cecilylove002`) | 2021 | pass | pass | pass |
| 3 | 露西 (`lucy-moon`) | 1737 | pass | pass | pass |
| 4 | 月下松岚 (`guiming.ink.moonlit-pine`) | 1327 | pass | pass | pass |
| 5 | 保险柜 办公室 卡通 DreamSkin 2560x1440 (`dreamskin-2560x1440`) | 1296 | fail | warn | fail |
| 6 | 悟空（WUKONG） (`wukong`) | 1289 | pass | pass | pass |
| 7 | mikuu full background (`mikuu-full-background`) | 1175 | fail | warn | fail |
| 8 | DeepSeek-鲸鱼娘 (`deepseek`) | 1159 | pass | pass | pass |
| 9 | 三上悠亚 (`poster`) | 1079 | pass | warn | pass |
| 10 | firefly (`firefly`) | 1062 | pass | warn | pass |
| 11 | 橘子洲头-毛主席 (`juzizhoutou`) | 983 | pass | pass | pass |
| 12 | 蕾塞 (`reze`) | 930 | pass | pass | pass |
| 13 | 人民的AI (`usr-49e16299682ecef4aa46.republic`) | 900 | pass | pass | pass |
| 14 | 大肥鱼（8.1） (`111`) | 877 | pass | warn | pass |
| 15 | 芙宁娜 小白袜 (`123456`) | 806 | pass | pass | pass |
| 16 | 寂静星轨 (`guiming.cosmos.quiet-orbit`) | 793 | pass | pass | pass |
| 17 | 灵感小宇宙 (`usr-49e16299682ecef4aa46.idea-engine`) | 780 | pass | warn | pass |
| 18 | 安静氛围 森林 (`forest`) | 716 | pass | pass | pass |
| 19 | Cyber · 紫罗兰永恒花园 · Violet Evergarden (`violet-evergarden`) | 698 | pass | warn | pass |
| 20 | Claude EVA 暖奶油 (`claude-eva-warm`) | 668 | pass | warn | pass |
| 21 | 46 morning 4k (`46-morning-4k`) | 598 | pass | pass | pass |
| 22 | 清透定制 (`usr-49e16299682ecef4aa46.quiet-paper`) | 576 | pass | warn | pass |
| 23 | 云上仙途 (`usr-49e16299682ecef4aa46.cloud-ascent`) | 574 | pass | warn | pass |
| 24 | miku-猛男版 (`miku`) | 559 | pass | pass | pass |
| 25 | 蓬松栗棕色长卷发小美女 (`jimeng-2026-08-04-5645`) | 549 | pass | pass | pass |
| 26 | 雨过青瓷 (`guiming.ink.rainwashed-celadon`) | 536 | pass | warn | pass |
| 27 | 202509061917596371 (`20250906191759-6023-71`) | 515 | pass | pass | pass |
| 28 | 好看户外治愈 (`cecilylove003`) | 513 | pass | pass | pass |
| 29 | art (`art`) | 510 | pass | pass | pass |
| 30 | SPIDER-MAN (`wuzhenghua.redline-breakout`) | 456 | pass | pass | pass |
| 31 | 【哲风壁纸】凡人修仙传 古建 (`fanrenpc`) | 448 | pass | pass | pass |
| 32 | cat (`cat`) | 447 | pass | pass | pass |
| 33 | 海岸 (`120458`) | 446 | pass | pass | pass |
| 34 | 缎带夜曲 · Ribbon Nocturne (`ribbon-nocturne`) | 445 | pass | warn | pass |
| 35 | mingchao_yongzhuang (`mingchao`) | 429 | pass | pass | pass |
| 36 | 朱影 (`custom-1785220478580`) | 411 | pass | pass | pass |
| 37 | 栗棕日光-专注版 (`hx24007-2026-08-012-0001`) | 400 | pass | pass | pass |
| 38 | 罗小黑 (`the-legend-of-hei`) | 386 | pass | pass | pass |
| 39 | 薰子 (`xunzi`) | 378 | pass | pass | pass |
| 40 | ZhangBoBo Freedom Lab (`zhangbobo-freedom-lab`) | 376 | pass | pass | pass |
| 41 | 月色安纳普尔纳 (`annapurna-peak-v0.1.1`) | 374 | pass | pass | pass |
| 42 | 三体-智子 (`12333`) | 372 | fail | warn | fail |
| 43 | Sunrise Coast Lab (`sunrise-coast-lab`) | 369 | pass | warn | pass |
| 44 | 不干活就没饭吃 (`work-xixia`) | 364 | pass | warn | pass |
| 45 | Go fight (`usr-loki.apple-light-guardian-popup-contrast`) | 358 | pass | pass | pass |
| 46 | 洛天依 (`myfirstheme`) | 357 | pass | pass | pass |
| 47 | 银河 Milky Way (`milky-way`) | 355 | pass | pass | pass |
| 48 | 超级赛亚人·觉醒 (`super-saiyan-awakening`) | 341 | pass | pass | pass |
| 49 | 青空の旅 (`aozora-no-tabi`) | 338 | pass | warn | pass |
| 50 | 月下松岚 (`anye`) | 338 | pass | pass | pass |
| 51 | 初音 · 星海舞台 (`hatsune-miku-cyan-stage`) | 331 | pass | pass | pass |
| 52 | 仙剑问情 (`xianjian`) | 330 | pass | warn | pass |
| 53 | 珊瑚穹顶之城 (`custom-1784270668889`) | 328 | pass | pass | pass |
| 54 | yangyang (`yangyang`) | 309 | pass | pass | pass |
| 55 | 斯卡蒂 | (`skadi-terminal`) | 303 | pass | pass | pass |
| 56 | 月影轻吻 (`moonlight-kiss`) | 299 | pass | pass | pass |
| 57 | BHIEICJGDEGAB 73sX6Aglmp (`bhieicjgdegab-73sx6aglmp`) | 299 | fail | warn | fail |
| 58 | 霓虹雨城 (`guiming.future.neon-rain-city`) | 291 | pass | pass | pass |
| 59 | 明日香 (`preview`) | 288 | pass | warn | pass |
| 60 | IMG 5509 (`img-5509`) | 284 | pass | pass | pass |
| 61 | summer time rei (`summer-time-rei`) | 276 | pass | pass | pass |
| 62 | 上杉绘梨衣（v2优化版） (`crimson-dusk`) | 274 | pass | pass | pass |
| 63 | Forever Kun Red (`ikun-red`) | 273 | pass | pass | pass |
| 64 | hacker IT (`hacker-it`) | 271 | pass | pass | pass |
| 65 | 雷姆 (`rem0`) | 263 | pass | pass | pass |
| 66 | 推理 · 报社小姐 (`miss-dirty-investigation`) | 261 | pass | warn | pass |
| 67 | 暮云风野 · Windbound Dusk (`windbound-dusk`) | 261 | pass | pass | pass |
| 68 | ChatGPT Image 2026年8月1日 02 47 08 (`chatgpt-image-2026-8-1-02-47-08`) | 255 | pass | pass | pass |
| 69 | 黑神话 (`wukong1`) | 255 | pass | warn | pass |
| 70 | 菈妮 (`ranni`) | 252 | pass | pass | pass |
| 71 | Green Meadow (`green-meadow`) | 251 | pass | pass | pass |
| 72 | 星潮（v2优化版） (`astral-tidev2`) | 245 | pass | pass | pass |
| 73 | 金笺书室 · Amber Letters (`amber-letters`) | 245 | pass | pass | pass |
| 74 | exec 89fd6732 b964 42fc a1d8 3ca1a153bdc8 (`exec-89fd6732-b964-42fc-a1d8-3ca1a153bdc8`) | 241 | pass | pass | pass |
| 75 | 雷姆酱 (`leimu`) | 237 | pass | warn | pass |
| 76 | 星际守望者 (`stellar-watcher`) | 235 | pass | pass | pass |
| 77 | 浪客行 宫本武藏 (`musashi`) | 230 | pass | pass | pass |
| 78 | 奥创（Ultron） (`ultron`) | 230 | pass | pass | pass |
| 79 | 阳光少年 (`sunny-boy`) | 228 | pass | pass | pass |
| 80 | 灵宠奇旅 (`usr-49e16299682ecef4aa46.spirit-trail`) | 226 | pass | warn | pass |
| 81 | 坚持 (`insist-on`) | 225 | pass | pass | pass |
| 82 | 伊蕾娜 (`elaina-witch`) | 223 | pass | pass | pass |
| 83 | 蓝灰夜航 · Navy Ice (`navy-ice`) | 221 | pass | pass | pass |
| 84 | 这就是金克斯 (`this-is-jenkins`) | 221 | pass | pass | pass |
| 85 | 蜘蛛侠 · 暗网徽记 (`spider-man-dark-web`) | 220 | pass | pass | pass |
| 86 | 渔女 (`fisher-girl`) | 220 | pass | warn | pass |
| 87 | 财神打工版 (`usr-49e16299682ecef4aa46.prosperity-mode`) | 219 | pass | pass | pass |
| 88 | 山海异闻 (`usr-49e16299682ecef4aa46.mountain-sea`) | 218 | pass | pass | pass |
| 89 | 我独自升级 (`shengji`) | 216 | fail | warn | fail |
| 90 | 见夕阳 (`jian-xi-yang-theme`) | 211 | pass | pass | pass |
| 91 | call BsIIsjqEQfnfkYb1LclWK1PO (`call-bsiisjqeqfnfkyb1lclwk1po`) | 211 | fail | warn | fail |
| 92 | macos 27 beta3 black teal gradient dark 高质量压缩版 (`macos-27-beta3-black-teal-gradient-dark`) | 207 | pass | pass | pass |
| 93 | 墨影江湖 (`usr-49e16299682ecef4aa46.ink-horizon`) | 207 | pass | warn | pass |
| 94 | Character 01 (`character-01`) | 202 | pass | pass | pass |
| 95 | 动漫少女素描 (`anime-girl-sketch-black-bg`) | 201 | pass | pass | pass |
| 96 | 蔚蓝档案-阿洛娜 (`blue-archive-arona`) | 200 | pass | warn | pass |
| 97 | 金陵晴川 · Jinling Sunlit (`jinling-sunlit`) | 200 | pass | pass | pass |
| 98 | 绘梨衣·星海绯梦 (`erii-celestial-dream`) | 199 | pass | warn | pass |
| 99 | 323 (`323`) | 195 | pass | pass | pass |
| 100 | wallpaper动态壁纸 风景 1 小羊（主页娶图） 来自小红书网页版 (`wallpaper-1`) | 195 | fail | warn | fail |
