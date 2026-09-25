# 第 3 章 · LLM 与 API 的 Python 要点

> 对应代码：`part1/getting_started_python/`

## 为什么转向 Python

JavaScript 能带你走很远（本书 GitHub 仓库也提供了部分示例的 JS 版本），但 **Python 拥有做重活的库和工具，是 AI 开发的首选语言**。从这章起，示例全部用 Python。

如果你不是 Python 开发者也别担心——书里会解释"Pythonic"的特殊语法。跟着做完全书示例，你会打下扎实的 Python 基础。

**本章任务：用 Python 重写第 2 章的例子。**

---

## 3.1 安装 Python 与库

```bash
python --version     # Mac/Linux 或特定版本时可能要用 python3
# Python 3.13.7      （书中示例测试版本）
```

Windows 上也可以用 Python launcher：`py --version`

**需要的库：**

- `fastapi` — 快速创建 REST 服务
- `ollama` — 调用 Ollama API 的 SDK

```bash
python -m pip install "fastapi[standard]"==0.119.0 ollama==0.6.0
```

> 💡 书中为简洁常写 `pip install`，但**推荐用 `python -m pip`**（或 `python3 -m pip`）——它确保库装进你实际运行示例的那个 Python 环境。

> **📌 Python 虚拟环境**
>
> 上面是全局安装，为了简单。Python 里一般推荐用**虚拟环境**隔离依赖：本质就是一个目录，专门装该项目的依赖，让不同项目能用不同版本的库而互不干扰。
>
> Python 开发者各有各的偏好，工具很多（`venv`、`conda`、`pyenv-virtualenv` 等）。本仓库 README 用的是 `pyenv` + `pyenv-virtualenv`：
>
> ```bash
> pyenv install 3.13.7
> pyenv virtualenv 3.13.7 developers-guide-to-ai-part1
> pyenv activate developers-guide-to-ai-part1
> python -m pip install -r requirements.txt
> ```
>
> 每一 Part 有独立的 `requirements.txt`，到新的 Part 时改一下 part 编号建新环境即可。

---

## 3.2 完整的 FastAPI 服务

**文件：`part1/getting_started_python/main.py`**

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ollama import Client

from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

client = Client()


class ChatRequest(BaseModel):
  question: str


def generate_stream(question: str):
  result = client.generate(stream=True, model="llama3.2", prompt=question)

  for chunk in result:
    if chunk.response:
      print('\nReturned GenerateResponse object for chunk:\n')
      print(chunk.model_dump_json(indent=2))

      yield chunk.response


@app.post("/")
def chat(chatRequest: ChatRequest):
  return StreamingResponse(
    generate_stream(chatRequest.question), media_type="text/plain")
```

监听 8000 端口（FastAPI 默认端口），处理 HTTP POST 请求。下面逐段拆解。

---

## 3.3 组件解析

```python
from fastapi import FastAPI                              # ❶
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from ollama import Client

app = FastAPI()                                          # ❷

