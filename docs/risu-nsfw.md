# Risu 原生 NSFW / Jailbreak 接入

连接 AI 面板只显示「是否开启NSFW模式？」及 YES / NO。
YES / NO 直接读写 Risu database 的 `jailbreakToggle`。
默认提示词继续读取原生数据库，已有自定义文本与原生预设继续保留。
界面不展示技术名称或提示词编辑区。

## 对应源码

- 内嵌版本：`2026.8.250`。
- Upstream commit：`e565563a288ebe4c65b6099a1645ba477d1c84b4`。
- [原生开关](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/lib/SideBars/Toggles.svelte)：绑定 `DBState.db.jailbreakToggle`；模板识别包含 Jailbreak 条目以及 `text`、`innerFormat`、`defaultText` 中的 `{{jbtoggled}}`。
- [默认值来源](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/ts/storage/defaultPrompts.ts)：`defaultJailbreak = prebuiltPresets.OAI.jailbreak`。
- [原生预设](https://github.com/kwaroran/RisuAI/blob/e565563a288ebe4c65b6099a1645ba477d1c84b4/src/ts/process/templates/templates.ts)。当前默认内容为英语语言文学研究的 System note / OOC 文本；不是该文件中历史遗留的 `oldJailbreak`。

数据库缺省开关为 `false`。默认 Jailbreak 文本的 UTF-8 SHA-256：

```
97faaa796ad9198f1b98be468a2add4fc2932392e2c2d18eb8cc911e957dce65
```

此次修改没有改动、替换或删除 `core/res/runtime/risu/` 内的任何文件。
该目录的 76 个文件与修改前的 World commit
`91194ce7f0eee0f20c3659c4132fd37e09762be9` 逐字一致。
默认值、模板解析、宏、提示词排序、预设导入和发送流程继续使用现有运行库。

## 保存与生效

`risu-prompt-settings.mjs` 只适配 World 设置与原生数据库。
World 的 `guardianDragonSet.risu` 保存手动选择的开关、未裁剪的文本，
以及完整导入的原生 preset 对象（含模板、顺序和自定义字段）。
安装纪年重建数据库后，通过原生 `changeToPreset` 恢复预设，再恢复开关与手动文本。
原生预设导入在主菜单即可使用，无须先选纪年。

正文继续走 `FeliniaRisu.generateTurn` → 原生 `sendChat`。
适配层不追加第二份 Jailbreak、不强制改为末位，也不替换原生模板。
原生模板是否使用该开关、utility bot 等条件均保持原行为。
World 自有的 SillyTavern/纯文本预设列表仍按各条目的开关和位置生效。

## 验证

- 在 JSDOM / fake-indexeddb 环境加载实际内嵌模块，并调用实际 `sendChat({preview:true})`，未调用模型服务。
- 原生默认关闭、默认文本与 upstream 的摘要相同。
- 原生 formatting order 和 Jailbreak 模板：关闭时不注入，开启时注入，`{{char}}` 正常展开。
- 模板里的 `{{jbtoggled}}` 随开关返回 `0` / `1`。
- 原生预设导入、序列化、重新安装纪年、恢复：模板、自定义字段、开关和文本保留；明确保存的空字符串不被默认值替换。
- JavaScript 语法检查、静态构建通过；运行库目录无 diff。
- 浏览器验证环境无法访问本地服务器，因此本次未完成实际浏览器点击与视觉验证。
