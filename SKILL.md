---
name: ai-comic-studio
description: >
  AI 漫剧 / AI 漫画角色一致性生图工作流引擎。三层架构：角色锚定（seed_prompt 固定五官体型）→
  场景锚定（color_grading + mood）→ 构图模板化分镜 → 批量生成。本 skill 只含引擎脚本和模板骨架，
  剧集与角色数据需要由 OpenClaw 在 references/ 下创建。
  Use when 用户提到以下任意任务时调用本 skill：
  ① AI 漫剧 / AI 漫画 / 漫画分镜 / 漫剧分镜 / 角色一致性生图；
  ② 生成角色立绘、角色头像、角色三视图、角色 variants（穿搭变体）；
  ③ 配置角色 seed_prompt / negative prompt / forbidden / 角色参考模板；
  ④ 根据剧本生成分镜图提示词、根据章节拆分镜头；
  ⑤ 批量生成某一集、某一场景、某一角色相关图片；
  ⑥ 检查角色一致性、提示词一致性、构图模板一致性；
  ⑦ 调用 ComfyUI / image API / aihubmix / 生图脚本完成批量出图；
  ⑧ 在 AI 漫剧项目中做角色设定、场景设定、分镜设定、图片生成流程。
metadata:
  version: 0.2.1
  domain: ai-comic-image-workflow
---

# AI 漫剧工作室

三层制片架构：**角色锚定 → 场景锚定 → 分镜模板 → 批量生成**。
一次配置角色，全剧复用。

> 本文件 (`SKILL.md`) 是 **OpenClaw / Claude 自动调用入口**，含触发词 + 路由表 + 执行原则。
> 面向人工读者的详细工作流见 [README.md](README.md)。两份文件保持事实一致，README 是 SKILL 的展开版。

---

## 📁 真实目录结构

```
skills/ai-comic-studio/                ← 本 skill（引擎 + 模板 + 数据全部内置）
├── SKILL.md                            ← 本文件
├── README.md                           ← 详细工作流文档
├── .env / .env.example                 ← API 配置（AIHUBMIX_API_KEY 等）
├── scripts/                            ← 真实可执行的生图引擎
│   ├── gen-image.mjs                   ← 单张生图（CLI）
│   ├── gen-episode.mjs                 ← 批量生一集（CLI）
│   └── character-checker.mjs           ← 一致性检查（CLI）
├── references/
│   ├── characters/                     ← 角色配置 JSON（含模板）
│   │   └── 角色模板.json
│   ├── scenes/                         ← 场景配置 JSON（含模板）
│   │   └── 场景模板.json
│   ├── scripts/                        ← 剧集分镜 JSON（含模板）
│   │   └── 剧集模板.json
│   └── templates/                      ← 8 种构图模板说明
│       ├── full-body.md
│       ├── half-body.md
│       ├── three-view.md
│       ├── identity-board.md
│       ├── scene-board.md
│       ├── conversation.md
│       ├── fight.md
│       └── comic-grid.md
└── outputs/                            ← 生图输出（运行时自动建）
    └── <episodeId>/<frame_id>.jpg + manifest.json
```

> **重要**：当前脚本将数据路径**硬编码**为 `SKILL_ROOT/references/`，
> 没有 `--project` 参数。新角色/场景/剧集 JSON 必须直接放在
> `references/characters/`、`references/scenes/`、`references/scripts/` 三个目录下。
> 若未来需要多项目隔离，见文末「建议命令 / 待实现命令」区。

---

## 🧭 用户意图 → OpenClaw 操作路由表

