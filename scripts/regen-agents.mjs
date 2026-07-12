/**
 * Regenerate all 24 agent JSON files with correct encoding.
 * Extracts the English systemPrompt (intact) from each file and rewrites
 * with proper UTF-8, correct Chinese role + description.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const agentsDir = join(__dirname, '..', 'clawpacks', 'agents')

// ── Chinese role + description for each agent ────────────────────────────────
const AGENT_META = {
  alice:   { role: '产品经理',     desc: '专注于产品规划和需求分析，擅长用户故事、PRD 撰写、竞品分析与路线图制定。' },
  aria:    { role: '内容创作专家', desc: '擅长营销文案、博客写作、社交媒体内容与品牌故事创作，深谙内容传播策略。' },
  atlas:   { role: '数据分析师',   desc: '擅长数据解读、趋势识别、业务洞察与可视化方案，助力数据驱动决策。' },
  bob:     { role: '前端工程师',   desc: '精通 React、Vue、TypeScript 与现代 CSS，专注性能优化与 UI 实现。' },
  charlie: { role: '后端工程师',   desc: '专精 Node.js、Python、Go，擅长 API 设计、数据库优化与微服务架构。' },
  dev:     { role: '全栈工程师',   desc: '深度掌握 TypeScript、React、Node.js 与 Rust，覆盖前后端全链路开发。' },
  diana:   { role: 'UI 设计师',    desc: '专注界面设计、设计系统、色彩理论与视觉规范，打造一致的品牌视觉体验。' },
  eve:     { role: 'UX 设计师',    desc: '专注用户体验优化，擅长用户研究、交互设计与可用性测试及信息架构。' },
  frank:   { role: '商业分析师',   desc: '擅长数据解读、绩效分析与可视化方案，推动业务洞察与可量化改进策略。' },
  grace:   { role: '运营专家',     desc: '专注用户增长、留存、活动策划与数据运营，擅长社区管理与内容运营。' },
  henry:   { role: '营销策略师',   desc: '精通品牌定位、多渠道营销、付费投放与增长策略，驱动销售漏斗优化。' },
  iris:    { role: '内容策划',     desc: '擅长营销文案、社交媒体内容与品牌叙事，兼顾 SEO 与内容矩阵规划。' },
  jack:    { role: '项目经理',     desc: '熟练运用 Agile/Scrum，擅长风险管理、跨部门沟通与项目全生命周期管理。' },
  kai:     { role: '产品经理',     desc: '在产品战略、用户研究与执行落地方面经验丰富，擅长竞品分析与路线图制定。' },
  kate:    { role: '测试工程师',   desc: '专注自动化测试、测试策略设计与质量保障，擅长用例编写与 CI/CD 集成。' },
  leo:     { role: '软件架构师',   desc: '深度掌握分布式系统、微服务、云原生架构，擅长技术选型与可扩展方案设计。' },
  mary:    { role: '增长专家',     desc: '专注增长实验、漏斗优化、病毒传播机制与 PLG 策略，驱动产品驱动增长。' },
  nick:    { role: '客户成功专家', desc: '擅长问题解决、用户沟通与满意度提升，精通客户关怀与口碑运营策略。' },
  olivia:  { role: '财务顾问',     desc: '专注财务规划、预算管理、财务建模与成本分析，助力商业决策与投资评估。' },
  peter:   { role: '法律顾问',     desc: '专注合同审查、知识产权、隐私合规（GDPR、PIPL）与商业法律咨询。' },
  quinn:   { role: 'HR 专家',      desc: '擅长招聘、员工发展、绩效管理与员工沟通，致力打造积极向上的组织文化。' },
  rose:    { role: '品牌策略师',   desc: '专注品牌定位、视觉识别体系、品牌叙事与整合传播，打造有辨识度的品牌。' },
  sam:     { role: '视频制作专家', desc: '精通剪辑脚本、节奏把控、字幕设计与平台适配，专注短视频与商业内容制作。' },
  tina:    { role: '文案策略师',   desc: '营销文案撰写专家，擅长广告语、落地页文案、电商详情页与发布会演讲稿。' },
}

// ── Extract systemPrompt safely from raw UTF-8 bytes ────────────────────────
function extractField(bytes, fieldName) {
  const raw = Buffer.from(bytes).toString('utf8')
  // Match the field value (English fields are safe as UTF-8)
  const re = new RegExp(`"${fieldName}":\\s*"((?:[^"\\\\]|\\\\.)*)"`,'s')
  const m = raw.match(re)
  return m ? m[1] : ''
}

function extractNumberField(bytes, fieldName) {
  const raw = Buffer.from(bytes).toString('utf8')
  const re = new RegExp(`"${fieldName}":\\s*([0-9.]+)`)
  const m = raw.match(re)
  return m ? parseFloat(m[1]) : null
}

function extractArrayField(bytes, fieldName) {
  const raw = Buffer.from(bytes).toString('utf8')
  const re = new RegExp(`"${fieldName}":\\s*(\\[[^\\]]*\\])`)
  const m = raw.match(re)
  if (!m) return []
  try { return JSON.parse(m[1]) } catch { return [] }
}

// ── Process all files ────────────────────────────────────────────────────────
const files = readdirSync(agentsDir)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort()

let done = 0

for (const file of files) {
  const agentKey = file.replace('.json', '')
  const meta = AGENT_META[agentKey]
  if (!meta) {
    console.error(`No meta for ${file}, skipping`)
    continue
  }

  const filePath = join(agentsDir, file)
  const rawBytes = readFileSync(filePath)
  // Strip BOM
  const bytes = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF
    ? rawBytes.slice(3)
    : rawBytes

  // Extract safe fields
  const name          = extractField(bytes, 'name')
  const avatar        = extractField(bytes, 'avatar')
  const systemPrompt  = extractField(bytes, 'systemPrompt')
  const providerId    = extractField(bytes, 'providerId')
  const modelId       = extractField(bytes, 'modelId')
  const sandboxMode   = extractField(bytes, 'sandboxMode') || 'read-only'
  const temperature   = extractNumberField(bytes, 'temperature') ?? 0.7
  const maxTokens     = extractNumberField(bytes, 'maxTokens') ?? 4096
  const internalTools = extractArrayField(bytes, 'enabledInternalTools')
  const skillIds      = extractArrayField(bytes, 'enabledSkillIds')
  const mcpIds        = extractArrayField(bytes, 'enabledMcpServerIds')
  const workspacePath = extractField(bytes, 'workspacePath')

  const obj = {
    name,
    role: meta.role,
    avatar,
    description: meta.desc,
    systemPrompt,
    providerId,
    modelId,
    enabledInternalTools: internalTools,
    enabledSkillIds: skillIds,
    enabledMcpServerIds: mcpIds,
    sandboxMode,
    temperature,
    maxTokens,
    workspacePath,
  }

  const json = JSON.stringify(obj, null, 2)

  // Verify it parses cleanly
  try {
    JSON.parse(json)
  } catch (e) {
    console.error(`Generated JSON invalid for ${file}: ${e.message}`)
    continue
  }

  writeFileSync(filePath, json, 'utf8')
  console.log(`✓ ${file}  [${meta.role}]  avatar: ${avatar.slice(0,40)}`)
  done++
}

console.log(`\n${done}/${files.length} files regenerated.`)
