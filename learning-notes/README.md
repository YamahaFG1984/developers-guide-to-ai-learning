# 《The Developer's Guide to AI》学习笔记

> 基于 *The Developer's Guide to AI: A Field Guide for the Working Developer*
> （Jacob Orshalick, Jerry M. Reghunadh, Danny Thompson · No Starch Press, 2026）
> 整理的中文教学文档，逐章对应本仓库 `part1/` ~ `part5/` 的示例代码。

---

## 这本书讲什么

> **大多数开发者已经知道 AI 很强大，但不知道怎么在自己的代码库里真正用起来——同时又不必变成数据科学家。**

本书聚焦于**通过 API 和 SDK 使用预训练 AI 模型**（LLM 及其他），用你已经会的语言构建 AI 驱动的应用。

**核心比喻贯穿全书：我们是 AI 厨师（AI chefs），不是 AI 建筑师（AI architects）。** 我们学会选择正确的原料（预训练模型、RAG、微调），用恰当的技法（提示工程、工具使用）组合它们。

### 模型定制策略金字塔（全书路线图）

```
  便宜、简单                          灵活但可预测性低
      ▲                                       ▲
      │        ┌──────────────────────┐
      │        │  Prompt Engineering  │  提示工程        ← Part II
      │        ├──────────────────────┤
      │        │  Context Engineering │  上下文工程      ← Ch4 / Ch8
      │        ├──────────────────────┤
      │        │     Fine-Tuning      │  微调            ← Part IV
      │        ├──────────────────────┤
      │        │     Custom Model     │  自建模型（本书不涉及）
      ▼        └──────────────────────┘
  更耗时、更贵                        更聚焦、更精确
```

---

## 目录

### Part I · 起步（Getting Started with AI）

| 章节 | 主题 | 对应代码 |
| --- | --- | --- |
| [第 1 章 · 理解大语言模型](./ch01-理解大语言模型.md) | LLM 训练、token 预测、四大局限、四层策略金字塔 | — |
| [第 2 章 · 构建第一个 LLM 应用](./ch02-构建第一个LLM应用.md) | Ollama + Express + 流式响应 + React 客户端 | `part1/getting_started/`、`part1/client/` |
| [第 3 章 · LLM 与 API 的 Python 要点](./ch03-Python要点.md) | FastAPI + Ollama SDK + Pydantic + `yield` 生成器 | `part1/getting_started_python/` |

### Part II · 提示工程（Prompt Engineering）

| 章节 | 主题 | 对应代码 |
| --- | --- | --- |
| [第 4 章 · 提示工程基础](./ch04-提示工程基础.md) | 编程 vs 提示、五大 prompt 要素、上下文窗口、tokenization、成本、选模型 | `part2/basic_examples/tokenization.py` |
| [第 5 章 · 提示工程技巧](./ch05-提示工程技巧.md) | 指令提示、persona、zero/one/few-shot、CoT、prompt chaining、分隔符 | `part2/articles/` |
| [第 6 章 · 代码中的提示工程](./ch06-代码中的提示工程.md) | 库选型、LLM 配置、Jinja 模板、roles/messages、对话历史、结构化输出、guardrails | `part2/basic_examples/`、`part2/conversation_history/`、`part2/structured_output/` |

### Part III · 向量数据库与 RAG

| 章节 | 主题 | 对应代码 |
| --- | --- | --- |
| [第 7 章 · 向量数据库实战](./ch07-向量数据库实战.md) | Embedding 原理、SBERT、Chroma、语义搜索、推荐引擎、模型名解读 | `part3/vector_databases/` |
| [第 8 章 · 设计 RAG 系统](./ch08-设计RAG系统.md) | RAG pipeline、分块策略、引用、进阶 RAG（重排序/混合检索/LLM 评判者）、数据安全 | `part3/rag_examples/`、`part3/client/` |

### Part IV · 让模型适配真实任务（Adapting Models）

| 章节 | 主题 | 对应代码 |
| --- | --- | --- |
| [第 9 章 · 为什么以及何时定制模型](./ch09-何时定制模型.md) | 从零构建 vs 微调、三种策略、两种方法、三大步骤 | — |
| [第 10 章 · 为微调准备数据](./ch10-为微调准备数据.md) | 收集/组织/编码标签、80-10-10 切分、Hugging Face Datasets、ClassLabel | `part4/01-dataset.ipynb` |
| [第 11 章 · 微调实战](./ch11-微调实战.md) | zero-shot 基线、DistilBERT 分类微调、chat template、PEFT/LoRA、SFTTrainer | `part4/02` ~ `part4/07` notebooks |