| 用户意图 / 说法 | OpenClaw 应该执行的操作 |
|---|---|
| "新建角色 XX" / "建一个新角色" | 复制 `references/characters/角色模板.json` → `references/characters/XX.json`，填写 `name`、`id`、`seed_prompt`（五官体型，全剧固定）、`variants`（至少 1 种穿搭）、`forbidden`、`aliases`、`art_style`、`output_aspect`。`name` 字段建议与文件名一致以便脚本按名查找。 |
| "新建场景 XX" / "建一个场景" | 复制 `references/scenes/场景模板.json` → `references/scenes/XX.json`，填写 `seed_prompt`、`color_grading`、`mood`。 |
| "生成 XX 的全身立绘" | 先 `node scripts/gen-image.mjs --list-chars` 确认角色存在 → `node scripts/gen-image.mjs --char XX --variant <变体> --composition "全身立绘, 正面视角"` |
| "生成 XX 的半身像" | `node scripts/gen-image.mjs --char XX --variant <变体> --composition "half body portrait, upper body"` |
| "生成 XX 的三视图" | 仍以角色 `seed_prompt` 为锚，**不改五官/服装/身份**，只换视角：分别用 `--composition "front view"`、`"side view"`、`"back view"` 各跑一次。或写一条 `three-view` 模板的剧集帧。 |
| "用自由提示词生成一张" | `node scripts/gen-image.mjs "自由提示词"`（不会拼角色锚点） |
| "把第 1 集全画了" / "批量生 ep01" | 检查 `references/scripts/ep01.json` 是否存在 → 校验里面引用的所有 `characters/<角色>` 和 `scene` 都已在 `references/` 下 → `node scripts/gen-episode.mjs ep01` |
| "根据这段剧本生成分镜" | ① 把剧本按镜头拆成 frame 列表 → ② 每个 frame 选模板（独人 `full-body`/`half-body`、双人 `conversation`、动作 `fight`、空景 `scene-board`、多格 `comic-grid`） → ③ 绑定 `characters: ["角色名(变体)"]` 和 `scene: "场景名"` → ④ 填 `composition`、`emotion` → ⑤ 写入 `references/scripts/<epId>.json` → ⑥ 询问用户是否立即 `gen-episode`。 |
| "检查角色一致性" | `node scripts/character-checker.mjs XX`。脚本会列出该角色已生图，按文件大小中位数找异常帧。**注意**：当前实现只做大小/时间戳启发式，不做语义对比，输出后需结合人工/CLIP 进一步验证。 |
| "优化这张图的提示词" | **保留 `seed_prompt` 和 `variant.prompt` 不动**，只调 `composition` / `emotion` / 镜头 / 光影 / 风格后缀。绝不重写角色身份。 |
| "调用 ComfyUI 生成" | **当前脚本走 aihubmix `/models/openai/<MODEL>/predictions` 接口，不是 ComfyUI**。如需 ComfyUI，见文末「建议命令」区，目前需新增 workflow JSON 与 runner。 |
| 用户没说项目/角色/集数 | 先看 `references/characters/` 下已有角色列表、`references/scripts/` 下已有剧集列表，能唯一推断就直接用；否则用 `AskUserQuestion` 询问。 |

---

## 🛠 OpenClaw 执行原则

1. **先分类，再动手**。把用户请求归到这 6 类之一：
   `[角色创建] [角色出图] [分镜生成] [批量生成] [提示词优化] [流程检查]`
   分类决定走路由表哪一行。
2. **执行前必查存在性**。任何调用 `gen-image.mjs --char X` 之前，确认 `references/characters/X.json` 存在；任何调用 `gen-episode.mjs <ep>` 之前，确认 `references/scripts/<ep>.json` 存在，并且其中每个 `characters: ["A(v)"]` 的 `A` 和每个 `scene: "S"` 的 `S` 都已在对应目录下。**缺一律不发请求**。
3. **角色身份不可变**。一致性任务里禁止改动角色的核心五官、年龄感、性别、身份、服装主特征（即 `seed_prompt` 与该 variant 的 `prompt` 主体）。
4. **优化提示词只动外围**。允许调整：镜头（远/中/近/特写）、构图、光影、动作、情绪、风格后缀、negative prompt。不允许重写角色描述。
5. **批量前先校验**。`gen-episode` 之前应当一次性扫完整张剧集 JSON，列出全部缺失依赖；不要边跑边发现缺角色。
6. **缺配置先建模板**。如果用户要生图但角色/场景文件不存在，**优先复制 `references/*/<模板>.json` 创建骨架并填入推断字段**，而不是直接报错失败。建好后用 `AskUserQuestion` 让用户补关键字段（seed_prompt 是必填）。
7. **能推断就别问**。项目名、角色名、集数能从当前 `references/` 内容唯一推断时直接用；无法唯一推断时再问。
8. **如实标注不存在的能力**。当用户要求的能力（如 ComfyUI、negative prompt 字段、多项目隔离）当前未实现时，必须明说"建议命令 / 待实现"，不要伪装成可执行。

