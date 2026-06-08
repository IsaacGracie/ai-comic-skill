#!/usr/bin/env node
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

const GLOBAL_STYLE = `professional cinematic lighting, high detail, cel-shading animation style with clean linework, consistent warm-cool color grading, 16:9 cinematic composition`;

// ======= Load character config =======
function loadCharacter(name) {
  const file = path.join(SKILL_ROOT, 'references', 'characters', `${name}.json`);
  if (!fs.existsSync(file)) {
    const dir = path.join(SKILL_ROOT, 'references', 'characters');
    const files = fs.readdirSync(dir);
    const match = files.find(f => f.startsWith(name) || f.includes(name));
    if (!match) throw new Error(`角色 "${name}" 未找到。可用: ${files.map(f => f.replace('.json', '')).join(', ')}`);
    return JSON.parse(fs.readFileSync(path.join(dir, match), 'utf8'));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ======= Load scene config =======
function loadScene(name) {
  const dir = path.join(SKILL_ROOT, 'references', 'scenes');
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.startsWith(name) || f.includes(name));
  if (!match) return null;
  return JSON.parse(fs.readFileSync(path.join(dir, match), 'utf8'));
}

// ======= Build prompt from character =======
function buildPrompt(options) {
  let parts = [];

  if (options.char) {
    const char = loadCharacter(options.char);
    parts.push(char.seed_prompt);

    const variant = options.variant || Object.keys(char.variants)[0];
    if (char.variants[variant]) {
      parts.push(char.variants[variant].prompt);
    }

    if (options.composition) parts.push(options.composition);
    if (options.emotion) parts.push(options.emotion);
    if (char.art_style) parts.push(char.art_style);
    parts.push(GLOBAL_STYLE);

    return { prompt: parts.join(', '), char, variant };
  }

  return { prompt: options.raw, char: null, variant: null };
}

// ======= Generate image via zimage endpoint =======
async function generate(options) {
  const { prompt, outputDir } = options;

  console.log(`🎨 生成中: "${prompt.slice(0, 80)}${prompt.length > 80 ? '\u2026' : ''}"`);

  fs.mkdirSync(outputDir, { recursive: true });

  const r = await fetch(`${BASE_URL}/models/openai/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input: { prompt } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);

  if (d.output?.b64_json) {
    const buf = Buffer.from(d.output.b64_json[0].bytesBase64, 'base64');
    const filepath = path.join(outputDir, `gen_${Date.now()}_0.jpg`);
    fs.writeFileSync(filepath, buf);
    console.log(`   ✅ 已保存: ${filepath}`);
    return [filepath];
  } else if (d.output?.url) {
    const resp = await fetch(d.output.url);
    const buf = Buffer.from(await resp.arrayBuffer());
    const filepath = path.join(outputDir, `gen_${Date.now()}_0.jpg`);
    fs.writeFileSync(filepath, buf);
    console.log(`   ✅ 已保存 (url): ${filepath}`);
    return [filepath];
  }
  throw new Error('生图返回无数据');
}

// ======= CLI =======
async function main() {
  const args = process.argv.slice(2);
  let options = { outputDir: path.join(SKILL_ROOT, 'outputs') };
  let rawPromptParts = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--char' || a === '-c') options.char = args[++i];
    else if (a === '--variant' || a === '-v') options.variant = args[++i];
    else if (a === '--composition') options.composition = args[++i];
    else if (a === '--emotion') options.emotion = args[++i];
    else if (a === '--output' || a === '-o') options.outputDir = args[++i];
    else rawPromptParts.push(a);
  }

  if (rawPromptParts.length > 0) options.raw = rawPromptParts.join(' ');

  const { prompt } = buildPrompt(options);

  if (!prompt) {
    console.error('用法:');
    console.error('  node scripts/gen-image.mjs --char 陈默 --variant formal --composition "全身立绘" --emotion "冷冽疏离"');
    console.error('  node scripts/gen-image.mjs "自由提示词"');
    console.error('  node scripts/gen-image.mjs --list-chars');
    process.exit(1);
  }

  await generate({ ...options, prompt });
}

if (process.argv.includes('--list-chars')) {
  const dir = path.join(SKILL_ROOT, 'references', 'characters');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const char = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log(`\n👤 ${char.name} (${char.id})`);
    for (const [k, v] of Object.entries(char.variants)) {
      console.log(`   --variant ${k}  → ${v.label}`);
    }
    console.log(`   画风: ${char.art_style}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
