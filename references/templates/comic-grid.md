# 漫画分格模板

用于漫剧实际页面——多格叙事布局。

## Prompt 结构

漫画分格页面布局，{grid_layout}，{frame1_description}，{frame2_description}，{frame3_description}，日式漫画风格，黑白灰为主调辅以淡彩，清晰线稿，对话气泡留白位置

## 常用 grid_layout 预置
- `3-vertical panels scrolling down` — 3格竖排
- `4-panel grid 2x2` — 4格田字
- `main large panel top-right, 2 smaller side panels` — 一大两小
- `full-bleed splash page` — 全出血跨页

## 注意事项
- 不要放实际文字（AI 生成的文字会乱码）
- 用留白区域标记对话气泡位置
- 人物保持角色配置的 seed_prompt
