# 第 8 章 · 设计 RAG（检索增强生成）系统

> 对应代码：`part3/rag_examples/`
> - `character_text_splitting.py` / `recursive_character_text_splitting.py` — 分块策略
> - `common/document_vector_store.py` / `multi_document_vector_store.py` — 向量库封装
> - `example_support_search.py` — 基础检索 + prompt
> - `examples_chatbot_sdk.py` / `examples_chatbot_with_chat_history.py` / `examples_chatbot_with_citations.py`
> - `multi_query.py` / `multi_query_example.py` — 多查询扩展
> - `main.py` — FastAPI 服务
> - `part3/client/` — React 客户端

## 核心命题

> **LLM 带来令人印象深刻的能力，但面对你自己的数据时它们是一张白纸。** 它们只知道训练集里的东西，对你的内部 wiki、支持工单、邮件或数据库记录**没有任何内建认知**。
>
> **RAG 是让这件事变得可行的架构模式。所有变体都有相同的意图：在需要的那一刻，把你私有数据中恰好正确的那几块交给 LLM。**

---

## 8.1 什么是 RAG

### ChatGPT 里的两个例子

**例 1：不需要 RAG**

问 "Who are the Beatles?" —— GPT-5.x 在关于披头士的公开文章（如维基百科）上训练过，**不需要额外上下文**就能给出好答案。

**例 2：需要 RAG**

问 "Can you tell me if the 2025 release of George T. Stagg is worth buying?"

GPT-5.x 的训练数据截止到 2024 年 9 月 30 日，**它不知道任何近期的专家评论**。它不会编造（幻觉），而是：

1. 先跑一次 **web 搜索**
2. 找到最新评论（**context**）
3. 用这些来生成更准确的响应

```
Prompt → API → [RAG pipeline]
                   ↓
              Web search → Results
                   ↓
              Prompt + search results → LLM → Completion
```

响应中还会包含**引用链接（citations）**，让你验证 ChatGPT 没在编。

> 📌 **RAG vs Tool Use（工具使用）**
>
> **模型怎么知道它需要更多信息？** 当你提示 ChatGPT 时，常会看到一个短暂的"thinking"步骤。**幕后，模型拿到的是你的 prompt 加上一组工具**，每个工具有名称、输入 schema 和何时如何使用的指导。
>
> 其中一个工具提供了搜索网络的能力。**如果模型推断你的问题需要更新或外部的知识，它可以选择调用该工具、获取上下文，然后用找到的信息生成答案。这个"检索然后生成"的序列就是 RAG pipeline。**
>
> 注意：**有些系统在模型被调用之前就执行检索**，检索可以只发生一次，也可以与生成交错进行。工具是更高级的概念，Part V 讲 agent 时会回来。

### 知识库（Knowledge Base）

> **知识库充当 LLM 的外部记忆存储**，包含文档和上下文数据等结构化信息，让 LLM 在生成响应时能访问并整合这些信息。

```
客户问题 → AI 客服 UI → API → [RAG pipeline]
                                    ↓
                        Query → 知识库数据库 → 相关文章
                                    ↓
                        Prompt + 相关文章 → LLM → 响应
```

**关键洞察：**

- **向知识库添加更多 how-to 文章，AI 客服 agent 就能持续"获得知识"**
- **架构良好的 RAG 方案只检索必要的上下文**，所以你不必担心请求太大（超出上下文窗口）或太贵（按 token 计费）

> **RAG 不只是把文档加进 prompt，而是塑造上下文，让模型只看到重要的东西，以最清晰的形式呈现。**
>
> **好的上下文工程能降低成本、减少幻觉，并可测量地改善答案质量。**

### 为什么用向量数据库

以下问题其实是同一个意思：

- "I'm having password issues. Can you help me?"
- "Something is wrong and I can't log in. Can you help me?"
- "I can't seem to sign in. Can you help me?"

**向量数据库用 embedding 模型捕获文本含义。** 文章被加载进向量库时其文本被转成向量嵌入，我们直接用客户问题查询，**它就会返回语义上最相关的文章**。

---

## 8.2 RAG Pipeline

**Pipeline 就是把原始数据变成 LLM 驱动的答案的端到端流程。**

```
                        【摄取 / Ingestion】
Documents → Chunk documents → Embedding model → Document chunk embeddings → Vector database

                        【推理 / Inference】
User Query → Embedding model → Query embedding → Vector database → Retrieved document chunks
                                                                              ↓
                                                                    【增强 / Augmentation】
                                                          Prompt template + Document chunks + Query
                                                                              ↓
                                                                    【生成 / Generation】
                                                          Augmented prompt → LLM → Response
```

### 数据摄取 Pipeline（离线）

