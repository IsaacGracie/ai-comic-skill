# 三视图模板

## 融合规则
1. 从角色 JSON 读取 `seed_prompt`
2. 从角色 variant 读取穿搭 `prompt`
3. 强制三视图布局

## Prompt 结构

```
{seed_prompt}, {variant_prompt}, 3D anime character design sheet, three-view layout: front view full-body centered, side profile view right, back view rightmost, arranged horizontally on pure white background, technical reference sheet style, {art_style}, {global_style}
```

## 附加可选项
- `with closeup face portrait top-left corner` — 左上角加面部特写
- `with color palette swatches bottom` — 底部加色板
- `with costume detail callouts` — 加穿搭细节标注
