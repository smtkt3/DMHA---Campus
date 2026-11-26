import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STAGE = path.join(ROOT, '.cf-build')

function copyDirClean(src, dest, excludeDirs = new Set()) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludeDirs.has(entry.name)) continue
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirClean(s, d, excludeDirs)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

console.log('=== Preparing isolated Cloudflare Workers build in .cf-build ===')
fs.mkdirSync(STAGE, { recursive: true })

// Clean source & build artifacts inside stage while preserving cached node_modules
for (const dir of ['src', 'public', 'cloudflare', '.figma', '.next', '.open-next']) {
  fs.rmSync(path.join(STAGE, dir), { recursive: true, force: true })
}

copyDirClean(path.join(ROOT, 'src'), path.join(STAGE, 'src'), new Set(['(payload)', 'collections']))
copyDirClean(path.join(ROOT, 'public'), path.join(STAGE, 'public'), new Set(['uploads']))
copyDirClean(path.join(ROOT, 'cloudflare'), path.join(STAGE, 'cloudflare'))
copyDirClean(path.join(ROOT, '.figma'), path.join(STAGE, '.figma'), new Set(['runtime', 'design-context']))

// Strip Payload-only files inside stage
for (const rel of ['src/payload.config.ts', 'src/payload-types.ts', 'src/lib/payload.ts']) {
  fs.rmSync(path.join(STAGE, rel), { force: true })
}

// Swap in Cloudflare Durable Object SQLite driver (zero node:sqlite import!)
fs.copyFileSync(
  path.join(STAGE, 'src', 'lib', 'dmhs-sqlite-driver.cloudflare.ts'),
  path.join(STAGE, 'src', 'lib', 'dmhs-sqlite-driver.ts'),
)

// Copy configs
fs.copyFileSync(path.join(ROOT, 'package.cloudflare.json'), path.join(STAGE, 'package.json'))
fs.copyFileSync(path.join(ROOT, 'next.config.docker.mjs'), path.join(STAGE, 'next.config.mjs'))
fs.copyFileSync(path.join(ROOT, 'open-next.config.ts'), path.join(STAGE, 'open-next.config.ts'))
fs.copyFileSync(path.join(ROOT, 'wrangler.jsonc'), path.join(STAGE, 'wrangler.jsonc'))
fs.copyFileSync(path.join(ROOT, 'tsconfig.json'), path.join(STAGE, 'tsconfig.json'))
fs.copyFileSync(path.join(ROOT, 'postcss.config.mjs'), path.join(STAGE, 'postcss.config.mjs'))

const pkgHashFile = path.join(STAGE, '.pkg-hash')
const pkgText = fs.readFileSync(path.join(STAGE, 'package.json'), 'utf8')
const needsInstall =
  !fs.existsSync(path.join(STAGE, 'node_modules', '@opennextjs', 'cloudflare')) ||
  !fs.existsSync(pkgHashFile) ||
  fs.readFileSync(pkgHashFile, 'utf8') !== pkgText

if (needsInstall) {
  console.log('=== Installing Cloudflare OpenNext + Wrangler dependencies ===')
  execSync('npm install --no-audit --no-fund', { cwd: STAGE, stdio: 'inherit' })
  fs.writeFileSync(pkgHashFile, pkgText, 'utf8')
}

console.log('=== Running @opennextjs/cloudflare build ===')
execSync('npx --no-install opennextjs-cloudflare build', {
  cwd: STAGE,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: '--no-deprecation --max-old-space-size=3072',
  },
})

if (!process.env.WORKERS_CI && !process.env.CI) {
  console.log('=== Verifying Wrangler bundle size (dry-run) ===')
  execSync('npx --no-install wrangler deploy --dry-run --outdir .wrangler-dryrun', {
    cwd: STAGE,
    stdio: 'inherit',
  })
}
console.log('=== CLOUDFLARE BUILD READY IN .cf-build ===')
