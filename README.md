# 智选云 AI 电商在线售货系统 · AI-ECP

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-online-success?style=flat-square)](https://2a868c4f84b54117a60e337b65577b83.app.workbuddy.host)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tech: Vanilla JS](https://img.shields.io/badge/Tech-Vanilla_JS-yellow.svg?style=flat-square)](#技术栈)
[![AI Capabilities](https://img.shields.io/badge/AI-3_Capabilities-purple.svg?style=flat-square)](#-ai-能力引擎)

> 支持 **智能客服 / 智能选品 / 智能组货** 三项 AI 能力的电商在线售货系统；
> 商品品类由用户以 JSON 文本自定义，系统解析后自动确立品类结构与属性 Schema，**新增品类无需发版**。

## 🌐 在线演示

**主站（含 22 幅 UML 图与正式报告）**：
👉 https://2a868c4f84b54117a60e337b65577b83.app.workbuddy.host/

**动态电商 SPA 直达**（推荐体验此入口）：
👉 https://2a868c4f84b54117a60e337b65577b83.app.workbuddy.host/app.html

打开后建议体验路径：
- 🏠 首页 → 浏览商品 → 体验「智能组货」一键加购
- 🤖 智能客服 → 试问「查询订单」「什么是 JSON 自定义品类」
- 🎯 AI 选品 → 切换不同兴趣标签查看推荐变化
- 🏪 商家中心 → JSON 自定义品类 → 五步处理可视化

## ✨ 项目亮点

| 能力 | 实现 |
|------|------|
| 🧠 **智能客服** | 意图分流 → RAG 检索增强 / 受控工具调用 → 流式答复 → 安全护栏降级 |
| 🎯 **智能选品** | 画像装载 → 多路召回（协同/语义/热门）→ 精排打分 → 业务规则过滤 → 多样性重排 → 冷启动兜底 |
| 🧩 **智能组货** | 关联规则引擎识别场景 → 配套召回 → **四维可行性校验**（库存/价格/履约/毛利）→ 组合定价 → 大模型生成搭配理由 |
| 🛍️ **JSON 自定义品类** | 完整复现设计报告五步链路：**语法校验 → 结构语义校验 → 品类树构建 → 衍生能力生成 → 落库发布**，动态生成「发布表单 / 索引映射 / AI 提示词」三类衍生产物 |

## 📦 仓库结构

```
zhixuan-cloud/
├── index.html                  # 增强版首页（含成果展示 + Demo 入口）
├── app.html                    # 动态电商 SPA 主入口（9 大视图）
├── requirements.html           # 需求分析报告（HTML 版）
├── design.html                 # 系统设计报告（HTML 版）
├── diagrams.html               # 22 幅 UML 图集
├── diagrams/                   # 22 幅 SVG 图源文件
├── assets/
│   ├── css/app.css             # 动态电商业务样式（571 行）
│   ├── js/data.js              # 商品库 / 品类 / SKU / 知识库 / 关联规则（434 行）
│   ├── js/category-engine.js   # JSON 品类自定义引擎（176 行）
│   ├── js/ai-engine.js         # AI 三能力引擎（299 行）
│   ├── js/app.js               # SPA 主逻辑（864 行）
│   ├── style.css               # 原报告页样式
│   ├── app.js                  # 原报告页脚本
│   ├── qrcode.svg / .png       # 站点访问二维码
└── README.md                   # 本文件
```

**代码规模**：2671 行业务代码（HTML + CSS + JS），零外部依赖。

## 🎯 核心视图

### 消费者端（C 端）
- 🏠 **首页**：Hero 横幅、品类入口、热销榜单、AI 推荐试看
- 📂 **分类浏览**：由品类 JSON Schema 自动生成筛选维度（动态属性）
- 📱 **商品详情**：动态规格渲染、SKU 选择、AI 组货联动
- 🧠 **AI 选品**：完整的「画像 → 多路召回 → 精排 → 过滤 → 重排」链路
- 🤖 **智能客服**：知识型问题走 RAG，业务事实型问题走工具调用，置信度不足自动转人工
- 🛒 **购物车**：增删、数量调整、来源标记（智能组货/单品）
- 📝 **结算**：地址、支付方式、订单生成
- 📦 **我的订单**：实时订单状态展示

### 商家端（B 端）
- 📊 **经营概览**：商品/品类/订单/库存统计
- 📦 **商品管理**：列表、上架/下架、删除、**动态表单新增**（由品类 Schema 自动生成）
- 🧩 **JSON 自定义品类**：编辑器 + 模板 + 五步处理可视化 + 三类衍生产物展示
- 🧾 **订单管理**：全部订单实时展示

## 🤖 AI 能力引擎

### 智能客服（设计报告 3-4 / 4-11）
```
用户输入 → 意图分流
  ├─ 业务事实型 → 受控工具调用（订单查询/库存查询/物流查询）
  └─ 知识咨询型 → RAG 检索增强（关键词+标签加权 Top-3）
       ↓
    提示词组装 → 流式生成 → 安全护栏
       ↓
    置信度 < 0.30 → 降级为转人工
```

### 智能选品（设计报告 3-7 / 4-12）
```
画像装载 → 多路召回（协同 + 语义 + 热门）
    ↓
精排打分（多路命中加权 + 偏好 + 评分 + 销量 + 库存）
    ↓
业务规则过滤（已下架/缺货拦截）
    ↓
多样性重排（同品类 ≤ 2）
    ↓
冷启动兜底（不足 4 条时补全热门）
    ↓
生成推荐理由（解释召回路径）
```

### 智能组货（设计报告 3-8 / 4-13）
```
主商品 → 关联规则引擎识别场景
    ↓
配套召回（场景相关的 N 件商品）
    ↓
四维可行性校验：
  ├─ ✅ 库存可用性（主+配均有现货）
  ├─ ✅ 价格合理性（配 ≤ 主 × 5）
  ├─ ✅ 履约能力（智选云直发可合并）
  └─ ✅ 毛利测算（毛利率 ≥ 12%）
    ↓
四维全过 → 组合定价 + 大模型生成搭配理由
任一不过 → 降级为单品推荐
```

## 🧩 JSON 自定义品类引擎

完整复现设计报告 3.6 节定义的五步处理链路：

1. **语法校验**：`JSON.parse` + 错误位置（行列）+ 上下文片段
2. **结构语义校验**：code 命名规范、必填字段、attrCode 唯一性、dataType 白名单、enum.valueRange 完整性
3. **品类树构建**：版本号自增、覆盖式更新
4. **衍生能力生成**：动态表单 Schema、索引映射（filterable/searchable/sortable）、AI 提示词上下文片段
5. **落库发布**：localStorage 持久化 + 商家端 UI 即时刷新

**特色**：商家只需提交一段 JSON 文本，描述品类结构与属性 Schema，系统会自动生成动态发布表单、检索索引、AI 提示词上下文，**整个流程无需代码改动**。

## 🚀 本地运行

```bash
git clone https://github.com/pineapplesliceer/zhixuan-cloud-ai-ecp.git
cd zhixuan-cloud-ai-ecp
python -m http.server 8000
# 浏览器打开 http://localhost:8000/
```

或直接双击打开 `index.html`（首次访问会自动初始化 localStorage 数据）。

## 📐 技术栈

- **前端**：HTML5 + CSS3 + 原生 JavaScript（ES2020+），无任何框架
- **数据存储**：localStorage（购物车 / 订单 / 品类 / 用户画像）
- **样式**：手写 CSS（CSS 变量 + Grid + Flexbox）
- **图源**：22 幅 PlantUML 生成的 UML 图（SVG / PNG 200 DPI）

## 📜 许可

本项目以 MIT 许可证开源，可自由使用与修改。

## 🙋 关于

由 AI 辅助设计与实现。如果你有任何建议或想贡献，欢迎提 Issue 或 PR。