### Part V · 构建智能体系统（Building Agentic Systems）

| 章节 | 主题 | 对应代码 |
| --- | --- | --- |
| [第 12 章 · 从工作流到自主智能体](./ch12-从工作流到智能体.md) | Agent 定义、三种工作流对比 | — |
| [第 13 章 · 构建自主智能体](./ch13-构建自主智能体.md) | smolagents + LiteLLM + Gemini、CodeAgent 参数 | `part5/building-your-first-agent/` |
| [第 14 章 · 用工具扩展智能体](./ch14-用工具扩展智能体.md) | 自定义 tool、MCP 协议、FastMCP、Postman 测试、Claude Desktop 集成 | `part5/building-an-mcp-server/` |

---

## 环境准备（一次性）

### 1. Ollama（Part I–III 用）

```bash
# 下载安装：https://ollama.com
ollama --version

# 启动服务
ollama serve

# 另开终端下载模型
ollama run llama3.2            # 3B，需 ~6GB RAM
# 或低配替代
ollama run llama3.2:1b         # 1B，需 ~2GB RAM

# Part III RAG 需要的 embedding 模型
ollama pull mxbai-embed-large
```

### 2. Node.js（Part I–III 前端）

```bash
node -v      # 建议 24.8.0
```

### 3. Python

```bash
python --version   # 3.13.7
```

**推荐用虚拟环境隔离各 Part 的依赖：**

```bash
pyenv install 3.13.7
pyenv virtualenv 3.13.7 developers-guide-to-ai-part1
pyenv activate developers-guide-to-ai-part1
python -m pip install -r requirements.txt
```

到新的 Part 时改一下 part 编号建新环境即可（每个 Part 有自己的 `requirements.txt`）。

---

## 全书核心概念速查

### 提示与上下文

| 概念 | 一句话 |
| --- | --- |
| **Token / 上下文窗口** | 文本被切成 token；模型单次请求有 token 上限；1 token ≈ 4 字符 ≈ ¾ 词 |
| **Prompt 五要素** | Instruction / Context / Examples / Query / Output format |
| **Zero/One/Few-shot** | 靠预训练 / 给一个示例 / 给多个示例 |
| **Persona** | 给模型一个角色身份，隐式收窄范围、统一语气、省 token |
| **CoT（思维链）** | "Think step-by-step" 让模型先向自己解释再回答 |
| **CoD（草稿链）** | CoT 精简版："每步最多五个词" |
| **Prompt chaining** | 拆成多个聚焦步骤，前一步输出喂后一步 |
| **分隔符** | XML 标签 / 引号 / Markdown 帮 LLM 区分 prompt 各部分 |
| **Grounding（接地）** | 在推理时把缺失的上下文放进 prompt |
| **不确定性处理** | 指示模型"不知道就说不知道"，防幻觉 |
| **Guardrails** | Scope / Style / Compliance 三类护栏，前后夹击动态文本 |
| **Prompt injection** | "Ignore previous instructions..." — 用分隔符隔离 + 尾部重申护栏 |

### LLM 配置

| 参数 | 作用 |
| --- | --- |
| `max_tokens` / `num_predict` | 输出 token 上限，控成本和延迟 |
| Stop sequences | 遇到指定串立即停止生成 |
| `temperature` | 0 = 贪心（最确定），越高越有创意 |
| Top P | 核采样阈值，控制候选 token 的概率范围 |
| Top K | 控制候选 token 的实际数量 |

### 检索与向量

| 概念 | 一句话 |
| --- | --- |
| **Vector embedding** | 定长浮点数组 = 高维空间中的一个点，捕获语义 |
| **k-NN / ANN** | 找最近的 k 个邻居；ANN 用索引和聚类换效率（不保证精确） |
| **距离计算** | L2（欧氏，Chroma 默认）/ cosine（方向）/ ip（方向+长度） |
| **Chunking 策略** | Fixed size / **Recursive**（推荐起点）/ Document based / Semantic / Agentic |
| **chunk_overlap** | 相邻 chunk 重叠，减少想法被切断 |
| **RAG pipeline** | 摄取（分块→嵌入→索引）+ 推理（检索→增强→生成） |
| **Lost-in-the-middle** | LLM 更关注长 prompt 的首尾，中间易被忽略 → 重排序 |
| **Parent-child 检索** | 用小 chunk 匹配，返回大的父段落 |
| **Hybrid retrieval** | 关键词搜索 + 向量搜索混合 |
| **LLM evaluator** | LLM-as-a-judge，作为 RAG 流水线的质量闸门 |