| 阶段 | 说明 |
| --- | --- |
| **检索原始数据并分块** | 收集必要文档（README），拆成可管理的片段（document chunks）以便高效搜索 |
| **嵌入与索引** | 每个 chunk 被 embedding 模型转成向量嵌入，存进向量数据库，**数据库用索引实现高性能检索** |

### 推理 Pipeline（在线）

| 阶段 | 说明 |
| --- | --- |
| **Retrieval（检索）** | 收到用户查询，跑相似性搜索拉回 **top k** 个最相关的文档 chunk |
| **Augmentation（增强）** | 用 prompt 模板（含静态的系统级指令）合并这些 chunk 和用户的原始查询 |
| **Generation（生成）** | 把填充好的 prompt 发给 LLM，生成响应（通常流式返回） |

> **每个 RAG 变体（naive、cached、agentic、hybrid、graph-based）只是调整了这些流水线阶段中的一个或多个**——比如改变分块和索引方式、检索方式、增强方式或生成步骤的编排方式。

---

## 8.3 环境准备

**本章换用 Ollama 的 embedding 模型 `mxbai-embed-large`**，它凭借最先进的检索质量、高准确性和高效的本地运行时，**非常适合 RAG**。

> Ollama 文档称 `mxbai-embed-large`：
> "**超越 OpenAI 的 text-embedding-3-large 等商业模型，性能匹敌 20 倍于它体积的模型**"

```bash
ollama pull mxbai-embed-large
```

```bash
pip install "fastapi[standard]"==0.119.0 chromadb==1.2.1 \
  jinja2==3.1.6 langchain-text-splitters==1.0.0 requests==2.32.5
```

| 库 | 作用 |
| --- | --- |
| `fastapi` | 快速创建服务器 |
| `ollama` | 调用 Ollama API 的 SDK |
| `chromadb` | Chroma 接口 |
| `jinja2` | 通用快速模板引擎 |
| `langchain-text-splitters` | **把大文本文档切分成更小、更易管理的 chunk 的工具** |
| `requests` | 友好的 HTTP 客户端库 |

> 💡 LangChain 是用于更复杂实现的高层框架，这里**只用它的文本切分工具**来为向量数据库准备非结构化文本。

---

## 8.4 分块（Chunking）

**选择好的文本分块策略是构建可靠 RAG 方案的关键。**

### 分块策略的总体目标

1. **在 embedding 中准确捕获文本的含义**
2. **确保包含足够的上下文相关信息**
3. **保持 token 长度在 embedding 模型的请求限制内**

### 分块的好处

- 更小的 chunk 捕获更少的主题或想法
- **Embedding 的含义更聚焦（提升检索准确性）**
- 生成 embedding 时能避免撞上 token 限制
- **分块的查询结果意味着发给 LLM 的 token 更少、更相关**

### 最基础：CharacterTextSplitter

**`part3/rag_examples/character_text_splitting.py`**

```python
from langchain_text_splitters import CharacterTextSplitter

text = """Our system requires multi-factor Authentication (MFA). This helps
to keep your account secure. This step-by-step guide will walk you through
the MFA setup."""

splitter = CharacterTextSplitter(
    separator="",          # 分割用的分隔符（字符、句号、换行等）
    chunk_size=70,         # 每个 chunk 包含的字符数
    chunk_overlap=20       # 相邻 chunk 之间重叠的字符数
)

chunks = splitter.split_text(text)

for idx, chunk in enumerate(chunks):
    print(f"{idx + 1}: {chunk}\n- character count: {len(chunk)}")
```

**输出：**

```
1: Our system requires multi-factor Authentication (MFA). This helps to k
- character count: 70
2: FA). This helps to keep your account secure. This step-by-step guide w
- character count: 70
3: step-by-step guide will walk you through the MFA setup.
- character count: 55
```

**chunk_overlap（重叠）的作用：**

- **降低想法在相邻 chunk 之间被切成两半的概率**
- **在相邻 chunk 之间创造语义相似性**

> ⚠️ 但重叠文本会导致**冗余信息和存储需求增加**，需要针对你的文本做实验。

> ⚠️ **注意文本会在必要时从单词中间切断！** 这确保不超过字符限制。**但这个策略不推荐，因为它太朴素**：最好的情况下，这样切断的单词对 embedding 模型无用；最坏的情况下，单词被切成会导致错误含义的形式。

### 五种分块策略

