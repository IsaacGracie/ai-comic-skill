# 双人对话模板

## 融合规则
1. 读两个角色各自的 seed_prompt
2. 读两个角色各自的 variant_prompt
3. 读场景 JSON（可选）
4. 叠加构图和情绪

## Prompt 结构

```
{charA_seed_prompt}, {charA_variant_prompt}, {charB_seed_prompt}, {charB_variant_prompt}, two-shot composition, {composition_detail}, {scene_prompt}, {emotion_atmosphere}, {art_style}, {global_style}
```

## 常用构图预置
- `character A left profile looking away coldly, character B right facing character A with tension`
- `both seated across a table, character A drinking tea composed, character B leaning forward confrontational`
- `character A back turned near window, character B entering through door, silhouettes`
- `close two-shot, faces near each other, intimate confrontation`

## 情绪氛围预置
- `strained tension palpable between them`
- `cold distance heavy silence`
- `passionate argument heated gestures`
- `tender quiet moment shared understanding`
