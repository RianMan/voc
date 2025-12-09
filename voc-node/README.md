# SmartQarza VOC 智能分析系统

基于 DeepSeek V3 AI 模型的客户声音（VOC）自动化分析工具。专为巴基斯坦现金贷业务设计，能够识别 Roman Urdu、检测合规风险并生成结构化报告。

## 🛠️ 项目结构

- `src/fetch.js`: Google Play 评论爬虫
- `src/analyze.js`: DeepSeek AI 分析核心逻辑
- `data/`: 存放生成的数据文件

## 🚀 快速开始

### 1. 安装依赖

确保已安装 Node.js (v18+)，然后在终端运行：

```bash
npm install
```

### 2. 配置环境

项目根目录下已创建 `.env` 文件，请确保里面填入了正确的 API Key：

```env
DEEPSEEK_API_KEY=sk-xxxxxx
```

### 3. 运行系统

**第一步：抓取最新评论**

```bash
npm run fetch
```

*成功后会在 `data/` 目录生成 `raw_reviews.json`*

**第二步：AI 智能分析**

```bash
npm run analyze
```

*成功后会在 `data/` 目录生成 `analyzed_report.json`*

### 4. 查看结果

打开 `data/analyzed_report.json`，你将看到如下结构的数据：

```json
[
  {
    "id": "gp:AOqp...",
    "category": "Compliance_Risk",
    "summary": "用户投诉催收员威胁要告知其父母",
    "risk_level": "High",
    "translated_text": "你们的人打电话给我爸爸，我要去报警"
  }
]
```


voc-node-refactor/
├── server.js              # 入口（仅20行）
├── package.json
├── .env.example
├── src/
│   ├── db.js              # 数据库操作
│   ├── routes/
│   │   ├── index.js       # 路由汇总
│   │   ├── voc.js         # GET /api/voc-data
│   │   ├── status.js      # PUT /api/voc/:id/status 等
│   │   └── report.js      # POST /api/report/generate
│   └── services/
│       ├── dataLoader.js  # 数据加载/筛选/分页
│       └── reportGen.js   # AI报告生成