| 策略 | 说明 |
| --- | --- |
| **Fixed size（固定大小）** | 最基础。基于字符数切分的朴素实现。**一般不推荐，但有助于理解** |
| **Recursive（递归）** ⭐ | **最好的通用起点**。考虑文本结构，在常见分隔符（段落、换行、空格）上切分。**Chunk 大小可变，但更有可能捕获完整的想法** |
| **Document based（基于文档）** | 最适合特定文档类型。考虑文档类型（Markdown、PDF、HTML）。**本质与递归相同，但基于文档类型使用自定义分割字符** |
| **Semantic（语义）** | 更定制化的方法。尝试用**句子 embedding** 识别语义相关内容来构建 chunk。**需要 embedding 模型，通常更慢、需要更多算力** |
| **Agentic** | **更偏实验性而非生产就绪**。用 agent 构建语义 chunk。撰写时还很慢且扩展性不好，但你可以为自己的用例做实验（Part V） |

### RecursiveCharacterTextSplitter

**默认在这些字符上切分（按顺序递归尝试）：**

| 分隔符 | 含义 |
| --- | --- |
| `"\n\n"` | 双换行，表示新段落 |
| `"\n"` | 单换行，表示文本中断 |
| `" "` | 空格 |
| `""` | 任何其他字符 |

> **它先在段落（`\n\n`）上切分，如果 chunk 太大，就递归地继续找下一个分隔符，直到达到期望的 chunk 大小。** 这意味着 chunk 大小可能不一，**但更有机会捕获完整的想法**。

**`part3/rag_examples/recursive_character_text_splitting.py`**

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

text = """Our system requires multi-factor authentication (MFA). This helps
to keep your account secure. This step-by-step guide will walk you through
the MFA setup."""

splitter = RecursiveCharacterTextSplitter(
    separators=["\n\n", "\n", ".", " ", ""],   # ❶ 加入了句号
    chunk_size=70,
    chunk_overlap=0,                            # ❷ 去掉了重叠
    keep_separator='end'
)

chunks = splitter.split_text(text)
```

**输出：**

```
1: "Our system requires multi-factor authentication (MFA).
- character count: 55
2: This helps to keep your account secure.
- character count: 39
3: This step-by-step guide will walk you through the MFA setup.
- character count: 60
```

✅ **现在每个 chunk 都是完整句子，对 embedding 而言有意义得多。**

> 🔧 **Hugging Face 提供了一个很棒的 chunk 可视化工具**，可以直接玩转不同分块策略的各项设置：
> https://huggingface.co/spaces/m-ric/chunk_visualizer

### 对 Markdown 文档分块

书中示例的文档在 README 文件里，是 **Markdown 格式**，包含清晰的语义分隔符（如 `#` 标题）。**用这些分隔符能更好地创建语义有意义的 chunk。**

```python
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

document_text = Path('../../README.md').read_text()        # ❶

splitter = RecursiveCharacterTextSplitter.from_language(   # ❷
    language=Language.MARKDOWN,
    chunk_size=1500
)

chunks = splitter.split_text(document_text)
```

❶ 用 `pathlib` 的 `Path` 类读取文件——**提供了跨平台的简单方案**。`read_text` 底层其实用的就是 `with open`。
❷ 类方法 `from_language` 让你用 `Language` 枚举指定语言为 Markdown。

> 💡 **看看 `Language` 枚举有哪些支持的语言格式。找不到你的格式？可以定义你自己的分隔符列表。**

> 📌 **估算 embedding 的 chunk 大小**
>
> **`mxbai-embed-large` 模型有 512 token 限制。** 常用经验法则是 **1 token ≈ 4 个字符**，所以 token 限制大约对应 **2,048 个字符**。
>
> 由于 `RecursiveCharacterTextSplitter` 按字符度量，**1,500 字符的限制安全地待在这个估算之下**，对我们的文档效果很好。
>
> **想要硬性的 token 上限**，用 `from_tiktoken_encoder` 或 `from_huggingface_tokenizer`——它们按 **token** 而非字符强制执行 `chunk_size`。
>
> ⚠️ **记住：chunk 大小需要针对你的源文本做实验。** 取决于你的用例，**指定最大 token 数可能导致 embedding 包含太多概念，产生糟糕的查询结果。如果得不到你想要的语义相关结果，更小的 chunk 大小可能有帮助。**

---

## 8.5 加载向量数据库

**`part3/rag_examples/common/document_vector_store.py`**

