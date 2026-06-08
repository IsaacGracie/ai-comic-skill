#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

// ======= Load character config =======
function loadCharacter(name) {
  const dir = path.join(SKILL_ROOT, 'references', 'characters');
  const files = fs.readdirSync(dir);
  const match = files.find(f => f.startsWith(name) || f.includes(name));
  if (!match) throw new Error(`角色 "${name}" 未找到。可用: ${files.map(f => f.replace('.json', '')).join(', ')}`);
  return JSON.parse(fs.readFileSync(path.join(dir, match), 'utf8'));
}

// ======= Find all generated images for a character =======
function findCharacterImages(charName) {
  const outputDir = path.join(SKILL_ROOT, 'outputs');
  if (!fs.existsSync(outputDir)) return [];
  
  // Look in all subdirectories
  const images = [];
  const dirs = fs.readdirSync(outputDir, { withFileTypes: true });
  for (const d of dirs) {
    if (d.isDirectory()) {
      const subDir = path.join(outputDir, d.name);
      const files = fs.readdirSync(subDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
      files.forEach(f => images.push({ episode: d.name, path: path.join(subDir, f), file: f }));
    }
  }
  return images;
}

// ======= Simple keyword-based consistency check =======
function checkPromptKeywords(images, keywordList) {
  // Extract keywords that should appear in each image
  const issues = [];
  
  // For this check we rely on the fact that filenames/paths may contain context
  // A real implementation would use CLIP/embedding similarity
  
  // We do what we can without AI: report on image count per variant, file sizes, timestamps
  for (const img of images) {
    try {
      const stat = fs.statSync(img.path);
      img.size = stat.size;
      img.mtime = stat.mtime;
    } catch {}
  }

  // Check for anomalies:
  // 1. File size outliers (too small = likely bad generation)
  if (images.length >= 2) {
    const sizes = images.map(i => i.size).filter(Boolean).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)];
    const threshold = median * 0.3; // 30% of median = too small
    
    images.forEach(img => {
      if (img.size && img.size < threshold) {
        issues.push({
          image: img.file,
          issue: '文件过小',
          detail: `${(img.size / 1024).toFixed(1)} KB（中位数 ${(median / 1024).toFixed(1)} KB）`,
          severity: 'warning',
        });
      }
    });
  }

  // 2. Timestamp clustering - all images same batch? good
  if (images.length >= 3) {
    const times = images.map(i => i.mtime?.getTime()).filter(Boolean);
    const spanMs = Math.max(...times) - Math.min(...times);
    if (spanMs < 60000) {
      // All images generated within 1 minute - likely one batch, fine
    }
  }

  return issues;
}

// ======= Main =======
async function main() {
  const charName = process.argv[2];
  if (!charName) {
    console.error('用法: node scripts/character-checker.mjs <角色名>');
    console.error('示例: node scripts/character-checker.mjs 陈默');
    process.exit(1);
  }

  try {
    const char = loadCharacter(charName);
    
    console.log(`\n🔍 角色一致性检查: ${char.name} (${char.id})`);
    console.log(`  基础描述: ${char.seed_prompt.slice(0, 80)}...`);
    console.log(`  穿搭数: ${Object.keys(char.variants).length}`);
    console.log(`  画风: ${char.art_style}`);

    const images = findCharacterImages(charName);
    
    if (images.length === 0) {
      console.log(`\n⚠️ 输出目录下暂无 ${charName} 生图记录`);
      console.log(`  先用 gen-episode.mjs 生成一集后再检查`);
      process.exit(0);
    }

    console.log(`\n📸 已生成图片: ${images.length} 张`);
    images.forEach((img, i) => {
      const sizeKb = img.size ? `${(img.size / 1024).toFixed(1)} KB` : '? KB';
      const date = img.mtime ? img.mtime.toISOString().split('T')[0] : '?';
      console.log(`   ${i + 1}. [${img.episode}] ${img.file}  ${sizeKb}  ${date}`);
    });

    // Extract variant keywords for comparison
    const variantKeywords = Object.fromEntries(
      Object.entries(char.variants).map(([k, v]) => [k, v.prompt.split(',').map(p => p.trim().slice(0, 40))])
    );
    
    console.log(`\n📋 穿搭变体关键词:`);
    for (const [k, v] of Object.entries(variantKeywords)) {
      console.log(`   [${char.variants[k].label}]: ${v.slice(0, 4).join(' | ')}`);
    }

    // Run checks
    const issues = checkPromptKeywords(images, variantKeywords);

    if (issues.length === 0) {
      console.log(`\n✅ 未发现明显异常（文件大小正常）`);
    } else {
      console.log(`\n⚠️ 发现 ${issues.length} 个潜在问题:`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. [${issue.severity}] ${issue.image}: ${issue.issue} - ${issue.detail}`);
      });
    }

    // Recommendations
    console.log(`\n💡 一致性建议:`);
    console.log(`   1. seed_prompt 固定不变 → 所有图片共享同一面部/体型描述`);
    console.log(`   2. 每个 variant 独立穿搭 prompt → 切换时只换穿搭不换脸`);
    console.log(`   3. GLOBAL_STYLE 后缀固定 → 画风/光影/构图统一`);
    console.log(`   4. 如需精确对比 → 推荐接入 CLIP embedding 进行图间余弦相似度计算`);
    console.log(`   5. 多人场景用 conversation 模板 → 避免手动拼角色信息不一致`);

  } catch (e) {
    console.error(`❌ 错误: ${e.message}`);
    process.exit(1);
  }
}

main();
