# 场景氛围板模板

## 融合规则
1. 从场景 JSON 读取 `seed_prompt`
2. 叠加场景 `color_grading` + `mood`
3. 叠加用户指定的额外细节
4. 拼接固定画风后缀

## Prompt 结构

```
{scene_seed_prompt}, {color_grading}, {mood_description}, cinematic scene atmosphere board, art book white-space layout, 16:9 film still composition, {global_style}
```

## 氛围板排版预置
- `main image left-side dominant, surrounding detail insets` — 主图居左环绕细节
- `center composition with vignette fade edges` — 居中构图暗角边缘
- `split layout upper scene lower detail closeups` — 上下分区全景+细节
