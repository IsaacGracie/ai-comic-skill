#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

// ======= Load .env (minimal parser, no dep) =======
const envFile = path.join(SKILL_ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}

const API_KEY = process.env.AIHUBMIX_API_KEY;
const BASE_URL = process.env.AIHUBMIX_BASE_URL || 'https://aihubmix.com/v1';
const MODEL = process.env.MODEL || 'gpt-image-2';

if (!API_KEY) {
  console.error('❌ 未配置 AIHUBMIX_API_KEY');
  console.error('   请复制 .env.example 为 .env 并填入 API Key');
  process.exit(1);
}

const GLOBAL_STYLE = `professional cinematic lighting, high detail, cel-shading animation style with clean linework, consistent warm-cool color grading, 16:9 cinematic composition`;

// ======= Load helpers =======
function loadCharacter(name) {
  const file = path.join(SKILL_ROOT, 'references', 'characters', `${name}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = path.join(SKILL_ROOT, 'references', 'characters');
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.startsWith(name) || f.includes(name));
  if (!match) throw new Error(`角色 "${name}" 未找到`);
  return JSON.parse(fs.readFileSync(path.join(dir, match), 'utf8'));
}

function loadScene(name) {
  const dir = path.join(SKILL_ROOT, 'references', 'scenes');
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.startsWith(name) || f.includes(name));
  if (match) return JSON.parse(fs.readFileSync(path.join(dir, match), 'utf8'));
  return null;
}

// ======= Build prompt for a single frame =======
function buildFramePrompt(frame) {
  let parts = [];

  // Characters
  if (frame.characters) {
    for (const c of frame.characters) {
      let [charName, variantName] = c.includes('(') ? c.replace(')', '').split('(') : [c, null];
      const char = loadCharacter(charName);
      parts.push(char.seed_prompt);
      const v = variantName || Object.keys(char.variants)[0];
      if (char.variants[v]) parts.push(char.variants[v].prompt);
      if (char.art_style && !parts.includes(char.art_style)) parts.push(char.art_style);
    }
  }

  // Scene
  if (frame.scene) {
    const scene = loadScene(frame.scene);
    if (scene) {
      parts.push(scene.seed_prompt);
      if (scene.color_grading) parts.push(scene.color_grading);
      if (scene.mood) parts.push(scene.mood);
    }
  }

  // User prompt append
  if (frame.prompt) parts.push(frame.prompt);

  // Composition & emotion
  if (frame.composition) parts.push(frame.composition);
  if (frame.emotion) parts.push(frame.emotion);

  // Global style
  parts.push(GLOBAL_STYLE);

  return parts.join(', ');
}

// ======= Generate single frame =======
async function generateFrame(frame, index, outputDir) {
  const prompt = buildFramePrompt(frame);
  const label = frame.id || `frame_${index}`;
  
  console.log(`\n🎬 [${label}]`);
  console.log(`   🎨 ${prompt.slice(0, 100)}...`);

  const r = await fetch(`${BASE_URL}/models/openai/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: { prompt } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`[${label}] ${d.error?.message || `HTTP ${r.status}`}`);

  let savedPath = null;
  if (d.output?.b64_json) {
    const buf = Buffer.from(d.output.b64_json[0].bytesBase64, 'base64');
    const filename = `${label.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_')}.jpg`;
    savedPath = path.join(outputDir, filename);
    fs.writeFileSync(savedPath, buf);
    console.log(`   ✅ ${filename}`);
  } else if (d.output?.url) {
    const resp = await fetch(d.output.url);
    const buf = Buffer.from(await resp.arrayBuffer());
    const filename = `${label.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_')}.jpg`;
    savedPath = path.join(outputDir, filename);
    fs.writeFileSync(savedPath, buf);
    console.log(`   ✅ ${filename} (url)`);
  }

  return { label, path: savedPath, prompt };
}

// ======= Main: batch generate episode =======
async function main() {
  const episodeId = process.argv[2];
  if (!episodeId) {
    console.error('用法: node scripts/gen-episode.mjs <剧集id>');
    console.error('示例: node scripts/gen-episode.mjs ep01');
    process.exit(1);
  }

  const scriptFile = path.join(SKILL_ROOT, 'references', 'scripts', `${episodeId}.json`);
  if (!fs.existsSync(scriptFile)) {
    console.error(`剧集文件不存在: ${scriptFile}`);
    console.error('请先在 references/scripts/ 创建剧集 JSON 文件');
    process.exit(1);
  }

  const episode = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
  const outputDir = path.join(SKILL_ROOT, 'outputs', episodeId);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n🎬 剧集: ${episode.title || episodeId}`);
  console.log(`   输出: ${outputDir}`);
  console.log(`   场景数: ${episode.scenes?.length || 0}`);
  console.log(`   模型: ${MODEL}`);

  if (!episode.scenes || episode.scenes.length === 0) {
    console.error('剧集无场景数据');
    process.exit(1);
  }

  const results = [];
  let totalFrames = 0;

  // Flatten: scenes can contain multiple frames
  let frames = [];
  for (const scene of episode.scenes) {
    if (scene.frames) {
      frames.push(...scene.frames.map((f, i) => ({ ...f, id: f.id || `${scene.id}_${i + 1}` })));
    } else {
      frames.push({ ...scene, id: scene.id || `frame_${frames.length + 1}` });
    }
  }

  totalFrames = frames.length;
  console.log(`   总帧数: ${totalFrames}`);

  // Sequential generation (avoid rate limits)
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    console.log(`\n📸 [${i + 1}/${totalFrames}]`);
    
    try {
      const result = await generateFrame(frame, i, outputDir);
      results.push({ ...result, success: true });
    } catch (err) {
      console.error(`   ❌ 失败: ${err.message}`);
      results.push({ label: frame.id, success: false, error: err.message });
    }

    // Delay between frames to avoid rate limiting
    if (i < frames.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Summary
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\n\n📊 完成: ${succeeded}/${totalFrames} 成功, ${failed} 失败`);
  if (failed > 0) {
    console.log('失败列表:');
    results.filter(r => !r.success).forEach(r => console.log(`   ❌ ${r.label}: ${r.error}`));
  }

  // Save manifest
  const manifest = {
    episode: episodeId,
    title: episode.title,
    generated: new Date().toISOString(),
    model: MODEL,
    results,
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n📋 Manifest 已保存: ${outputDir}/manifest.json`);
}

main().catch(err => {
  console.error('❌ 致命错误:', err.message);
  process.exit(1);
});
