<h1 align="center">
mail2telegram
</h1>

<p align="center">
 <br> <a href="../README.md">English</a> | 中文
</p>
<p align="center">
 <em>使用 Telegram 机器人获取您的临时电子邮件..</em>
</p>

![](./social_preview.png)

---

本项目是 [TBXark/mail2telegram](https://github.com/TBXark/mail2telegram) 的一个 Fork，增加了 Telegram 小程序邮件列表、支持在小程序中进行更多操作、更好的 HTML 预览、支持了 Ollama API。

---

这是一个基于 Cloudflare Email Routing Worker 的 Telegram Bot，能够将邮件转换成 Telegram 消息。你可以将任意前缀的收件人的邮件转发到 Bot，从而拥有一个无限地址的临时邮箱 Bot。

<details>
<summary>点击查看Demo</summary>
<img style="max-width: 600px;" alt="image" src="example.png">
</details>

## 安装流程

### 0. 配置 Telegram

1. 创建 bot 获得 token，使用`@BotFather > /newbot`，创建一个机器人然后复制 token。
2. 调用 `https://project_name.user_name.workers.dev/init` 即可绑定 Webhook，查看返回结果确认绑定状态。
3. 为了使用 Telegram 小程序你必须得设置隐私政策，请访问 `@BotFather > /mybots > （选择一个） > 编辑机器人 > 编辑隐私政策`，然后设置成 telegram 小程序默认的隐私政策：`https://telegram.org/privacy-tpa`

### 1. 部署 Workers

#### 1.1 使用命令行部署

1. 克隆项目：

`git clone git@github.com:TBXark/mail2telegram.git` 2. 复制配置模板并修改为你自己的 Telegram 配置：

`cp wrangler.example.jsonc wrangler.jsonc` 3. 部署：

`pnpm & pnpm pub`

### 2. 配置 Cloudflare Email Routing

1. 按照官方教程配置 [Cloudflare Email Routing](https://blog.cloudflare.com/zh-cn/introducing-email-routing-zh-cn/)
2. 在 `Email Routing - Routing Rules` 中，将 `Catch-all address` 的 action 改成 `Send to a Worker:mail2telegram`，把所有剩余的邮件都转发到该 worker。
3. 如果将 `Catch-all address` 设置成 workers 后就无法将剩余所有邮件转发到你自己的邮箱。如果你需要备份邮件，只需在 worker 环境变量中的 `FORWARD_LIST` 填入你的备份邮箱即可。
4. `FORWARD_LIST` 中的邮箱地址应在 `Cloudflare Dashboard - Email Routing - Destination addresses` 中添加认证后才能收到邮件。

### 3. 绑定 Telegram Webhook

调用 `https://project_name.user_name.workers.dev/init` 以绑定 Webhook，查看返回结果确认绑定状态。

## 配置

位置：Workers 和 Pages - 你的 worker 名称 - 设置 - 变量

<!-- prettier-ignore -->
| KEY | 描述 |
|:- |:- |
| TELEGRAM_ID | Bot 发送目的地的 Chat ID（如你自己的 Telegram 账号 ID），可通过 bot 的 `/id` 指令获取，通常为一串数字，群组以 -100 开头，多个 ID 用英文逗号分隔 |
| TELEGRAM_TOKEN | Telegram Bot Token，例如：`7123456780:AAjkLAbvSgDdfsDdfsaSK0` |
| DOMAIN | Workers 的域名，例如：`project_name.user_name.workers.dev` |
| FORWARD_LIST | 备份邮件，可转发到自己的邮箱备份，留空则不转发，多个邮箱用英文逗号分隔 |
| ~~WHITE_LIST~~ | **即将废弃，改用内置小程序进行编辑**，发件人白名单，一个正则表达式或邮箱地址数组转字符串，例：`[\".*@10086\\.cn\"]` |
| ~~BLOCK_LIST~~ | **即将废弃，改用内置小程序进行编辑**，发件人黑名单，一个正则表达式或邮箱地址数组转字符串 |
| BLOCK_POLICY | 可选值 `reject,forward,telegram`，用英文逗号分隔。`reject` 表示拒收邮件，`forward` 表示不转发到备份邮箱，`telegram` 表示不推送到 Telegram。默认 `telegram` |
| MAIL_TTL | 邮件缓存保存时间（秒），默认为一天，过期后邮件将无法预览，请注意备份 |
| WORKERS_AI_MODEL | Workers AI 模型名称。绑定 `AI` 服务并设置此值后，邮件总结将优先使用 Workers AI |
| OPENAI_API_KEY | OpenAI API Key，未配置 Workers AI 时用于生成总结。若 `WORKERS_AI_MODEL` 和此变量都未配置则不会出现 `Summary` 按钮 |
| OPENAI_COMPLETIONS_API | 可自定义 API，默认值为 `https://api.openai.com/v1/chat/completions` |
| OPENAI_CHAT_MODEL | 可自定义模型，默认值为 `gpt-4o-mini` |
| OLLAMA_API_ENDPOINT | Ollama API 端点 URL（如 `http://localhost:11434/api/chat`）。设置后可用本地 Ollama 进行邮件总结。优先级：Workers AI > OpenAI > Ollama |
| OLLAMA_MODEL | Ollama 总结用模型名称，默认 `llama3.2` |
| OLLAMA_API_KEY | Ollama 实例需要认证时的 API key，本地实例可留空 |
| AUTO_SUMMARY | 设置为 `true` 时新邮件到达自动生成 AI 总结，点击“AI 总结”按钮时可更快响应。默认关闭 |
| SUMMARY_TARGET_LANG | 总结的目标语言，默认 `english` |
| GUARDIAN_MODE | 守护模式，默认关闭，开启请填 `true` |
| MAX_EMAIL_SIZE | 最大邮件大小（字节），超出后根据 `MAX_EMAIL_SIZE_POLICY` 处理。主要防止附件过大导致 worker 超时。默认 512*1024 |
| MAX_EMAIL_SIZE_POLICY | 可选值 `unhandled`、`truncate`、`continue`。`unhandled` 只返回邮件头不解析正文，`truncate` 截断正文只解析允许大小，`continue` 不限制大小。默认 `truncate`。仅影响 Telegram 推送，不影响邮件转发 |
| RESEND_API_KEY | Resend API Key，https://resend.com/docs/introduction，用于邮件回复 |
| DB | 在 `KV 命名空间绑定` 处将数据库绑定到 worker，变量名必须为 `DB`，KV 命名空间选新建的任意 KV |

## Telegram 小程序

旧版命令管理黑白名单已废弃，现在通过小程序管理。环境变量中的黑白名单无法在小程序中显示和修改。

> 使用小程序需重新调用 `/init` 接口绑定指令。

<!-- prettier-ignore -->
| 黑名单 | 白名单 | 名单测试 |
|:- |:- |:- |
| ![image](./tma_block_list.png) | ![image](./tma_white_list.png) | ![image](./tma_test_address.png) |

## 使用说明

默认消息结构如下：

```
[Subject]

-----------
From : [sender]
To: [recipient]

(Preview)(Summary)(Text)(HTML)
```

### 邮件预览

当邮件转发通知到 Telegram 时，只有标题、发件人、收件人和四个按钮。

1. `Preview` 模式：可在 bot 中直接预览纯文本邮件，但有 4096 字符限制。
2. `Summary` 模式：绑定 Workers AI 并设置 `WORKERS_AI_MODEL` 后由 Workers AI 生成总结；否则配置 `OPENAI_API_KEY` 时用 OpenAI，总结按钮优先级为 Workers AI > OpenAI > Ollama（如配置了 OLLAMA_API_ENDPOINT）。三者都未配置时不显示 `Summary` 按钮。
3. `TEXT` 模式：用网页查看纯文本邮件，可阅读超长邮件。
4. `HTML` 模式：可查看富文本邮件，但可能包含脚本或追踪链接，仅在确认安全时使用。

### 安全与邮件缓存

1. `MAIL_TTL`：为安全起见，超出缓存时间后按钮跳转链接无法打开。可通过环境变量调整过期时间。
2. 由于 Workers 限制，邮件（尤其带大附件）可能导致函数超时和多次重试，可能收到重复通知。建议在 FORWARD_LIST 添加备份邮箱防止邮件丢失。
3. 开启 `GUARDIAN_MODE` 可减少重复消息干扰，提高 worker 成功率，但会消耗更多 KV 写入次数，建议按需开启。

### 黑名单与白名单

黑白名单匹配规则如下（以白名单为例）：

1. 先从环境变量读取 `WHITE_LIST` 转为数组，再从 KV 读取 `WHITE_LIST` 转为数组，合并后得到完整规则。
2. 匹配时先判断数组元素与待匹配字符串是否相等，相等则匹配成功；否则将元素转为正则表达式再匹配，成功则返回成功。
3. 所有元素都匹配失败则返回失败。

生成正则 JSON 数组字符串可用此工具（含 demo）：[regexs2jsArray](https://codepen.io/tbxark/full/JjxdNEX)

推荐用小程序管理黑白名单，方便增删。环境变量中的黑白名单即将废弃。

### 邮件附件

本 Bot 不支持附件展示。如需附件支持，可结合我的另一个项目 [testmail-viewer](https://github.com/TBXark/testmail-viewer)，用 `FORWARD_LIST` 将邮件转发到 testmail，即可用 [testmail-viewer](https://github.com/TBXark/testmail-viewer) 下载附件。

## 许可证

**mail2telegram** 以 MIT 许可证发布。[详见 LICENSE](../LICENSE) 获取详情。