---

## 🚀 快速开始

### 1. 配置 API

```bash
cp .env.example .env
# 编辑 .env 填入：
#   AIHUBMIX_API_KEY=sk-xxx
#   AIHUBMIX_BASE_URL=https://aihubmix.com/v1   （可选）
#   MODEL=gpt-image-2                            （可选）
```

### 2. 新建一个角色

```bash
cp references/characters/角色模板.json references/characters/陈默.json
# 编辑 references/characters/陈默.json，至少填写 name / seed_prompt / 至少 1 个 variant
```

### 3. 单张测试

```bash
node scripts/gen-image.mjs --char 陈默 --variant casual --composition "全身立绘"
node scripts/gen-image.mjs "自由提示词"
node scripts/gen-image.mjs --list-chars           # 列出所有角色及 variants
```

### 4. 批量生一集

```bash
cp references/scripts/剧集模板.json references/scripts/ep01.json
# 编辑 ep01.json，填 title 和 scenes[]（每个 frame 指定 template / characters / composition）
node scripts/gen-episode.mjs ep01
# 输出 → outputs/ep01/<frame_id>.jpg + outputs/ep01/manifest.json
```

### 5. 一致性检查

```bash
node scripts/character-checker.mjs 陈默
```

---

## 🎨 构图模板（references/templates/）

| 模板文件 | 用途 | 适用 frame |
|---|---|---|
| `full-body.md` | 全身立绘 | 单人，介绍/亮相 |
| `half-body.md` | 半身特写 | 单人，情绪/对话头像 |
| `three-view.md` | 三视图 | 角色设计稿 |
| `identity-board.md` | 角色身份展示板 | 设定集封面 |
| `conversation.md` | 双人对话（自动合并两角色 seed_prompt） | 双人同框 |
| `scene-board.md` | 场景氛围板（无人） | 空镜/转场 |
| `fight.md` | 战斗动作 | 动作镜头 |
| `comic-grid.md` | 漫画分格 | 多格叙事 |

---

## 💡 核心原则（角色一致性保证）

- **`seed_prompt` 全剧固定不变** → 角色面部/体型一致性完全靠它，绝对不要在出图时改它。
- **`variants[k].prompt` 只换穿搭/状态** → 场景变了还是同一张脸。
- **`GLOBAL_STYLE` 后缀全剧统一** → 写死在脚本里：`professional cinematic lighting, high detail, cel-shading animation style with clean linework, consistent warm-cool color grading, 16:9 cinematic composition`。
- **多人同框用 `conversation` 模板** → 通过 `characters: ["A(v1)", "B(v2)"]` 自动拼两个角色的 seed_prompt + variant_prompt。
- **在世艺术家名必须放 `forbidden`** → 用 `aliases` 里的风格替代词。
- **`negative prompt` 字段**：当前 `gen-image.mjs` / `gen-episode.mjs` 未消费负面词字段。若要负向控制，需扩展脚本或写进 `forbidden`/正向提示词的反向措辞。

最终拼接顺序（`scripts/gen-image.mjs` 实际行为）：
```
seed_prompt + variants[v].prompt + composition + emotion + art_style + GLOBAL_STYLE
```

---

## ⚙️ 脚本参数参考（已实现）

### `scripts/gen-image.mjs`

| 参数 | 说明 |
|---|---|
| `--char, -c <name>` | 角色名（按 `references/characters/<name>.json` 查找，也支持前缀/包含匹配） |
| `--variant, -v <key>` | 穿搭变体 key，未指定时取第一个 |
| `--composition <text>` | 构图描述（如 "全身立绘"、"close-up portrait"） |
| `--emotion <text>` | 情绪描述 |
| `--output, -o <dir>` | 输出目录，默认 `outputs/` |
| `--list-chars` | 列出所有角色及其 variants，不生图 |
| `<位置参数...>` | 不带 `--char` 时合并为自由提示词 |

