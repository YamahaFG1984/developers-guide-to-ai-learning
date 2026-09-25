# 第 2 章 · 构建你的第一个 LLM 应用（JavaScript）

> 对应代码：
> - `part1/getting_started/section1/` — 调用 LLM
> - `part1/getting_started/section2/` — 流式返回
> - `part1/client/` — Vite + React 前端

## 本章目标

学完你将能够：

1. 捕获用户输入并构建 prompt
2. 通过 API 把 prompt 发给 LLM
3. 把 LLM 响应**流式**返回给用户

架构对照：

```
ChatGPT                    ←→   你的 REST 服务
   │                                │
OpenAI API                      Ollama API
   │                                │
LLM (GPT-5.x)                   LLM (Llama 3.2, 本地)
```

---

## 2.1 环境准备

### 检查硬件

Ollama 用的是**量化模型（quantized models）**——牺牲一点点精度换取性能提升和更低硬件要求（第 7 章「Dissecting Model Names」详述）。

| 模型 | 磁盘 | 需要的专用内存 |
| --- | --- | --- |
| Llama 3.2 **3B**（本书默认） | 2 GB | 约 6 GB RAM |
| Llama 3.2 **1B**（低配替代） | 1.3 GB | 约 2 GB RAM |

> 💡 你也会看到 **SLM（small language model，小语言模型）** 这个词，指能在普通硬件上跑的轻量模型。
>
> 用 1B 也能跑完所有示例，只是结果会有差异——这正是有趣的地方：观察不同规模模型的行为差异。

### 安装 Ollama

从 https://ollama.com 下载安装（书中示例基于 Ollama 0.12.5）。安装后 CLI 会自动加入系统 PATH。

```bash
ollama --version
```

**常用命令：**

| 命令 | 作用 |
| --- | --- |
| `ollama serve` | 启动本地 Ollama 服务，并实时打印你的应用发来的请求日志 |
| `ollama list` | 列出本机已下载的模型 |
| `ollama pull <model>` | 下载指定模型 |
| `ollama run <model>` | 下载（如需要）并启动与该模型的本地会话 |

**启动服务：**

```bash
ollama serve
```

**另开一个终端下载并运行模型：**

```bash
ollama run llama3.2        # 3B
# 或低配版
ollama run llama3.2:1b
```

进入会话后可以看看有哪些命令：

```
>>> /?
Available Commands:
  /set            Set session variables
  /show           Show model information
  /load <model>   Load a session or model
  /save <model>   Save your current session
  /clear          Clear session context
  /bye            Exit
  /?, /help       Help for a command

Use """ to begin a multi-line message.
```

**试着提问：**

```
>>> Who are the Beatles?
The Beatles were a British rock band that formed in Liverpool, England in 1960...
```

> **📌 LM Studio：图形界面版的 Ollama 替代品**
>
> Ollama 是 CLI 优先、脚本友好的工具，GUI 很简陋。LM Studio 提供干净的图形界面 + API + 命令行工具，支持 Hugging Face、Mistral、Llama 3 等模型，自动检测 CPU/GPU 选择最优后端，还提供 **OpenAI 兼容的 API 端点**。本书用 Ollama，但你可以去 https://lmstudio.ai 了解 LM Studio。

### 安装 Node.js

从 https://nodejs.org 下载（书中示例基于 Node.js 24.8.0）。

```bash
node -v
```

---

## 2.2 Section 1：调用 LLM（非流式）

