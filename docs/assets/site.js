/* ================================================================
   AI 开发者指南 · 共享脚本：侧边栏、目录、代码高亮、主题
   ================================================================ */
(function () {
  'use strict';

  var CHAPTERS = [
    { n: 1,  t: '理解大语言模型',       d: 'LLM 怎么训练、怎么预测下一个 token，以及它的四大局限', part: '第一部分 · 起步' },
    { n: 2,  t: '构建第一个 LLM 应用',  d: 'Ollama + Hono + 流式响应 + React 聊天界面' },
    { n: 3,  t: 'Python 要点',          d: 'FastAPI、Ollama SDK、Pydantic 与 yield 生成器' },
    { n: 4,  t: '提示工程基础',         d: 'Prompt 五要素、上下文窗口、token 与成本', part: '第二部分 · 提示工程' },
    { n: 5,  t: '提示工程技巧',         d: 'Persona、few-shot、思维链、提示链与分隔符' },
    { n: 6,  t: '代码中的提示工程',      d: 'LLM 参数、模板、对话历史、结构化输出与护栏' },
    { n: 7,  t: '向量数据库实战',       d: 'Embedding、Chroma、语义搜索与推荐', part: '第三部分 · 向量数据库与 RAG' },
    { n: 8,  t: '设计 RAG 系统',        d: '分块、检索、引用、重排序与混合检索' },
    { n: 9,  t: '何时定制模型',         d: '从零训练 vs 微调，三种策略与三个步骤', part: '第四部分 · 让模型适配任务' },
    { n: 10, t: '为微调准备数据',       d: '收集、组织、编码标签与 80-10-10 切分' },
    { n: 11, t: '微调实战',             d: 'DistilBERT 分类、chat template、LoRA 与 SFTTrainer' },
    { n: 12, t: '从工作流到智能体',      d: '什么是 Agent，三种工作流怎么选', part: '第五部分 · 智能体系统' },
    { n: 13, t: '构建自主智能体',        d: 'smolagents + LiteLLM + Gemini 跑通第一个 Agent' },
    { n: 14, t: '用工具扩展智能体',      d: '自定义工具、MCP 协议与 FastMCP 服务器' }
  ];

  var cur = parseInt(document.body.dataset.chapter || '0', 10);

  /* ---------- 侧边栏 ---------- */
  var side = document.getElementById('sidebar');
  if (side) {
    var html = '<a class="brand" href="index.html"><span class="flame">&#129302;</span>' +
      '<span>AI 开发者指南<small>给写代码的人的 AI 实战课</small></span></a>';
    CHAPTERS.forEach(function (c) {
      if (c.part) html += '<div class="part">' + c.part + '</div>';
      html += '<a class="ch' + (c.n === cur ? ' active' : '') + '" href="ch' +
        pad(c.n) + '.html"><span class="n">' + c.n + '</span><span>' + c.t + '</span></a>';
    });
    side.innerHTML = html;
    var active = side.querySelector('a.ch.active');
    if (active) setTimeout(function () {
      active.scrollIntoView({ block: 'center' });
    }, 0);
  }

  /* ---------- 移动端菜单 ---------- */
  var btn = document.createElement('button');
  btn.id = 'menu-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '目录');
  btn.innerHTML = '&#9776;';
  btn.onclick = function () { document.body.classList.toggle('nav-open'); };
  document.body.appendChild(btn);
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('nav-open') &&
        side && !side.contains(e.target) && e.target !== btn) {
      document.body.classList.remove('nav-open');
    }
  });

  /* ---------- 主题切换 ---------- */
  var tbtn = document.createElement('button');
  tbtn.id = 'theme-btn';
  tbtn.type = 'button';
  tbtn.setAttribute('aria-label', '切换深浅色');
  tbtn.innerHTML = '&#9789;';
  tbtn.onclick = function () {
    var root = document.documentElement;
    var now = root.getAttribute('data-theme');
    var dark = now ? now === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('ai-guide-theme', dark ? 'light' : 'dark'); } catch (e) {}
  };
  document.body.appendChild(tbtn);
  try {
    var saved = localStorage.getItem('ai-guide-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}

  /* ---------- 箭头 marker（全局一次） ---------- */
  var defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.setAttribute('style', 'position:absolute');
  // SVG marker 的内容不会从引用它的元素继承 color，所以直接用 CSS 变量填色
  function mk(id, v) {
    return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="var(' + v + ')"/></marker>';
  }
  defs.innerHTML = '<defs>' + mk('ar', '--fg-faint') + mk('ar-a', '--accent') + mk('ar-b', '--blue') +
    mk('ar-g', '--green') + mk('ar-p', '--purple') + mk('ar-r', '--red') + '</defs>';
  document.body.appendChild(defs);

  /* ---------- 章节内目录 ---------- */
  var main = document.querySelector('main');
  var slot = document.getElementById('chapter-toc');
  if (slot && main) {
    var hs = main.querySelectorAll('h2');
    if (hs.length > 2) {
      var t = '<div class="h">本章目录</div><ol>';
      hs.forEach(function (h, i) {
        if (!h.id) h.id = 'sec-' + (i + 1);
        t += '<li><a href="#' + h.id + '">' + h.textContent + '</a></li>';
      });
      slot.className = 'toc';
      slot.innerHTML = t + '</ol>';
    }
  }

  /* ---------- 代码块：语言标签 + 复制 + 高亮 ---------- */
  var JS_KW = ('const|let|var|function|return|if|else|await|async|import|from|export|default|new|class|' +
    'extends|for|while|of|in|do|try|catch|finally|throw|switch|case|break|continue|' +
    'type|interface|as|typeof|instanceof|null|undefined|true|false|this').split('|');

  var PY_KW = ('def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|with|' +
    'try|except|finally|raise|pass|break|continue|lambda|yield|async|await|global|' +
    'None|True|False|self|print').split('|');

  function langRe(kw, comment) {
    return new RegExp(
      '(' + comment + ')' +                                              // 1 注释
      '|("""[\\s\\S]*?"""|`(?:\\\\[\\s\\S]|[^\\\\`])*`|[fr]?\'(?:\\\\[\\s\\S]|[^\\\\\'\\n])*\'|[fr]?"(?:\\\\[\\s\\S]|[^\\\\"\\n])*")' + // 2 字符串
      '|\\b(' + kw.join('|') + ')\\b' +                                  // 3 关键字
      '|\\b([A-Z][A-Za-z0-9_]*)\\b' +                                    // 4 类型/构造器
      '|\\b(\\d+(?:\\.\\d+)?)\\b' +                                      // 5 数字
      '|(@[\\w.]+|\\b[a-zA-Z_$][\\w$]*(?=\\())',                         // 6 装饰器 / 函数调用
      'g');
  }
  var RE_JS = langRe(JS_KW, '\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*');
  var RE_PY = langRe(PY_KW, '#[^\\n]*');
  var RE_SH = /(#[^\n]*)|('(?:\\[\s\S]|[^\\'])*'|"(?:\\[\s\S]|[^\\"])*")|\b(npm|npx|node|git|cd|mkdir|curl|export|ollama|python|pip|pyenv|uv|fastapi|uvicorn|source|brew)\b/g;
  var RE_JSON = /("(?:\\[\s\S]|[^\\"])*")(?=\s*:)|("(?:\\[\s\S]|[^\\"])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function paint(src, re, classes) {
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      for (var g = 1; g < m.length; g++) {
        if (m[g] !== undefined) { out += '<span class="' + classes[g - 1] + '">' + esc(m[g]) + '</span>'; break; }
      }
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + esc(src.slice(last));
  }

  document.querySelectorAll('.code').forEach(function (box) {
    var pre = box.querySelector('pre');
    if (!pre) return;
    var lang = box.dataset.lang || '';
    var file = box.dataset.file || '';
    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = '<span class="tag">' + esc(file || lang || 'code') + '</span>';
    var cp = document.createElement('button');
    cp.className = 'copy'; cp.type = 'button'; cp.textContent = '复制';
    cp.onclick = function () {
      var txt = pre.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      cp.textContent = '已复制'; setTimeout(function () { cp.textContent = '复制'; }, 1400);
    };
    bar.appendChild(cp);
    box.insertBefore(bar, pre);

    var code = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      pre.innerHTML = paint(code, RE_SH, ['tk-cm', 'tk-st', 'tk-kw']);
    } else if (lang === 'python' || lang === 'py') {
      pre.innerHTML = paint(code, RE_PY, ['tk-cm', 'tk-st', 'tk-kw', 'tk-tp', 'tk-nm', 'tk-fn']);
    } else if (lang === 'json') {
      pre.innerHTML = paint(code, RE_JSON, ['tk-fn', 'tk-st', 'tk-kw', 'tk-nm']);
    } else if (lang === 'text' || lang === 'prompt' || lang === 'jinja') {
      pre.innerHTML = esc(code);
    } else {
      pre.innerHTML = paint(code, RE_JS, ['tk-cm', 'tk-st', 'tk-kw', 'tk-tp', 'tk-nm', 'tk-fn']);
    }
  });

  /* ---------- 上一章 / 下一章 ---------- */
  var pager = document.getElementById('pager');
  if (pager && cur) {
    var prev = CHAPTERS.find(function (c) { return c.n === cur - 1; });
    var next = CHAPTERS.find(function (c) { return c.n === cur + 1; });
    var h = '';
    h += prev ? '<a class="prev" href="ch' + pad(prev.n) + '.html"><span>&larr; 上一章</span>第 ' + prev.n + ' 章 · ' + prev.t + '</a>'
              : '<a class="prev" href="index.html"><span>&larr; 返回</span>课程首页</a>';
    h += next ? '<a class="next" href="ch' + pad(next.n) + '.html"><span>下一章 &rarr;</span>第 ' + next.n + ' 章 · ' + next.t + '</a>'
              : '<a class="next" href="index.html"><span>全部完成 &rarr;</span>回到课程首页</a>';
    pager.className = 'pager';
    pager.innerHTML = h;
  }

  /* ---------- 首页目录 ---------- */
  var grid = document.getElementById('toc-grid');
  if (grid) {
    var g = '';
    CHAPTERS.forEach(function (c) {
      if (c.part) g += '<div class="toc-part">' + c.part + '</div>';
      g += '<a class="toc-card" href="ch' + pad(c.n) + '.html">' +
        '<div class="n">第 ' + c.n + ' 章</div>' +
        '<div class="t">' + c.t + '</div>' +
        '<div class="d">' + c.d + '</div></a>';
    });
    grid.className = 'toc-grid';
    grid.innerHTML = g;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
})();
