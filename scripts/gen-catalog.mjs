import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dir = join(root, 'clawpacks', 'agents')

const files = readdirSync(dir)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort()

const agents = files.map(f => {
  const raw = readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '')
  const d = JSON.parse(raw)
  return { ...d, file: f }
})

console.log(`Found ${agents.length} agents`)

const lines = [
  `// AUTO-GENERATED — do not edit manually. Run: node scripts/gen-catalog.mjs`,
  ``,
  `export interface ClawpackAgent {`,
  `  file: string;`,
  `  name: string;`,
  `  role: string;`,
  `  avatar: string;`,
  `  description: string;`,
  `  systemPrompt?: string;`,
  `  providerId?: string;`,
  `  modelId?: string;`,
  `  temperature?: number;`,
  `  maxTokens?: number;`,
  `  sandboxMode?: string;`,
  `  enabledInternalTools?: string[];`,
  `  enabledSkillIds?: string[];`,
  `  enabledMcpServerIds?: string[];`,
  `  workspacePath?: string;`,
  `}`,
  ``,
  `export const CLAWPACK_CATALOG: ClawpackAgent[] = ${JSON.stringify(agents, null, 2)};`,
  ``,
]

const out = join(root, 'src', 'data', 'clawpacks-catalog.ts')
writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`Written to ${out}`)