```python
import chromadb
from chromadb import Collection
from chromadb.utils.embedding_functions.ollama_embedding_function import (
    OllamaEmbeddingFunction
)

class DocumentVectorStore:
    def __init__(self, document_text: str):                      # ❶
        ollama_embedding_function = OllamaEmbeddingFunction(
            url="http://localhost:11434",
            model_name="mxbai-embed-large"
        )

        client = Client()

        self.collection: Collection = client.create_collection(  # ❷
            name="examples_readme",
            embedding_function=ollama_embedding_function,
        )

        splitter = RecursiveCharacterTextSplitter.from_language(
            language="markdown",
            chunk_size=1500
        )

        chunks = splitter.split_text(document_text)              # ❸

        self.collection.add(                                     # ❹
            documents=chunks,
            ids=[f"doc{chunk_idx + 1}" for chunk_idx, chunk in enumerate(chunks)]  # ❺
        )

    def query(self, question: str, n_results=3) -> List[str]:    # ❻
        results = self.collection.query(
            query_texts=[question], n_results=n_results)

        return results.get('documents')[0]
```

❹ **把 chunk 加进 collection 会为每个 chunk 触发我们的 Ollama embedding 函数。**
❺ 这里按文档顺序给每个 chunk 一个唯一 ID——**为了简单。真实场景中通常要找一个更有意义的 ID。**

### 测试检索

```python
document_text = Path('../../README.md').read_text()

readme_vector_store = DocumentVectorStore(document_text)

question = "Why is Ollama preferred to hosted APIs for the examples?"

documents = readme_vector_store.query(question, n_results=1)

print(documents[0])
```

**输出：**

```markdown
# Pretrained AI Models

The concepts and practical approaches presented in the Developer's Guide to AI
are generally AI model agnostic, but we will be calling Ollama models in many
of the examples. Ollama provides a local API to open models that will only
cost you the power required to power your laptop. ...
```

✅ **这段文本正是回答问题所需的。**

---

## 8.6 用 LLM 完成 RAG Pipeline（Naive RAG）

### Prompt 模板

**System 消息（`templates/basic_support_system_message.txt`）：**

```
You are a helpful assistant and will answer questions about the Developer's
Guide to AI. Only use the provided <context> to answer. If you don't know
the answer, only respond with "Sorry, I am unable to help with that, but I can
answer questions about the documentation."
```

**这个 system 消息指定了三件事：**

| 元素 | 内容 |
| --- | --- |
| **Persona** | You are a helpful assistant and will answer questions about The Developer's Guide to AI |
| **Grounding（接地）** | Only use the provided `<context>` to answer |
| **Uncertainty handling（不确定性处理）** | 不知道答案时只回复固定语句 |

**User 消息（`templates/basic_support_user_message.txt`）：**

```jinja
<context>
{% for document in documents %}
<document>
{{ document }}
</document>
{% endfor %}
</context>

Question: {{question}}
```

> 💡 **思考题**：第 6 章学的其他 guardrails 里，还有哪些可以加进这个 prompt？试着实验并加上你自己的护栏。

### 组装并调用

**`part3/rag_examples/example_support_search.py`**

```python
env = Environment(                                          # ❶
    loader=FileSystemLoader(searchpath="templates")
)

system_message = env.get_template("basic_support_system_message.txt")
user_message = env.get_template("basic_support_user_message.txt")

messages = [                                                # ❷
    {
        "role": "system",
        "content": system_message.render()                  # ❸
    },
    {
        "role": "user",
        "content": user_message.render(documents=documents, question=question)  # ❹
    }
]

response = chat(                                            # ❺
    model="llama3.2",
    messages=messages,
    stream=True,
    options={
        "temperature": 0                                    # 降低编造的可能性
    }
)

for chunk in response:
    if chunk.message.content:
        print(chunk.message.content, end="", flush=True)
```

**模型响应：**

```
According to the provided context, Ollama models are preferred because they
only cost you the power required to power your laptop. This implies that
using Ollama models is more cost-effective compared to hosting and paying
for usage of models through APIs like OpenAI.
```

> 💡 **注意 LLM 的响应提到了 "the provided context"。** 对我们的目的这有帮助，但**对普通用户来说，我们大概希望 LLM 用不同的措辞**。
>
> **思考题**：怎么修改 prompt 模板，让 LLM 用 "README" 或 "documentation" 这类更有意义的词？试试用指令提示和 few-shot 提示来改变响应。

---

## 8.7 构建服务 API（结合对话历史）

**`part3/rag_examples/main.py`**

```python
def generate_stream(conversation_history: ConversationHistory):     # ❶
    result = chat(
        stream=True,
        model="llama3.2",
        messages=conversation_history.get_messages(),
        options={'temperature': 0}
    )

    for chunk in result:
        if chunk.message and chunk.message.content:
            yield chunk.message.content


@app.post("/")
def handle_post(chat_request: ChatRequest):
    question = chat_request.question

    conversation_history = ConversationHistory({                    # ❷
        "role": "system",
        "content": system_message.render()
    })

    for msg in chat_request.history:
        conversation_history.add_message({
            'role': msg.role,
            'content': msg.content
        })

    conversation_history.trim_history()                             # ❸ 控制 token

    documents = readme_vector_store.query(question)                 # 检索

    conversation_history.add_message({                              # ❹ 增强后的 user 消息
        "role": "user",
        "content": user_message.render(documents=documents, question=question)
    })

    return StreamingResponse(                                       # ❺
        generate_stream(conversation_history), media_type="text/plain")
```