app.add_middleware(                                      # ❸
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Client()                                        # ❹
```

❶ **四个导入的类：**

| 类 | 作用 |
| --- | --- |
| `FastAPI` | 创建和管理 FastAPI Web 应用的主类，是定义 API 端点、处理请求、配置行为的中心 |
| `StreamingResponse` | FastAPI 工具类，用于分块（而非一次性）向客户端发送大量数据——正好用来流式返回 LLM 响应 |
| `CORSMiddleware` | 和 Node 例子一样，FastAPI 提供自动处理 CORS 需求的中间件 |
| `Client` | 与本地 Ollama 实例托管的 LLM 通信的客户端 |

❷ 构造 FastAPI 服务器实例，赋给 `app`，用于配置服务器和定义 API。

❸ 添加 CORS 中间件。注意参数是**按名字指定**的（如 `allow_origins=["*"]`）——这是 Python 里常见的模式，尤其对可选参数。这个配置把服务器向所有浏览器客户端开放。

❹ 创建 Ollama `Client` 实例，默认配置即可。

---

## 3.4 定义 REST API（Pydantic + 装饰器）

```python
from pydantic import BaseModel          # ❶

class ChatRequest(BaseModel):           # ❷
    question: str

@app.post("/")                          # ❸
def chat(chatRequest: ChatRequest):     # ❹
    ...
```

❶ 额外导入 `BaseModel`。**Pydantic 不用单独安装**，它随 FastAPI 一起来。全书都会用到它。

❷ **Pydantic 让你轻松创建定义 REST API 请求/响应 JSON 结构的类（称为 model）。**
- `ChatRequest` 定义了期望的 JSON 请求体
- 继承自 `BaseModel`（Python 里括号就是继承语法）
- 一个 `str` 类型的 `question` 属性

`BaseModel` 给 `ChatRequest` 加了方法，能校验并把下面这段 JSON 转成类实例：

```json
{ "question": "Tell me about the Beatles." }
```

❹ `def` 关键字开始定义方法或函数。

❸ `@app.post("/")` **注解（装饰器）** 配置 `chat` 函数处理 REST 请求：

```
POST https://localhost:8000/

{ "question": "Who are the Beatles?" }
```

> 这看起来有点魔法，但全书会大量使用注解。**在 Python 里，注解提供了一种通过内联配置把你的代码与库/框架集成的简单方式。**

FastAPI 会：
- 把任何到 `/` 的 POST 请求路由到你的 `chat` 函数
- 查看 `chatRequest` 参数，用 Pydantic model 理解 JSON body 应该长什么样
- **自动校验**请求 JSON，校验失败自动返回错误响应

> 第 6 章会讲如何用 Pydantic schema 来**结构化 LLM 的输出**。

---

## 3.5 流式生成：yield 与生成器

```python
def generate_stream(question: str):
    result = client.generate(model="llama3.2", stream=True, prompt=question)   # ❶

    for chunk in result:                # ❷
        if chunk.response:              # ❸
            yield chunk.response        # ❹
```

❶ 调用 Ollama client 的 `generate`。同样用命名参数指定模型（`model="llama3.2"`）和流式（`stream=True`）。

❷ 返回值是一个**可迭代的流**，用 `for` 循环遍历生成中的 chunk。

❸ 先检查有响应数据再处理。

❹ **`yield` 关键字把普通函数变成生成器函数（generator function）。** 生成器函数被调用时**不会立即执行**，而是返回一个生成器对象（迭代器）。这对流式场景非常合适——因为我们在等 Ollama client 的 chunk。

```python
@app.post("/")
def chat(chatRequest: ChatRequest):
    return StreamingResponse(                                  # ❶
        generate_stream(chatRequest.question), media_type="text/plain")
```

❶ 用 `StreamingResponse` 让流式变得简单：传入生成器 + `media_type`，这里是 LLM 生成的纯文本。

> ⚠️ **来自 JavaScript / Java / C# 的注意：Python 的缩进就是代码块结构。**
>
> 那些语言用花括号 `{}` 定义代码块，缩进主要是可读性问题。**在 Python 里，行首空格数决定这一行属于哪个 `if`、`for` 或 `def`。** 缩进不一致（或混用 tab 和空格）会让代码报错，或者更糟——能跑但行为错误。保持一致缩进（通常 2 或 4 空格），让编辑器帮你。

---

## 3.6 运行与测试

```bash
cd part1/getting_started_python
fastapi dev main.py
```

启动成功后：

```
server   Server started at http://127.0.0.1:8000
server   Documentation at http://127.0.0.1:8000/docs
tip      Running in development mode, for production use: fastapi run

INFO     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO     Started reloader process ... using WatchFiles
INFO     Application startup complete.
```

> 💡 FastAPI 自动生成的交互式 API 文档在 http://127.0.0.1:8000/docs，可以直接在浏览器里测试接口。

**测试：**

```bash
curl -N -X POST -H "Content-Type: application/json" -d \
  '{"question": "Can you tell me about the Beatles in 500 words or less?"}' \
  http://localhost:8000
```

**同一个前端也能用**——`part1/client` 里的 React 客户端不需要任何改动，因为接口契约完全一致。

---

## JS vs Python 对照表

| 概念 | JavaScript（第 2 章） | Python（第 3 章） |
| --- | --- | --- |
| Web 框架 | Hono | FastAPI |
| 创建应用 | `const app = new Hono()` | `app = FastAPI()` |
| CORS | `app.use(cors())` | `app.add_middleware(CORSMiddleware, ...)` |
| 解析 JSON body | `await c.req.json()` | Pydantic `BaseModel` 自动完成 |
| 路由定义 | `app.post('/', async (c) => …)` | `@app.post("/")` + `def chat(...)` |
| LLM 客户端 | `new Ollama()` | `Client()` |
| 调用模型 | `await ollama.generate({...})` | `client.generate(...)` |
| 流式开关 | `stream: true` | `stream=True` |
| 遍历流 | `for await (const chunk of iter)` | `for chunk in result` |
| 写回一块 | `await stream.write(chunk.response)` | `yield chunk.response` |
| 流式响应包装 | `return streamText(c, async (stream) => …)` | `StreamingResponse(gen, media_type=...)` |
| 启动 | `node server.mjs` | `fastapi dev main.py` |

---

## 本章小结

你把第 2 章的 JavaScript 示例移植到了 Python，用上了全书都会用的关键库：**FastAPI** 和 **Ollama SDK**。同时初步接触了 Python 语法——命名参数、装饰器、`yield` 生成器、缩进即语法。

---

## 练习

1. **在流式过程中打印整个 `chunk` 对象**（示例代码里已经写了 `chunk.model_dump_json(indent=2)`）。发起请求，观察 Ollama 随每个 chunk 返回的数据——这些是 `GenerateResponse` 类的属性。
2. **在 Part II 里用这个示例做 prompt 实验。** 试着把它和 ChatGPT、Gemini 或 Claude 并排使用，感受差异，以及这些工具在 LLM 之上集成的额外能力。这会帮你思考如何把书里的技巧用到自己的场景。

---

**上一章**：[第 2 章 · 构建你的第一个 LLM 应用](./ch02-构建第一个LLM应用.md)
**下一章**：[第 4 章 · 提示工程基础](./ch04-提示工程基础.md)
