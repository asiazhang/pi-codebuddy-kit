# pi-tencent-copilot

[pi](https://github.com/earendil-works/pi-mono) coding agent 的模型提供方扩展：接入腾讯 CodeBuddy 网关（`https://copilot.tencent.com/v2`）。

注册 `tencent-copilot` provider，内置 33 个模型快照（Claude / GPT / Gemini / GLM / MiniMax / Kimi / Hunyuan / DeepSeek），支持图片输入、推理档位（effort）、工具调用。模型目录与网关兼容性参数于 2026-08-18 在线上网关逐模型验证。

## 安装

```sh
pi install git:github.com/asiazhang/pi-tencent-copilot
```

或临时试用（不写入设置）：

```sh
pi -e git:github.com/asiazhang/pi-tencent-copilot
```

## 配置 API key

在 CodeBuddy 个人密钥页创建 API key，然后在 pi 会话里登录，key 会存入 `~/.pi/agent/auth.json`：

```
/login
```

选择 `tencent-copilot`，粘贴 `ck_...` 开头的 key 即可。`/logout` 可移除存储的 key。

## 更新扩展

更新已安装的扩展包（拉取远程最新代码）：

```sh
pi update --extension git:github.com/asiazhang/pi-tencent-copilot
```

或一次性更新所有已安装的扩展包：

```sh
pi update --extensions
```

更新后重启 pi 会话生效。卸载用 `pi remove git:github.com/asiazhang/pi-tencent-copilot`。

## 使用

安装并配置 key 后，在 pi 会话里用 `/model` 选择 `tencent-copilot/<model>`，或命令行指定：

```sh
pi --model tencent-copilot/glm-5.3-ioa
```

设为默认模型（`~/.pi/agent/settings.json`）：

```json
{
  "defaultProvider": "tencent-copilot",
  "defaultModel": "glm-5.3-ioa"
}
```

## 网关兼容性说明

网关是 OpenAI Chat Completions 兼容接口，但有若干差异，扩展已逐一适配：

| 适配项 | 说明 |
| --- | --- |
| 请求头 | 携带 CodeBuddy CLI 身份头（`x-codebuddy-request`、`x-ide-type/name/version` 等） |
| `max_tokens` | 网关不认 `max_completion_tokens` |
| `system` 角色 | 不使用 `developer` 角色 |
| 不发 `store` / `strict` | 网关不接受这两个字段 |
| 推理档位 | `reasoning_effort` 支持 low / medium / high / xhigh / max；GPT-5.5 / 5.4 / 5.3-Codex 拒绝 max；Claude Haiku 4.5 不支持 effort 参数 |

## 开发

克隆后直接编辑 `extensions/tencent-copilot.ts`，本地试运行：

```sh
pi -e ./path/to/pi-tencent-copilot
```

类型检查与 lint（Biome）：

```sh
npm install
npm run typecheck
npm run lint
```

预览自定义 footer（默认启用）的渲染效果：

```sh
npm run footer-preview
```

命令、格式化规则与编辑纪律见 [AGENTS.md](AGENTS.md)。

模型快照以元组数组维护（`SNAPSHOT`），新增模型只需加一行。

## License

MIT
