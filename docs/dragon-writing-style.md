# 《粉 v10》文风接入

来源：Ekibenya/dragon，提交 `cb606293cf900b61e309ae754e8f61ef1f684940`，
`st/tail-quiet.card.png` 的同名 JSON，版本 10。
JSON blob：`7f1da51e31d6a0c5a5451026aa0029fa2ceb7951`。

`dragon-writing-style-data.mjs` 保留 10 段通用系统文风章节与 6 条叙事世界书原文，
每段附 SHA-256；保留 6 段完整叙事示例，仅移除示例的异世界状态栏；保留末位指令的通用首段。
原卡与拆分源码的 system_prompt、post_history_instructions、mes_example、description、personality 已核对一致。
角色身份、族群生理、国家、开局、专属角色指令及面板格式没有作为文风导入；这些事实继续由 World 提供。

在预设页面默认启用“《粉》文风优先”，新设置与旧存档缺少此字段时均视为开启。
World 继续设置系统提示、作者注释、正典、NPC、玩家主权及状态栏；只有下列冲突语句按开关过滤。
文风适用范围明确限定为第一人称非玩家焦点、心声、对白与节奏，冲突时优先采用《粉》。
原生 Risu 的 character.depth_prompt（depth 0）在普通预设与自定义模板拼接后加入文风。
已有 depth_prompt 的内容放在文风之前，启用期间一起位于末尾；关闭时恢复其原始内容和深度。
不会把文风写入用户导入的原生 preset，也不会修改 NSFW 核心。

预设页面的“World 写作条目 · 与 Dragon 文风冲突”只列出 7 项，均默认关闭：

| 设置键 | 冲突条目 |
| --- | --- |
| chain | 每回完成固定心理步骤 |
| progress | 每回必须产生实质推进 |
| brackets | 心声固定使用（）与【】 |
| singleFocus | 每回只允许一个内心焦点 |
| noQuestions | 结尾禁止提问 |
| minLength | 最低字数与不足时重写 |
| repeatGuard | 重复台词自动重写 |

选择保存在 nativeState.worldWritingRules，独立于 Dragon 总开关。关闭时仅移除
world-writing-rules.mjs 中逐条列出的冲突语句；非冲突要求原样保留。
手动勾选的条目恢复发送，并在 Dragon 文风之后作为玩家明确选择的对应例外生效。
系统提示、作者注释、自动开局任务、隐藏规划器同步过滤；玩家的正常输入与历史不会过滤。
全部勾选时，原始 World 写作文本完整恢复。默认不会把新字段写进或修改原生 preset。

隐藏剧情规划保留原机制和 JSON 协议。minChars 仅在勾选 minLength 时使用原有最低字数；
三字以上台词与最近三回文本匹配的机械重写仅在勾选 repeatGuard 时开启。
时代检查与空白回复处理始终保留，避免无新含义复述的写作要求也保留。
模型最终如何遵循指令仍需用玩家的模型观察，
提示词末位与明确优先级不是模型数值权重，也不保证不同平台逐字相同。

验证（从仓库根目录运行，依赖 jsdom、fake-indexeddb）：

```sh
WORLD_QA_MODULES=/path/to/node_modules node scripts/check-risu-native.mjs
WORLD_QA_MODULES=/path/to/node_modules node scripts/check-dragon-writing-style.mjs
node scripts/check-writing-style-cache.mjs
node scripts/check-world-writing-rules.mjs
```

文风测试运行真实 Risu 内核和 World 准备函数，并用本地响应替身捕获 HTTP 请求：
覆盖原文哈希、末位顺序、模板遗漏 authornote、重复回合、时代切换、关闭/恢复/重载、
7 个界面开关到真实提示词的逐项启停、保存/重载、规划过滤及短回复/重复台词的重写开关。
源文本测试验证所有原始冲突语句仍可恢复、无关规则不变。没有调用付费模型，也没有做实际文风 A/B 评分。

缓存升级：设置模块、界面模块、文风模块及其数据、headless 入口和 Felinia 适配器
使用一致的新版本 URL。World 代码与两个可变入口响应改为 revalidate；Service Worker
对代码请求显式使用 cache: no-cache，避免“网络优先”实际仍命中一年前端 HTTP 缓存。
缓存测试从 HTML 遍历上述依赖链，并模拟保留旧 immutable 响应的浏览器升级。