> 📌 **本仓库用 Hono 替代了原书的 Express。** 原书第 2 章用 Express 5；这里的示例已改写为 [Hono](https://hono.dev)。它直接使用 Web 标准的 `Request` / `Response`，同一份代码能跑在 Node.js、Bun、Deno、Cloudflare Workers 上，CORS 和流式响应都是内置的。概念与原书完全一致，文末有 Express ↔ Hono 对照表。

### 初始化项目

```bash
mkdir ai-for-devs && cd ai-for-devs
npm init -y
npm install hono@4 @hono/node-server@2 ollama@0.6.2
```

**三个库的作用：**

- `hono` — 轻量 Web 框架，负责路由、请求和响应
- `@hono/node-server` — 让 Hono 应用跑在 Node.js 上的适配器
- `ollama`（ollama-js）— 集成 Ollama 最简单的方式

> `package.json` 的 `dependencies` 就像菜谱里的原料清单——只要有菜谱，随时能买齐原料。所以分享项目（比如通过 Git）时**不需要带上 `node_modules`**。

### server.mjs

**文件：`part1/getting_started/section1/server.mjs`**

```javascript
import { Hono } from "hono";                  // ❶
import { serve } from "@hono/node-server";
import { Ollama } from "ollama";

const app = new Hono();                       // ❷

const ollama = new Ollama();                  // ❸

app.get('/', async (c) => {                   // ❹
  const modelResponse = await ollama.generate({  // ❺
    model: 'llama3.2',
    prompt: "Can you simply say 'test'?"
  });

  console.log("\nAIMessage object response:\n")
  console.log(modelResponse);                 // 打印完整响应对象，看看里面有什么

  return c.text(modelResponse.response);      // ❻
});

serve({ fetch: app.fetch, port: 8000 }, (info) => {   // ❼
  console.log(`Server is running on port ${info.port}`);
});
```

**逐点解析：**

❶ 导入三样东西：
- `Hono` — Hono 应用类，提供路由管理、请求/响应处理、中间件能力
- `serve` — `@hono/node-server` 提供的函数，把 Hono 应用挂到 Node.js 的 HTTP 服务上
- `Ollama` — ollama-js 的类，负责与 Ollama API 交互

❷ 用 `new Hono()` 创建应用，赋给 `app`。

❸ 创建 `Ollama` 实例。

❹ `app.get` 配置**路由处理函数**：根 URL (`/`) 收到任何 GET 请求时调用。处理函数只接收一个参数 `c`——**上下文（Context）**：
- `c.req` — 代表客户端发来的 HTTP 请求（头、参数、body 等）
- `c.text()` / `c.json()` / `c.html()` 等 — 构造要返回的 HTTP 响应

❺ 调用 `generate` 方法，传入模型名和 prompt。这是**异步**方法，所以 `await`。

❻ `c.text()` 返回纯文本响应，并自动设置 `Content-Type: text/plain`。**在 Hono 里处理函数要 `return` 一个响应**，而不是调用 `send`。

> **为什么 Content-Type 重要？** 它标明数据的媒体类型（MIME type），客户端和服务器才能正确处理。这里告诉浏览器"别当 HTML 解析"，优化渲染。

❼ `app.fetch` 就是整个 Hono 应用——一个"传进 Request、返回 Response"的函数。`serve` 把它接到 Node.js 上并监听 8000 端口。换成 Bun、Deno 或 Workers 时，只需换掉这一段启动代码。

### 底层发生了什么

```
你的 REST 服务      Ollama            Ollama            Llama 3.2
 (Hono/Node)     (ollama-js)      (本地服务器)        (本地 LLM)
    │
HTTP GET /
    │──generate()──→│
    │  {model, prompt}
    │               │──HTTP POST /api/generate──→│
    │               │  {model, prompt}           │──prompt──→│
    │               │                            │           │
    │               │                            │←─response─│
    │               │←──── JSON response ────────│
    │←GenerateResponse│
 c.text(...)
```

### 运行测试

```bash
node server.mjs
# Server is running on port 8000
```

浏览器打开 http://localhost:8000 —— 你会看到 Llama 3.2 返回的 `Test.`

---

## 2.3 Section 2：流式响应

### 为什么要流式

ChatGPT 那个逐字打出来的效果让它**感觉**很快。没有它，UI 会慢得难以忍受。

> OpenAI 巧妙地把 LLM 的一个缺点（文本生成慢）变成了一个迷人的 UI 效果。

原理：LLM 本来就是逐 token 生成的。**流式（streaming）就是在 token 生成时立刻捕获并分块（chunk）发回调用方。** chunk 大小因模型而异。当你的 prompt 和调用链变复杂时，流式对性能至关重要。

```
"Who are the Beatles?"
        ↓
      LLM
        ↓
[The Beatles are] [an English] [rock band who...]
       响应 chunks
```

### Ollama 侧：开启流式

```javascript
const streamIterator = await ollama.generate({
  model: 'llama3.2',
  prompt: "Can you tell me about the Beatles in 500 words or less?",
  stream: true                      // ❶ 关键
});
```

### Hono 侧：流式写回

Hono 内置了 `hono/streaming` 模块，`streamText` 帮你返回一个可以边生成边发送的纯文本响应：

```javascript
import { streamText } from "hono/streaming";

app.post('/', async (c) => {
  const streamIterator = await ollama.generate({   // ❶ 返回迭代器
    model: 'llama3.2',
    prompt: "...",
    stream: true
  });

  return streamText(c, async (stream) => {
    for await (const chunk of streamIterator) {    // ❷ 每生成一个 chunk 就执行一次循环体
      await stream.write(chunk.response);          // ❸ 立刻写回客户端
    }
  });                                              // ❹ 回调结束，响应自动关闭
});
```

❷ `for await` 让循环逻辑在 LLM 每生成一个 chunk 时运行一次。
❸ `stream.write` 把每个 chunk 的文本立刻发回客户端。
❹ `streamText` 自动设置 `Content-Type: text/plain` 和分块传输（`Transfer-Encoding: chunked`），回调函数结束时响应随之结束，不需要手动 `end()`。

注意这里改成了 **POST**——这样客户端可以在 body 里发送任意问题。

### CORS 中间件

浏览器客户端调用你的服务器时会遇到 **CORS（跨域资源共享）**。这是浏览器实现的安全标准，通过特殊 header 防止恶意行为。它会让请求莫名其妙地失败，即使你的代码看起来完全正确。

Hono 自带 `cors` 中间件（`hono/cors`），**不需要另装包**。

> ⚠️ **警告**：本书所有示例都使用**宽松的 CORS 配置**以便客户端调用，这是为了简化。**上生产前务必正确配置 CORS。**

### 完整的 server.mjs

**文件：`part1/getting_started/section2/server.mjs`**

```javascript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText } from "hono/streaming";
import { serve } from "@hono/node-server";
import { Ollama } from "ollama";

const app = new Hono();

app.use(cors());                    // ❶ CORS 中间件

const ollama = new Ollama();

app.post('/', async (c) => {
  const body = await c.req.json();  // ❷ 读取并解析 JSON 请求体

  const streamIterator = await ollama.generate({
    model: 'llama3.2',
    prompt: body.question,          // ❸ 用客户端传来的问题作为 prompt
    stream: true
  });

  return streamText(c, async (stream) => {
    for await (const chunk of streamIterator) {
      await stream.write(chunk.response);
    }
  });
});

serve({ fetch: app.fetch, port: 8000 }, (info) => {
  console.log(`Server is running on port ${info.port}`);
});
```

❶ **Hono 中间件**像洋葱一样包在处理函数外面，能在请求进来之前、响应出去之后做修改。`cors()` 会直接回复浏览器的预检（OPTIONS）请求，并给响应加上 `Access-Control-Allow-*` 头。

❷ Hono 不需要单独的 JSON 解析中间件：在处理函数里 `await c.req.json()` 就能拿到解析好的对象。

❷❸ 客户端发来：

```json
{ "question": "Can you tell me about the Beatles in 500 words or less?" }
```

服务端直接取 `body.question` 作为 prompt。

### 测试

```bash
node server.mjs
```

```bash
curl -N -X POST -H "Content-Type: application/json" -d \
  '{"question": "Can you tell me about the Beatles in 500 words or less?"}' \
  http://localhost:8000
```

> `-N` 关闭 curl 的输出缓冲，你才能看到流式效果。

---

## 2.4 前端：用 fetch 消费流

**文件：`part1/client/src/App.jsx`**

核心思路：`fetch` 让你把响应体当作 `ReadableStream` 读取。

```javascript
const url = 'http://localhost:8000';
const response = await fetch(url);          // ❶ 响应体是 ReadableStream
const reader = response.body.getReader();   // ❷ 拿到 reader 逐块读取
```

**解码并渲染：**

```javascript
const fetchData = async () => {
  setLlmResponse('Please be patient, calling a local LLM can take some time...');

  const url = 'http://localhost:8000';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question })
  });

  llmResponseProgress = '';

  const reader = response.body
    .pipeThrough(new TextDecoderStream())   // ❶ 字节流 → 文本流
    .getReader();

  while (true) {
    const { done, value } = await reader.read();

    renderResponseChunk(value);             // ❷ 渲染这一块

    if (done) {
      return;
    }
  }
};
```

❶ 收到的 chunk 是**字节流**，通过 `TextDecoderStream` 管道转成实际文本。
❷ `renderResponseChunk` 把累积的文本通过 React state 渲染出来：

```javascript
let llmResponseProgress = '';

const renderResponseChunk = (chunk) => {
  llmResponseProgress += chunk || '';
  if (llmResponseProgress) {
    setLlmResponse(llmResponseProgress);
  }
};
```

响应用 `ReactMarkdown` 渲染，这样 LLM 输出的 markdown 格式能正确显示：

```jsx
<ReactMarkdown className="llm-response">
  {llmResponse}
</ReactMarkdown>
```

### 运行前端

```bash
cd part1/client
npm install
npm run dev
```

---

## 本章小结

你构建了一个能把服务端 LLM 响应流式推送到客户端的 REST 服务。这不仅能提示 AI 生成响应，还是后续所有章节的基础。

**关键 API 速查：**

| 场景 | API |
| --- | --- |
| 调用 LLM | `ollama.generate({ model, prompt })` |
| 开启流式 | 加 `stream: true`，返回值变成异步迭代器 |
| 服务端流式写回 | `return streamText(c, async (stream) => { await stream.write(chunk) })` |
| 客户端读流 | `response.body.pipeThrough(new TextDecoderStream()).getReader()` |
| 跨域 | `app.use(cors())`（`hono/cors` 内置） |
| 解析 JSON body | `await c.req.json()` |

**对照原书：Express ↔ Hono**

| 做什么 | 原书 Express | 本仓库 Hono |
| --- | --- | --- |
| 安装 | `npm install express cors` | `npm install hono @hono/node-server` |
| 创建应用 | `const app = express()` | `const app = new Hono()` |
| 处理函数 | `(request, response) => { … }` | `(c) => { … return 响应 }` |
| 返回纯文本 | `response.type('text/plain')` + `response.send(x)` | `return c.text(x)` |
| 读 JSON 请求体 | `app.use(express.json())` 后读 `request.body` | `await c.req.json()` |
| 跨域 | 另装 `cors` 包，`app.use(cors())` | 内置 `hono/cors`，`app.use(cors())` |
| 流式写回 | `response.write(chunk)` … `response.end()` | `streamText(c, async (stream) => { await stream.write(chunk) })` |
| 启动 | `app.listen(8000)` | `serve({ fetch: app.fetch, port: 8000 })` |

---

## 练习

1. **看看 `Ollama` 类上的 `chat` 方法。** 试着改造示例调用它，把 prompt 作为 **message 数组**的一部分传入。（后续章节会详细讲 message 数组。）
2. **在流式过程中 `console.log(chunk)` 整个对象**，发起一次请求，观察 Ollama 随每个 chunk 返回的数据。这些是 `GenerateResponse` 类的属性，它们的用途在后面会变得清晰。

---

**上一章**：[第 1 章 · 理解大语言模型](./ch01-理解大语言模型.md)
**下一章**：[第 3 章 · LLM 与 API 的 Python 要点](./ch03-Python要点.md)