### `scripts/gen-episode.mjs`

```
node scripts/gen-episode.mjs <episodeId>
```
读取 `references/scripts/<episodeId>.json`，逐帧串行生成（每帧间 2 秒延迟避限流）到
`outputs/<episodeId>/<frame_id>.jpg`，并写出 `manifest.json`（含每帧 prompt 与成败）。

### `scripts/character-checker.mjs`

```
node scripts/character-checker.mjs <角色名>
```
列出该角色在 `outputs/*/` 下的所有图，按文件大小中位数标记异常小文件。**不做语义对比**。

---

## 📦 剧集 JSON 格式（references/scripts/<ep>.json）

> 模板源：[references/scripts/剧集模板.json](references/scripts/剧集模板.json)。
> 角色 JSON 模板：[references/characters/角色模板.json](references/characters/角色模板.json)。
> 场景 JSON 模板：[references/scenes/场景模板.json](references/scenes/场景模板.json)（字段：`name` / `id` / `seed_prompt` / `color_grading` / `mood`）。

```jsonc
{
  "title": "第1章：标题",
  "scenes": [
    {
      "id": "s1_f1",
      "template": "scene-board",
      "prompt": "雨夜霓虹街道",
      "scene": "总裁办公室",       // 可选，引用 references/scenes/总裁办公室.json
      "size": "1536x1024"
    },
    {
      "id": "s1_f2",
      "template": "full-body",
      "characters": ["陈默(formal)"],  // "角色名(variant)" 格式
      "composition": "全身立绘",
      "emotion": "冷冽疏离",
      "size": "1024x1536"
    },
    {
      "id": "s1_f3",
      "template": "conversation",
      "characters": ["陈默(formal)", "孟婉(casual)"],
      "composition": "双人正反打",
      "emotion": "对峙",
      "size": "1536x1024"
    }
  ]
}
```
> `scenes[].frames[]` 也支持嵌套写法，脚本会自动拍平。

---

## 🧪 项目数据外置原则

当前脚本读写都锁死在 `SKILL_ROOT/references/` 和 `SKILL_ROOT/outputs/`。
**多项目隔离尚未实现**。如果同时跑多个项目，目前需要：

- 方案 A（推荐过渡）：每个项目 fork 一份本 skill 目录，独立 `references/` 与 `outputs/`。
- 方案 B：扩展脚本支持 `--project <id>`，把数据根改成 `projects/<id>/references/`、输出改成 `projects/<id>/outputs/`。见下面「建议命令」。

---

## 🧱 建议命令 / 待实现命令

下面这些**当前并不存在**，仅作为后续扩展建议，OpenClaw 不要直接调用：

```bash
# 待实现：脚手架式创建角色（当前替代方案是 cp 模板）
node scripts/create-character.mjs --project <projectId> --name <characterName>

# 待实现：多项目隔离的单图生成
node scripts/gen-image.mjs --project <projectId> --char <characterName> --variant default --composition "full body"

# 待实现：多项目隔离的批量生成
node scripts/gen-episode.mjs --project <projectId> --episode ep01

# 待实现：基于 CLIP/embedding 的语义一致性检查（当前 checker 只看文件大小）
node scripts/check-character-consistency.mjs --project <projectId> --char <characterName>

# 待实现：ComfyUI workflow runner（当前脚本走 aihubmix HTTP API，不是 ComfyUI）
node scripts/run-comfyui.mjs --workflow workflows/<name>.json --char <characterName>

# 待实现：负面提示词消费（当前 schema 已有 forbidden，但脚本未拼到请求里）
# 需要修改 gen-image.mjs / gen-episode.mjs 在 buildPrompt 后追加 negative_prompt 字段
```

调用前请确认脚本文件确实存在；不存在时，应当先创建脚本或退回到现有 `gen-image.mjs` / `gen-episode.mjs`。
