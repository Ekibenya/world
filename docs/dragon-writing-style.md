# 《粉 v10》文风接入

来源：Ekibenya/dragon，提交 `cb606293cf900b61e309ae754e8f61ef1f684940`，
`st/tail-quiet.card.png` 的同名 JSON，版本 10。
JSON blob：`7f1da51e31d6a0c5a5451026aa0029fa2ceb7951`。

`dragon-writing-style-data.mjs` 保留 10 段通用系统文风章节与 6 条叙事世界书原文，
每段附 SHA-256；保留 6 段完整叙事示例，仅移除示例的异世界状态栏；保留末位指令的通用首段。
原卡与拆分源码的 system_prompt、post_history_instructions、mes_example、description、personality 已核对一致。
角色身份、族群生理、国家、开局、专属角色指令及面板格式没有作为文风导入；这些事实继续由 World 提供。

在预设页面默认启用“《粉》文风优先”，新设置与旧存档缺少此字段时均视为开启。
World 仍设置自己的系统提示、作者注释、正典、NPC、玩家主权及状态栏。
文风适用范围明确限定为第一人称非玩家焦点、心声、对白与节奏，冲突时优先采用《粉》。
原生 Risu 的 character.depth_prompt（depth 0）在普通预设与自定义模板拼接后加入文风。
已有 depth_prompt 的内容放在文风之前，启用期间一起位于末尾；关闭时恢复其原始内容和深度。
不会把文风写入用户导入的原生 preset，也不会修改 NSFW 核心。

隐藏剧情规划保留原机制和 JSON 协议，同时接收文风优先级说明。
启用时 minChars 为 0，仅跳过最低字数重写；时代检查、对白复读检查与空白回复处理仍保留。
关闭时恢复 World 原有最低字数设置。模型最终如何遵循指令仍需用玩家的模型观察，
提示词末位与明确优先级不是模型数值权重，也不保证不同平台逐字相同。

验证（从仓库根目录运行，依赖 jsdom、fake-indexeddb）：

```sh
WORLD_QA_MODULES=/path/to/node_modules node scripts/check-risu-native.mjs
WORLD_QA_MODULES=/path/to/node_modules node scripts/check-dragon-writing-style.mjs
node scripts/check-writing-style-cache.mjs
```

文风测试运行真实 Risu 内核和 World 准备函数，并用本地响应替身捕获 HTTP 请求：
覆盖原文哈希、末位顺序、模板遗漏 authornote、重复回合、时代切换、关闭/恢复/重载、
界面开关、规划约束及短回复不重试。没有调用付费模型，也没有做实际文风 A/B 评分。

缓存升级：设置模块、界面模块、文风模块及其数据、headless 入口和 Felinia 适配器
使用一致的新版本 URL。World 代码与两个可变入口响应改为 revalidate；Service Worker
对代码请求显式使用 cache: no-cache，避免“网络优先”实际仍命中一年前端 HTTP 缓存。
缓存测试从 HTML 遍历上述依赖链，并模拟保留旧 immutable 响应的浏览器升级。