### 微调

| 概念 | 一句话 |
| --- | --- |
| **三种策略** | 自监督（从模式学）/ 监督（从示例学）/ 强化学习（从反馈学） |
| **两种方法** | 无代码（AutoTrain）/ 技术性（Hugging Face 库） |
| **Overfitting** | 模型记住训练数据而非学到通用模式 |
| **Catastrophic forgetting** | 新训练覆盖了模型原有的知识和技能 |
| **PEFT** | 只引入少量额外参数，不改整个权重矩阵 |
| **LoRA** | PEFT 方法之一，冻结原层、注入小 adapter；rank `r` 是核心参数 |
| **Chat template** | 每个模型特有的指令格式（特殊 token + 结构规则） |
| **80-10-10** | 训练 / 验证 / 测试的推荐切分比例 |

### 智能体

| 概念 | 一句话 |
| --- | --- |
| **AI Agent** | 以 LLM 为"大脑"，自主 Planning + Tool use + Reasoning |
| **三种工作流** | 传统（无 AI，确定）/ AI（预定顺序，确定）/ **Agentic**（目标导向，非确定） |
| **Tool** | 用 `@tool` 装饰的 Python 函数；docstring + 类型提示是给 LLM 的说明书 |
| **MCP** | 让任何 agent 连接任何工具的开放标准；hosts / clients / servers |
| **MCP 组件** | Tools（可执行）/ Resources（可读）/ Prompts（可复用模板） |
| **MCP 传输** | stdio（本地单用户）/ HTTP（网络多客户端） |

---

## 常见决策：该用哪个方案？

```
你的问题是……

├─ 用传统代码能可靠解决？        → 别用 LLM（如解析邮箱域名）
│
├─ 需要语言理解或复杂模式识别？
│  │
│  ├─ 知识在模型训练数据内？      → 提示工程（Part II）
│  │
│  ├─ 需要你的私有/最新数据？     → RAG（Part III）
│  │
│  ├─ 需要模型本身在某技能上更强
│  │  或遵守高度特定的格式规则？   → 微调（Part IV）
│  │     ├─ 数据/算力有限，任务与预训练相似 → PEFT / LoRA
│  │     └─ 数据/算力充足，任务差异大        → 常规全量微调
│  │
│  └─ 需要 AI 自主规划、决策并
│     与外部系统交互？            → Agent + Tools + MCP（Part V）
│
└─ 极端专业、有海量标注数据、
   且有 ML 团队？                → 从零构建模型（本书不涉及）
```

---

## 贯穿全书的故事线

一个创业团队的演进，正好对应了这本书的五个部分：

| 阶段 | 问题 | 解法 | 对应 Part |
| --- | --- | --- | --- |
| 1️⃣ | 支持问题洪水般涌来 | 第一次简单的 LLM API 调用 | Part I |
| 2️⃣ | LLM 不了解他们的产品 | 更好的 prompt、persona、结构化输出 | Part II |
| 3️⃣ | 需要把知识库接进去 | RAG + 向量数据库 | Part III |
| 4️⃣ | 收件箱混乱，需要按公司特有类别分类 | 微调分类模型 | Part IV |
| 5️⃣ | 分好类了但跟进动作还是人工 | Agent + 工具 + MCP | Part V |

> **先给 AI 记忆，再给 AI 能动性。作为回报，AI 给了他们自由。**

---

## 使用建议

1. **每章配合代码跑一遍。** 概念看懂不等于会用，尤其是 prompt 相关的内容——同一个 prompt 在不同模型上的表现差异，只有亲手试才有感觉。
2. **把每章末尾的练习当作必做项。** 它们往往指向书里没展开但很关键的细节。
3. **Part IV 需要耐心。** 微调在 CPU 上可能跑几小时，建议先看 notebook 理解流程，再决定是否完整跑一遍。
4. **Part V 需要 API key**（Gemini）和可选的 MongoDB（费用管理器示例）。

---

## 官方资源

- **本书主页**：https://nostarch.com/developers-guide-to-AI
- **代码仓库**：https://github.com/jorshali/developers-guide-to-ai
- **问题反馈**：https://github.com/jorshali/developers-guide-to-ai/issues（被采纳的问题会让你的名字进入下一版致谢）