**关键点：**

- ❶ 复用第 6 章的 `ConversationHistory` 组件简化了 `generate_stream`
- ❸ 用 `trim_history` 确保对话历史待在 token 限制内
- ❹ **检索到的文档被渲染进增强的 user 消息**

### 测试

**问：** "Why is Ollama preferred to hosted APIs for the examples?"

```
According to the provided context, Ollama is preferred over hosted APIs (such
as OpenAI APIs) because it allows you to use the models at no cost other than
the power required to run your laptop. This is mentioned in the # Pretrained
AI Models section of the README file.

Source URL:
  https://github.com/jorshali/developers-guide-to-ai/blob/main/README.md
```

**问一个完全无关的问题：** "Can you tell me about the Beatles?"

```
Sorry, I am unable to help with that, but I can answer questions about the
documentation. Would you like to ask a question related to the Developer's
Guide to AI or would you like more information on how to use Ollama compared
to hosted APIs?
```

✅ **system 消息的护栏起作用了！**

---

## 8.8 引用（Citations）：提升可信度

> **用户不会、也不应该仅仅因为响应听起来自信就信任它。他们信任证据。** 在 RAG 设置中，这意味着给响应附上清晰的来源（citation）——我们需要能回答**"这个信息从哪来的？"**

**摄取时可以捕获这些数据点：**

- 文档标题
- 作者或来源站点
- 文档的直接链接
- 文档被访问的日期
- **文本的精确位置（页、节或行）**

> **对某些响应，我们可能需要把引用放在特定文本旁边**，让读者不必四处找就能核对。**对更长的响应，我们可能把引用分组**，而不是给每句话都加链接。

> 💡 **引用还能改善模型行为：当模型必须为其输出提供依据时，它倾向于引用和总结真实文本而非猜测，这减少了幻觉。**

### Document 类与远程下载

```python
from pydantic import BaseModel

class Document(BaseModel):
    source_url: str
    content: str
```

```python
import requests

source_base_url = "https://github.com"
raw_content_base_url = "https://raw.githubusercontent.com"

def download_remote_document(owner="jorshali", repo="developers-guide-to-ai",  # ❶
                            branch="main", filename="README.md") -> Document:
    source_url = f"{source_base_url}/{owner}/{repo}/blob/{branch}/{filename}"  # ❷ 用于链接
    raw_url = f"{raw_content_base_url}/{owner}/{repo}/{branch}/{filename}"     # ❷ 用于取文本

    response = requests.get(raw_url)                                            # ❸
    response.raise_for_status()    # Raises exception for 4xx/5xx errors

    return Document(                                                            # ❹
        source_url=source_url,
        content=response.text
    )
```

### MultiDocumentVectorStore

**`part3/rag_examples/common/multi_document_vector_store.py`**

```python
class MultiDocumentVectorStore:
    def __init__(self, documents: List[Document]):                # ❶ 接受 Document 列表
        embedding_function = OllamaEmbeddingFunction(
            url="http://localhost:11434",
            model_name="mxbai-embed-large"
        )

        client = chromadb.Client()

        self.collection: Collection = client.create_collection(
            name="examples_readme",
            embedding_function=embedding_function,
        )

        for doc_idx, document in enumerate(documents):            # ❷ 逐文档分块
            splitter = RecursiveCharacterTextSplitter.from_language(
                language="markdown", chunk_size=1500)

            document_chunks = splitter.split_text(document.content)

            for chunk_idx, document_chunk in enumerate(document_chunks):
                self.collection.add(
                    documents=document_chunk,
                    ids=f"doc_{doc_idx + 1}_{chunk_idx + 1}",              # ❸ 组合 ID
                    metadatas={"source_url": document.source_url}          # ❹ 来源存元数据
                )

    def query(self, question: str):
        results = self.collection.query(query_texts=[question], n_results=3)

        document_chunk_results = results.get('documents')[0]
        document_chunk_metadatas = results.get('metadatas')[0]              # ❺ 取元数据

        documents: List[Document] = []

        for result_idx, document_chunk in enumerate(document_chunk_results):  # ❻
            documents.append(Document(
                source_url=document_chunk_metadatas[result_idx].get('source_url'),  # ❼
                content=document_chunk
            ))

        return documents
```

❹ **把 `source_url` 作为元数据存进去——检索时需要这个信息来指示模型引用来源。**

