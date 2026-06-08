# AI 漫剧工作室 (AI Comic Studio)

> **AI 漫剧 / AI 漫画制片的角色一致性生图工作流引擎** —— 角色锚定 → 场景锚定 → 模板化分镜 → 批量生成。一次配置，全剧复用。

[![Skill](https://img.shields.io/badge/Type-OpenClaw%20Skill-7B68EE)](./SKILL.md)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933)](https://nodejs.org)
[![Model](https://img.shields.io/badge/Model-gpt--image--2-FF6B6B)](https://aihubmix.com)

> 配合 LLM 自动调用请阅读 [SKILL.md](./SKILL.md)（含触发词、路由表、执行原则）。本 README 面向人工读者，讲清楚怎么手动跑。

---

## ✨ 这是什么

AI 漫剧工作室是一套**三层制片架构**的生图脚手架，专为「漫剧 / 短剧 / 动态漫画 / 漫画分镜」场景设计：

- 🎭 **角色锚定** —— 一次定义角色的脸型、骨相、五官 (`seed_prompt`)，全剧复用，跨场景脸不崩
- 🏛️ **场景锚定** —— 关键场景统一描述 + 色调 + 氛围，多帧氛围一致
- 🎬 **模板分镜** —— 全身立绘 / 半身特写 / 双人对话 / 战斗 / 氛围板 / 三视图 / 身份板 / 漫画分格，内置 8 套
- 🎞️ **批量出图** —— 一个 JSON 剧本，一行命令出整集

底层默认调用 `gpt-image-2`（通过 [aihubmix.com](https://aihubmix.com) 中转），prompt 全自动按层级拼接，使用者只需写**剧本骨架**。

---

## 🚀 快速开始

### 1. 安装

```bash
cd ~/.openclaw/skills/ai-comic-studio
npm install openai           # 唯一运行时依赖
```

### 2. 配置 API（必做）

```bash
cp .env.example .env
# 然后编辑 .env，填入：
#   AIHUBMIX_API_KEY=sk-xxx
#   AIHUBMIX_BASE_URL=https://aihubmix.com/v1   （可选，已是默认）
#   MODEL=gpt-image-2                            （可选，已是默认）
```

> `.env` 已在 [.gitignore](./.gitignore) 中，不会入库。脚本通过最简自实现解析器读取（无需 dotenv 依赖）。

### 3. 三步跑通

```bash
# 自由 prompt 测一张（不需要任何角色文件）
node scripts/gen-image.mjs "穿白衬衫的少女站在樱花树下"

# 用已配置角色 + 穿搭变体生图（需先按下文 Step 1 建好角色）
node scripts/gen-image.mjs --char 陈默 --variant formal --composition "全身立绘" --emotion "冷冽疏离"

# 批量生成一整集（需先按下文 Step 4 写好剧集 JSON）
node scripts/gen-episode.mjs ep01
```

输出位于 [outputs/](outputs/)，剧集模式额外生成 `manifest.json` 留档每帧完整 prompt。

---

## 📂 项目结构（真实）

```
ai-comic-studio/
├── SKILL.md                            # OpenClaw / Claude Skill 路由入口（必读）
├── README.md                           # 你正在看的这份
├── .env / .env.example                 # API 配置
├── .gitignore
│
├── scripts/                            # 引擎层（真实可执行）
│   ├── gen-image.mjs                   # 单图生成 CLI
│   ├── gen-episode.mjs                 # 整集批量生成 CLI
│   └── character-checker.mjs           # 角色出图一致性体检
│
├── references/                         # 资产层（所有「配置」的源头）
│   ├── characters/                     # 角色档案 (.json)
│   │   └── 角色模板.json               # ← 当前只内置模板骨架，需复制后填
│   ├── scenes/                         # 场景档案 (.json)
│   │   └── 场景模板.json               # ← 同上
│   ├── scripts/                        # 剧集分镜 JSON
│   │   └── 剧集模板.json               # ← 同上
│   └── templates/                      # 8 套构图模板说明 (.md)
│       ├── full-body.md                # 全身立绘
│       ├── half-body.md                # 半身特写
│       ├── three-view.md               # 角色三视图
│       ├── identity-board.md           # 身份板
│       ├── scene-board.md              # 场景氛围板（无人）
│       ├── conversation.md             # 双人对话
│       ├── fight.md                    # 战斗动作
│       └── comic-grid.md               # 漫画分格
│
└── outputs/                            # 出图目录（运行时自动创建）
    └── <episodeId>/
        ├── <frame_id>.jpg
        └── manifest.json               # 本集完整 prompt + 成败留档
```

> **关于「项目隔离」**：当前脚本将 `references/` 和 `outputs/` 锁死在 skill 根目录。
> 同时管理多个独立项目，目前需要 fork 整个 skill 目录；未来可扩展 `--project <id>` 参数（见 [SKILL.md](./SKILL.md) "建议命令"区）。

---

## 🎬 核心工作流

### Step 1 · 角色锚定（一次性）

复制角色模板，按真实角色填写：

```bash
cp references/characters/角色模板.json references/characters/陈默.json
```

模板字段示例（[references/characters/角色模板.json](references/characters/角色模板.json)）：

```json
{
  "name": "你的角色名",
  "id": "your-character-id",
  "seed_prompt": "角色不变的面部/体型描述：身高体型、脸型、五官特征、肤色、发型等（全剧固定，保证一致性）",
  "variants": {
    "casual": {
      "label": "日常穿搭",
      "prompt": "服装款式、颜色、材质、配饰、场景背景"
    },
    "formal": {
      "label": "正式着装",
      "prompt": "服装款式、颜色、材质、配饰、场景背景"
    }
  },
  "forbidden": ["在世艺术家名，避免风格模仿"],
  "aliases": ["风格替代词"],
  "art_style": "漫剧写实画风, cel-shading animation style, clean linework, cinematic composition",
  "output_aspect": "1024x1536"
}
```

**字段说明**：

| 字段 | 用途 |
|---|---|
| `name` | 角色显示名，建议**与 JSON 文件名一致**，方便脚本按名查找 |
| `id` | 英文唯一标识符（可选） |
| `seed_prompt` | 不随场景变化的**面部 + 骨相 + 体型**固定描述 —— 脸不崩的根基 |
| `variants.<key>.prompt` | 每个场景下的**穿搭 + 状态**描述（同一角色不同造型） |
| `variants.<key>.label` | 该变体的中文说明 |
| `forbidden` | 触发拦截的违规词（在世艺术家名等） |
| `aliases` | 替代用的安全风格词 |
| `art_style` | 该角色专属画风（可选） |
| `output_aspect` | 默认出图尺寸（脚本目前未消费，由剧集 frame 的 `size` 覆盖） |

> **关键铁律**：`seed_prompt` 一旦固定就别再改，只通过 `variants` 切换造型。这是角色一致性的根基。

### Step 2 · 场景锚定（按需）

```bash
cp references/scenes/场景模板.json references/scenes/总裁办公室.json
```

模板字段（[references/scenes/场景模板.json](references/scenes/场景模板.json)）：

```json
{
  "name": "场景名",
  "id": "scene-id",
  "seed_prompt": "场景核心描述：空间类型、建筑风格、色调、光线、氛围",
  "color_grading": "色调方案",
  "mood": "情绪氛围标签"
}
```

### Step 3 · 选构图模板

[references/templates/](references/templates/) 提供 8 套：

| 模板 | 用途 | 必填字段 |
|---|---|---|
| `full-body.md` | 全身立绘 | `composition` + `emotion` |
| `half-body.md` | 半身特写 | `composition` + `emotion` |
| `three-view.md` | 角色三视图 | — |
| `identity-board.md` | 角色身份展示板 | — |
| `scene-board.md` | 场景氛围板（无人） | `prompt`（场景描述） |
| `conversation.md` | 双人对话（自动合并两个角色的 seed_prompt） | 两个角色 + `composition` |
| `fight.md` | 战斗动作 | `composition` + `emotion` |
| `comic-grid.md` | 多格漫画 | 分格描述 |

### Step 4 · 写剧本，一键出整集

```bash
cp references/scripts/剧集模板.json references/scripts/ep01.json
```

骨架（[references/scripts/剧集模板.json](references/scripts/剧集模板.json)）：

```json
{
  "title": "第N章：章节名",
  "scenes": [
    {
      "id": "s1_f1",
      "template": "scene-board",
      "prompt": "场景氛围描述",
      "size": "1536x1024"
    },
    {
      "id": "s1_f2",
      "template": "full-body",
      "characters": ["角色名(穿搭变体)"],
      "composition": "构图描述",
      "emotion": "情绪描述",
      "size": "1024x1536"
    },
    {
      "id": "s1_f3",
      "template": "conversation",
      "characters": ["角色A(变体1)", "角色B(变体2)"],
      "composition": "双人构图描述",
      "emotion": "氛围描述",
      "size": "1536x1024"
    }
  ]
}
```

完整范例（假设你已建好 `陈默.json` / `孟婉.json` / `总裁办公室.json`）：

```json
{
  "title": "第1章：血色订婚宴",
  "scenes": [
    {
      "id": "s1_f1",
      "template": "scene-board",
      "prompt": "夜色中的陈氏庄园，灯火辉煌，红地毯铺向大厅入口",
      "scene": "总裁办公室",
      "size": "1536x1024"
    },
    {
      "id": "s1_f2",
      "template": "full-body",
      "characters": ["陈默(gala)"],
      "composition": "黑色晚宴礼服全身立绘，角落暗处伫立",
      "emotion": "墨镜遮眼，破碎豪门总裁氛围",
      "size": "1024x1536"
    },
    {
      "id": "s1_f4",
      "template": "conversation",
      "characters": ["陈默(gala)", "孟婉(red_silk)"],
      "composition": "宴会长桌两侧对峙",
      "emotion": "剑拔弩张的紧张氛围",
      "size": "1536x1024"
    }
  ]
}
```

**角色引用语法**：`"角色名(variant名)"`，例：`"陈默(gala)"` = 加载 `陈默.json` + 套用 `variants.gala` 变体。

跑：

```bash
node scripts/gen-episode.mjs ep01
```

脚本会**串行**生图（避免触发限流，每帧间隔 2s），输出到 [outputs/ep01/](outputs/ep01/)，附带 `manifest.json` 留档完整 prompt 链。**单帧失败不中断**，最后汇总成败列表。

> `scenes[].frames[]` 也支持嵌套写法（同一场景多帧时方便组织），脚本会自动拍平。

---

## 🛠️ 脚本详解

### `gen-image.mjs` — 单图 CLI

```bash
# 自由 prompt（不拼角色锚点）
node scripts/gen-image.mjs "你的提示词"

# 角色 + 变体 + 构图 + 情绪
node scripts/gen-image.mjs --char 陈默 --variant formal --composition "全身立绘" --emotion "冷冽疏离"

# 自定义输出目录
node scripts/gen-image.mjs --char 孟婉 -v gala -o ./my-outputs

# 列出所有已注册角色及其变体（不生图）
node scripts/gen-image.mjs --list-chars
```

| 参数 | 简写 | 说明 |
|---|---|---|
| `--char` | `-c` | 角色名（按 `references/characters/<name>.json` 查找，支持前缀/包含模糊匹配） |
| `--variant` | `-v` | 穿搭变体 key（不指定时取第一个） |
| `--composition` | — | 构图描述 |
| `--emotion` | — | 情绪描述 |
| `--output` | `-o` | 输出目录（默认 `outputs/`） |
| `--list-chars` | — | 列出所有角色和可用变体 |

**Prompt 拼接顺序**（[gen-image.mjs:56-77](scripts/gen-image.mjs#L56-L77)）：
```
seed_prompt + variants[v].prompt + composition + emotion + art_style + GLOBAL_STYLE
```

### `gen-episode.mjs` — 批量整集

```bash
node scripts/gen-episode.mjs <episodeId>
# 示例
node scripts/gen-episode.mjs ep01
```

- 读取 `references/scripts/<episodeId>.json`
- 顺序生成所有帧，单帧失败不中断后续（异常会写进 manifest）
- 输出附带 `manifest.json` 留档 prompt + 路径 + 时间戳 + 成败

### `character-checker.mjs` — 一致性体检

```bash
node scripts/character-checker.mjs <角色名>
# 示例
node scripts/character-checker.mjs 陈默
```

扫描该角色在 `outputs/*/` 下的所有出图，做**启发式**体检：

- 文件大小离群（< 中位数 30% 视为坏图）
- 时间戳聚类（识别批次）
- 列出穿搭变体关键词便于人工对照

> **当前只是启发式**，不做语义对比。真·语义一致性需接入 CLIP embedding 算余弦相似度，脚本预留了扩展点（见 [SKILL.md](./SKILL.md) "建议命令"区中的 `check-character-consistency.mjs`）。

---

## 🎨 全剧画风一致性约定

所有生图自动追加固定后缀（写死在 [gen-image.mjs:31](scripts/gen-image.mjs#L31) 和 [gen-episode.mjs:29](scripts/gen-episode.mjs#L29)）：

```
professional cinematic lighting, high detail, cel-shading animation style with clean linework,
consistent warm-cool color grading, 16:9 cinematic composition
```

**修改这一行 = 修改全剧基调，慎改**。改完之后生的新图会和旧图风格分裂。

---

## ⚠️ 注意事项

1. **在世艺术家名禁用** —— 触发审查拦截，必须放入角色 `forbidden`，用 `aliases` 替代
   - ❌ `Hayao Miyazaki style` → ✅ `bright Japanese anime style`
2. **`seed_prompt` 不可变** —— 一旦固定就不要再改，所有面部/体型描述只放在这里
3. **`variants` 只描述「穿搭 + 状态」** —— 不要污染面部和体型信息
4. **多人场景走 conversation 模板** —— 避免手动拼角色 prompt 顺序不一致
5. **批量限流** —— `gen-episode.mjs` 每帧间默认延迟 2s，过激并发会被限流
6. **画风后缀别频繁动** —— 改一次后再补的旧图会和新图风格分裂
7. **`negative_prompt` 字段当前未消费** —— 角色 JSON 里有 `forbidden`，但脚本目前不会把它拼成 negative prompt 发请求。需要负向控制只能改写正向 prompt 的反向措辞，或扩展脚本。
8. **API Key 通过 `.env` 读取** —— 不要把 key 提交到仓库；`.env` 已在 `.gitignore` 中。

---

## 🧩 作为 Skill 调用（自动化）

本项目自带 [SKILL.md](./SKILL.md)，包含完整的：

- **触发词清单**（`description` 里的 Use when ...） —— 让 OpenClaw / Claude 决定何时进入本 skill
- **用户意图 → 操作路由表** —— 12 行映射，覆盖建角色、出图、批量、提示词优化、ComfyUI 等
- **执行原则** —— 8 条工程化规则（先分类、必查存在性、身份不可变、缺配置先建模板等）
- **建议命令 / 待实现命令** —— 明确标注当前尚未实现的能力

LLM agent（OpenClaw 或 Claude Code）会按 SKILL.md 引导：先建角色 → 锚场景 → 写剧本 → 出图，并在缺少配置时自动复制模板。

---

## 📝 License

私有 / 内部使用。所属：openclaw skills 集合。
