// Fix malformed JSON in clawpacks/agents/*.json
// Problem: description field missing closing quote before the comma
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const agentsDir = join(__dirname, '..', 'clawpacks', 'agents')

const files = readdirSync(agentsDir)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .sort()

let fixed = 0, ok = 0, errors = 0

for (const file of files) {
  const filePath = join(agentsDir, file)
  const bytes = readFileSync(filePath)
  
  // Strip UTF-8 BOM if present
  const raw = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
    ? bytes.slice(3).toString('utf8')
    : bytes.toString('utf8')

  try {
    JSON.parse(raw)
    ok++
    continue // already valid
  } catch {
    // need to fix
  }

  // Strategy: use JSON5-style lenient parsing by scanning the raw string
  // Find each "key": "value" pair where value is not closed properly
  // Replace the broken end: find `description` field and add missing `"`
  
  // The pattern: a string field whose value doesn't end with `"` before `,`
  // We'll use a byte-level scan: find the description key, scan to where
  // the comma appears without a preceding `"`
  
  // Simple approach: for each line, if line starts with `"description":` 
  // and doesn't end with `",` (after trimming), append `"`
  const lines = raw.split('\n')
  let changed = false
  const newLines = lines.map(line => {
    const trimmed = line.trimEnd()
    // Description line missing closing quote: ends with something other than `",` or `"`
    if (trimmed.includes('"description":')) {
      // Check if this line has a value that's not properly closed
      const match = trimmed.match(/^(\s*"description":\s*")(.+)$/)
      if (match) {
        const value = match[2]
        if (!value.endsWith('",') && !value.endsWith('"')) {
          // Find where the value should end - add `"` before any trailing `,`
          const trailingComma = value.endsWith(',') ? ',' : ''
          const valueContent = trailingComma ? value.slice(0, -1) : value
          // Check if there's already a closing quote
          if (!valueContent.endsWith('"')) {
            const fixedLine = `${match[1]}${valueContent}",`
            changed = true
            console.log(`  Fixing ${file}: ...${valueContent.slice(-20)}" -> added closing quote`)
            return line.replace(trimmed, fixedLine)
          }
        }
      }
    }
    return line
  })
  
  if (changed) {
    const result = newLines.join('\n')
    try {
      JSON.parse(result)
      // Write back WITHOUT BOM, UTF-8
      writeFileSync(filePath, result, 'utf8')
      console.log(`✓ Fixed: ${file}`)
      fixed++
    } catch (e) {
      console.error(`✗ Still broken after fix: ${file} - ${e.message}`)
      errors++
    }
  } else {
    console.error(`✗ Could not find fixable pattern: ${file}`)
    errors++
  }
}

console.log(`\nDone: ${ok} already OK, ${fixed} fixed, ${errors} errors`)
