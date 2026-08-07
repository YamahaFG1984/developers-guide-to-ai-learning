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

### 初始化项目

```bash
mkdir ai-for-devs && cd ai-for-devs
npm init -y
npm install express@5.1.0 ollama@0.6.2
```

**两个库的作用：**

- `express` — 快速搭建服务器
- `ollama`（ollama-js）— 集成 Ollama 最简单的方式

> `package.json` 的 `dependencies` 就像菜谱里的原料清单——只要有菜谱，随时能买齐原料。所以分享项目（比如通过 Git）时**不需要带上 `node_modules`**。

### server.mjs

**文件：`part1/getting_started/section1/server.mjs`**

```javascript
import express from "express";               // ❶
import { Ollama } from "ollama";

const app = express();                        // ❷

const ollama = new Ollama();                  // ❸

app.get('/', async (request, response) => {   // ❹
  response.type('text/plain');                // ❺

  const modelResponse = await ollama.generate({  // ❻
    model: 'llama3.2',
    prompt: "Can you simply say 'test'?"
  });

  console.log("\nAIMessage object response:\n")
  console.log(modelResponse);                 // 打印完整响应对象，看看里面有什么

  response.send(modelResponse.response);
});

app.listen(8000, () => {                      // ❼
  console.log(`Server is running on port 8000`);
});
```

**逐点解析：**

❶ 导入两个类：
- `express` — express 模块导出的顶层函数，本质是 Express 应用实例的构造器，提供路由管理、请求/响应处理、中间件能力
- `Ollama` — ollama-js 的类，负责与 Ollama API 交互

❷ 用 `express()` 初始化应用，赋给 `app`。

❸ 创建 `Ollama` 实例。

❹ `app.get` 配置**路由处理函数**：根 URL (`/`) 收到任何 GET 请求时调用。处理函数接收两个参数：
- `request` — 代表客户端发来的 HTTP 请求（头、参数、body 等）
- `response` — 代表服务器将返回的 HTTP 响应（发送数据、设置头等方法）

❺ 告诉客户端将返回纯文本。`response.type` 是设置 `Content-Type: text/plain` 的便捷方法。

> **为什么 Content-Type 重要？** 它标明数据的媒体类型（MIME type），客户端和服务器才能正确处理。这里告诉浏览器"别当 HTML 解析"，优化渲染。

❻ 调用 `generate` 方法，传入模型名和 prompt。这是**异步**方法，所以 `await`。完整响应生成后用 `response.send` 返回。

❼ 监听 8000 端口。

### 底层发生了什么

```
你的 REST 服务      Ollama            Ollama            Llama 3.2
 (Node)          (ollama-js)      (本地服务器)        (本地 LLM)
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
 response
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

### Express 侧：流式写回

Express 的 `Response` 对象提供 `write` 方法，可以边生成边发送：

```javascript
app.post('/', async (request, response) => {
  response.type('text/plain');

  const streamIterator = await ollama.generate({   // ❶ 返回迭代器
    model: 'llama3.2',
    prompt: "...",
    stream: true
  });

  for await (const chunk of streamIterator) {      // ❷ 每生成一个 chunk 就执行一次循环体
    response.write(chunk.response);                // ❸ 立刻写回客户端
  }

  response.end();
});
```

❷ `for await` 让循环逻辑在 LLM 每生成一个 chunk 时运行一次。
❸ `response.write` 把每个 chunk 的文本立刻发回客户端，直到完整响应结束。

注意这里改成了 **POST**——这样客户端可以在 body 里发送任意问题。

### CORS 中间件

浏览器客户端调用你的服务器时会遇到 **CORS（跨域资源共享）**。这是浏览器实现的安全标准，通过特殊 header 防止恶意行为。它会让请求莫名其妙地失败，即使你的代码看起来完全正确。

```bash
npm install cors@2.8.5
```

> ⚠️ **警告**：本书所有示例都使用**宽松的 CORS 配置**以便客户端调用，这是为了简化。**上生产前务必正确配置 CORS。**

### 完整的 server.mjs

**文件：`part1/getting_started/section2/server.mjs`**

```javascript
import express from "express";
import { Ollama } from "ollama";
import cors from "cors";

const app = express();

app.use(cors());                    // ❶ CORS 中间件
app.use(express.json());            // ❶ JSON 解析中间件

const ollama = new Ollama();

app.post('/', async (request, response) => {
  response.type('text/plain');

  const body = request.body;        // ❷ 已被 express.json 解析

  const streamIterator = await ollama.generate({
    model: 'llama3.2',
    prompt: body.question,          // ❸ 用客户端传来的问题作为 prompt
    stream: true
  });

  for await (const chunk of streamIterator) {
    response.write(chunk.response);
  }

  response.end();
});

app.listen(8000, () => {
  console.log(`Server is running on port 8000`);
});
```

❶ **Express 中间件**提供了一种简单方式，在你的代码执行前后对请求和响应做修改。
- `cors()` 自动添加处理 CORS 所需的请求/响应 header
- `express.json()` 自动解析进来的 JSON，结果放在 `request.body`

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
| 服务端流式写回 | `response.write(chunk)` + `response.end()` |
| 客户端读流 | `response.body.pipeThrough(new TextDecoderStream()).getReader()` |
| 跨域 | `app.use(cors())` |
| 解析 JSON body | `app.use(express.json())` |

---

## 练习

1. **看看 `Ollama` 类上的 `chat` 方法。** 试着改造示例调用它，把 prompt 作为 **message 数组**的一部分传入。（后续章节会详细讲 message 数组。）
2. **在流式过程中 `console.log(chunk)` 整个对象**，发起一次请求，观察 Ollama 随每个 chunk 返回的数据。这些是 `GenerateResponse` 类的属性，它们的用途在后面会变得清晰。

---

**上一章**：[第 1 章 · 理解大语言模型](./ch01-理解大语言模型.md)
**下一章**：[第 3 章 · LLM 与 API 的 Python 要点](./ch03-Python要点.md)
