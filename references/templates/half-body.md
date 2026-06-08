# 半身特写模板

## 融合规则
1. 从角色 JSON 读取 `seed_prompt`
2. 从角色 variant 读取穿搭 `prompt`
3. 只取上半身描述部分
4. 叠加 `emotion` 和 `lighting`

## Prompt 结构

```
{seed_prompt}, {variant_prompt}(upper body only), head and shoulders portrait, {emotion}, {lighting}, {art_style}, {global_style}
```

## 常用 emotion 预置
- `eyes filled with unspoken sorrow` — 眼底未说出的悲伤
- `cold piercing gaze directly at viewer` — 冷冽直视
- `weak pale sickly expression` — 苍白病弱
- `radiant proud smile` — 得意灿烂笑容
- `tears at corner of eyes fragile` — 眼角含泪脆弱

## 常用 lighting 预置
- `soft key light from upper left` — 左上柔光
- `warm lamp side lighting` — 暖灯侧光
- `cold window ambient light` — 冷窗环境光
- `butterfly portrait lighting` — 蝴蝶光