### 加载多个 README

```python
readme_filenames = [                                    # ❶
    'README.md',
    'part1/getting_started_python/README.md',
]

readme_documents = []

for readme_filename in readme_filenames:
    readme_documents.append(                            # ❷
        download_remote_document(filename=readme_filename))

readme_vector_store = MultiDocumentVectorStore(readme_documents)   # ❸
```

> 💡 **试着自己从 GitHub 仓库添加更多 README 文件。你甚至可以传入你自己的 GitHub README！** `download_remote_document` 函数允许你自定义要检索的 GitHub 仓库。

### 修改 Prompt 以要求引用

**System 消息：**

```
You are a helpful assistant and will answer questions about the Developer's
Guide to AI:

- Only use the provided <context> and any chat history to answer questions
- If the question appears related to chat history, prioritize the chat history
  in your response
- Each <document> in the context contains a <source_url>
- Always complete your response with the <source_url> from the document used
  in your response
- Cite your source in the format "Source URL: <source_url>"

If you don't know the answer, only respond with:

"Sorry, I am unable to help with that, but I can answer questions about the
documentation."
```

**User 消息模板：**

```jinja
<context>
{% for document in documents %}
<document>
{{ document.content }}

<source_url>{{ document.source_url }}</source_url>      {# 新增分隔符 #}
</document>
{% endfor %}
</context>

Question: {{question}}
```

### 测试

**问：** "Can you tell me how to run the Part 1 examples?"

```
...
6. Launch the server
- In a terminal, navigate to the `part1/getting_started_python` directory and
  run the following command:
  ```
  ~/developers-guide-to-ai/part1/getting_started_python % fastapi dev main.py
  ```

Source URL: https://github.com/jorshali/developers-guide-to-ai/blob/main/
  part1/getting_started_python/README.md
```

✅ **引用了正确的 README。**

> 💡 **想输出真正的链接？** 你可以指示模型输出 source ID，在流式传输过程中把它们替换成实际链接。**另外记住 Instructor 支持流式结构化输出**——你可以创建一个包含响应和 source ID 数组的 Pydantic model（这是章末的推荐练习之一）。

---

## 8.9 进阶 RAG 主题

> 我们目前构建的常被称为 **naive RAG**——简单、能用、非常适合起步。**但需求增长时你可能会碰到它的极限。**

### 替代索引与检索策略

**分块要取得平衡：小 chunk 在精确问题上表现好，但难以应对宽泛问题；大 chunk 对特定查询往往缺乏足够细节。**

| 策略 | 说明 |
| --- | --- |
| **Parent-child（两级）检索** | **在很多搜索任务中，你想要匹配小片段的速度，又想返回足够的周边文本让模型答得好。** 通用解法是两级方案：为细粒度的"子" chunk 创建 embedding 用于相似性搜索，**但一旦匹配，就拉回它更大的"父"节**（可能是整页或整章）以提供更丰富的上下文。查询时检索器搜索子块，然后拼进父文档再交给 LLM。**结果是一个轻量索引，却仍能给你的 prompt 提供更大、更连贯的段落** |
| **Multi-vector（多向量）检索** | **有时一个文档一个 embedding 无法捕获用户可能提问的所有方式。** 通用补救是为同一来源创建**多个向量嵌入**——标题、摘要、标题行、句子级 chunk。这样任何一个 embedding 都能触发命中。你存储多个 embedding，**每个都打上同一个文档 ID 的标签**。查询进来时检索器检查所有 embedding，聚合指向同一原始文档的匹配，返回组装好的内容。**这让宽泛的概览查询能匹配高层 embedding，而细节问题仍能锁定句子级的，且不会用无关文本撑大你的 prompt** |

**Parent-child 的实现方式**：通常通过在**每个 chunk 的元数据里存储父文档的 ID**：

```
向量数据库                        文档存储
  parentID: 1  ┐
  parentID: 1  ├─ parentID 引用 ──→  ID: 1（完整文章）
  parentID: 1  ┘
  parentID: 2  ┐
  parentID: 2  ┴─────────────────→  ID: 2（完整文章）
  (文章 chunk)                       (完整文章)
```

### 架构变体

