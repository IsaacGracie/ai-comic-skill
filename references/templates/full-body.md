# 全身立绘模板

## 融合规则
1. 从角色 JSON 读取 `seed_prompt`
2. 从角色 variant 读取穿搭 `prompt`
3. 叠加用户指定的 `composition` + `emotion`
4. 拼接角色 `art_style` + 固定画风后缀

## Prompt 结构

```
{seed_prompt}, {variant_prompt}, {composition}, {emotion}, {art_style}, {global_style}
```

## 固定画风后缀 (global_style)

```
professional cinematic lighting, high detail, cel-shading animation style with clean linework, consistent warm-cool color grading, 16:9 cinematic composition
```

## 常用 composition 预置
- `full-body standing centered` — 全身居中
- `full-body profile left` — 全身侧身左
- `full-body profile right` — 全身侧身右  
- `kneeling crouching pose` — 跪姿/蹲姿

## 常用 emotion 预置
- `cold detached stare` — 冷冽疏离
- `hidden pain in eyes` — 眼底隐痛
- `deliberately indifferent` — 刻意淡漠
- `emotionally broken` — 情绪崩溃
- `gentle soft smile` — 温柔浅笑
- `proud showing off gaze` — 得意炫耀
