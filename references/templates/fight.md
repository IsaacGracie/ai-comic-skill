# 战斗动作模板

## 融合规则
1. 从角色 JSON 读取 `seed_prompt`
2. 从角色 battle variant 读取穿搭
3. 叠加动态动作描述
4. 叠加特效描述

## Prompt 结构

```
{seed_prompt}, {battle_variant_prompt}, {action_description}, {effect_description}, dynamic action pose, motion blur on edges, martial arts combat scene, {art_style}, {global_style}
```

## 常用 action 预置
- `mid-air spinning sword slash` — 空中旋身挥剑
- `defensive stance sword raised blocking` — 防御架势举剑格挡
- `fast running with trailing silk ribbons` — 疾跑青纱飘带
- `crouching ambush position hidden shadows` — 蹲伏暗处潜伏

## 常用 effect 预置
- `cyan energy trail following sword tip` — 青色能量轨迹
- `scattering flower petals in impact shockwave` — 冲击波散落花瓣
- `dust cloud explosion background` — 尘土爆炸背景
- `rain drops frozen mid-air around fight` — 雨滴悬停空中