| RAG 变体 | 工作方式 | 何时使用 |
| --- | --- | --- |
| **Naive RAG** | 经典向量数据库检索。本章构建的就是这个模式，LangChain 等框架开箱支持 | 中小型知识库；原型 |
| **Hybrid retrieval（混合检索）** | 组合多种检索技术：**基于关键词的搜索、语义搜索和向量搜索**。能提升检索时信息的准确性和相关性 | 大型或嘈杂的知识库；**查询风格多样**（有些偏关键词、有些偏语义） |
| **Cache-augmented generation (CAG)** | 检索时从**内存缓存**读取而非搜索索引。缓存一般像一个小知识库，**要么把知识预加载到模型的 KV 缓存，要么直接从 LLM 前面的键值存储回答重复或语义相似的问题，短路整个检索步骤** | **流量高且重复**（如回答相同 FAQ 的聊天机器人）；**超低延迟或降低算力成本至关重要** |
| **API-augmented RAG** | **LLM 发出工具调用（API）而非搜索查询。** 多数团队仍将其归类为 RAG，但它其实是工具增强或函数调用式生成（Part V） | **实时或快速变化的数据**（天气、股价、商品库存） |
| **Knowledge-graph RAG** | **知识图谱把事实存为相连的节点**（人、地点、事件等）。提问时系统沿着这些连接精确拉取正确的事实，给出更准确的答案 | **需要高事实准确性**；**可追溯的推理**（合规或生物医学）。本书不涉及 |

### 生产级改进

| 症状 | 潜在问题 | 可调研的解法 |
| --- | --- | --- |
| **用户问题就是拿不回对的上下文** | 用户可能发送模糊或简写的查询；数据源索引得不够好；**向量搜索对复杂或非常特定的术语可能不够好** | 查询重写/扩展；分块策略；混合检索 |
| **重要上下文包含在 prompt 里但被忽略** | 方案可能受 **lost-in-the-middle 效应**困扰 | 重排序/重新排列 |
| **响应有时包含幻觉，和/或响应质量不一致** | prompt 里可能包含了无关上下文，诱导跑偏的答案；prompt 中防幻觉的指令不够；**给了 prompt/响应示例但模型仍然回应不当** | 重排序；Guardrails（第 6 章）；LLM evaluator；微调（Part IV） |
| **模型不遵守你的格式/安全规则** | prompt 中限制模型响应的指令不够；**可能需要生成后步骤来验证响应**；模型的训练数据可能不包含你想要的格式 | Guardrails；LLM evaluator；微调 |
| **成本失控，或推理时间劣化** | **数据源规模在增长，无关或冗余 chunk 的几率增加，撑大 prompt 和成本** | 重排序/重新排列 |

#### 1. Query Rewriting / Expansion（查询重写/扩展）

> **用户不太可能完全按我们预想的方式提问。** 用户可能打 "reset pw" 或用别扭的措辞。**查询重写把他们的问题变成更清晰完整的查询**，比如 "How do I reset my password?"，这样相关文档就不会被漏掉。

**在检索之前让 LLM 重写或添加用户问题的变体。**

| 策略 | 说明 |
| --- | --- |
| **Rewrite-retrieve-read** | 把用户查询转成更干净的查询再搜索 |
| **Multi-query retrieval** | **创建几种不同的表述，用它们全部去搜索**以获得更广覆盖（见 `part3/rag_examples/multi_query.py`） |
| **HyDE** | "假设性"查询——**让 LLM 编造一个简短的"想象答案"，然后用它去搜索匹配的文档** |

> ⚠️ 这些技巧**增加 token 用量并额外增加一次 LLM 调用**，会影响响应时间。

#### 2. Re-Ranking / Reordering（重排序）

> **记得 lost-in-the-middle 效应吗？** LLM 倾向于主要关注长 prompt 中最前和最后的内容，**埋在中间的任何东西都可能被完全忽略**。

| 步骤 | 说明 |
| --- | --- |
| **Reorder（重新排列）** | 把相似度分数最高或最新的 chunk 移到 prompt 的最前面 |
| **Re-rank（重排序）** | **把初始搜索命中送进一个更聪明的打分模型**，然后按新分数排序 |
| **Compress（压缩）** | **完全丢弃低价值 chunk，或把它们合并成更短的摘要** |

> ⚠️ 调用额外的模型会**增加基础设施复杂度、成本，并影响性能**。

#### 3. Hybrid Retrieval（混合检索）

> **只依赖 embedding 时，你可能错过精确的关键词匹配。** 对非常特定的术语尤其如此——比如 `HTTP 500` 日志行和 `internal server error`，或者源码片段、零件编号、医疗代码。

**混合检索同时跑关键词搜索和向量搜索并混合结果**，取两者之长。**这个策略通常需要配合某种重排序来正确排列结果。**

#### 4. LLM Evaluator（LLM 评判者，LLM-as-a-judge）

**把它当作 RAG 流水线中的质量闸门。** 检索到上下文并起草一个或多个答案后，你交给 LLM 三样东西：

1. 原始问题
2. 检索到的段落
3. 候选输出

**LLM（判官）检查**：对来源的忠实度（faithfulness）、任务契合度、覆盖度、格式/安全规则。

**它返回一个结构化判决**（通常是 JSON），包含分数、标签（hallucination、missing citation、leakage）和 pass/fail 或 A/B 选择。

**你可以用这个判决来**：重排候选响应、阻止某个响应，或触发修复动作（查询重构或再检索一轮）。

#### 5. Agentic RAG

**对复杂问题，你可能需要循环执行"思考、检索、思考"的循环，或调用额外工具。**

事实上用 ChatGPT 最新模型时你就能看到这种做法：**这些模型用 CoT 方法逐步走过响应一个 prompt 所需的步骤，用数据源或工具检索必要信息、评估并评分信息、判断相关性、循环直到能起草答案。**（Part V 详述）

---

## 8.10 数据质量与安全

> **你的 RAG 系统只会和你喂给它的数据一样好。** 本章的每一个检索技巧——更好的分块、更聪明的检索、重排序、引用——**都依赖于干净、最新、可信的来源。把数据质量当作流水线的一等特性，而不是事后想法。**

**从权威输入开始并保持：**

- 规范化格式，剥离样板文本
- **在文档和 chunk 两个层级都激进地去重**，免得用近似重复的内容淹没检索器（和模型）
- **捕获有用的元数据**（版本、日期、产品、权限、URL），这些字段驱动更好的过滤、排序和引用

**用清晰的策略强制新鲜度：**

- 时间盒定什么算"当前"
- 归档陈旧副本
- **按计划重新索引**

**度量重要的东西**：记录查询、检索到的 chunk 和引用；跟踪命中率、延迟和答案质量。**当答案错了，可观测性才是你调试流水线（而非 prompt）的方式。**

> ⚠️ **RAG 复制了你的数据。索引、缓存和 chunk 存储都是敏感内容可能存在的额外地方。**
>
> **对它们应用和你对真相来源同样（或更严格）的安全控制：** 传输和静态加密、最小权限访问、按租户隔离、可审计的变更。
>
> **绝不要以为向量数据库"只是 embedding"——那些向量可以被用来重建文本。**

**安全始于摄取之前：**

- **避免把密钥/PII 推送到任何第三方服务**，除非有恰当的数据安全协议和加密要求
- **必须处理敏感内容时，优先选择本地或私有端点**（就像你构建的 Ollama + Chroma 组合），并通过你的应用而非数据库来保护访问
- **通过记录谁搜了什么、返回了哪些 chunk、引用了哪些来源来创建可追溯性**

> 💡 **如果你什么都不记得，记住这句：更好的数据胜过更大的 prompt（better data beats bigger prompts）。**

---

## 本章小结

**我们构建了完整的 RAG pipeline：**

1. 用**基于文档的分块策略**摄取和切分文档
2. 用高性能的 **`mxbai-embed-large`** 模型嵌入这些 chunk，索引进 **Chroma**
3. 创建 **prompt 模板**，用系统指令给 LLM 接地，为上下文和用户问题留占位符
4. 组合模板与向量库检索相关文档、增强 prompt、流式返回 LLM 响应
5. 加入**引用**提升可信度

**进阶主题：** 更聪明的分块（parent-child 检索）、元数据感知的混合搜索、重排序缓解 lost-in-the-middle、以及 cache-augmented / API-augmented 等架构变体。

---

## 练习

1. **给引用用上结构化输出**：用第 6 章所学修改聊天机器人的服务 API 返回结构化输出。创建一个定义了响应字段和被引用 source ID 的 Pydantic model。**实验用 Instructor 的流式能力把 JSON 响应流式传回客户端。**
2. **实验查询重写/扩展**：加一个步骤，用 LLM 重写和/或扩展服务 API 收到的查询。**在一组用户测试问题上测量这如何影响答案质量。**
3. **实验混合搜索并做对比**：把基于关键词的检索器（如 **BM25**）与你的向量存储结合，混合结果，**在宽泛和精确两类查询上对比相关性**。

---

## 🎉 阶段性总结

> **你已经用 LLM 打下了扎实的基础！** 现在你能熟练地基础使用、理解提示工程如何引导 LLM 行为、知道如何通过 RAG 和向量数据库集成外部信息。
>
> **虽然这些技巧对很多用例都极其有效，但有时你需要模型本身在某项技能上从根本上变得更好，或采用对你的应用至关重要的特定风格。这就是微调的领域**——我们拿一个已经很强的模型，用专业数据进一步训练它，把它的核心能力精确塑造成你需要的样子。

---

**上一章**：[第 7 章 · 向量数据库实战](./ch07-向量数据库实战.md)
**下一章**：[第 9 章 · 为什么以及何时定制模型](./ch09-何时定制模型.md)
