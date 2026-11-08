#!/usr/bin/env node
// Check the real npm tarball, including its entry points and README images.
// No lifecycle scripts run while packing; this script never publishes.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { gunzipSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'artifacts')
const args = process.argv.slice(2)
assert(args.every(arg => ['--strict', '--release'].includes(arg)), 'Usage: check-package.mjs [--strict|--release]')
assert(!['prepack', 'prepare', 'postpack'].includes(process.env.npm_lifecycle_event), 'Run the package check outside pack lifecycle hooks')

const source = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert(source.name && source.version, 'Package name and version are required')
assert(source.private !== true, 'The plugin must be publishable')
assert.equal(source.publishConfig?.access, 'public')
assert.equal(new URL(source.publishConfig.registry).origin, 'https://registry.npmjs.org')

mkdirSync(out, { recursive: true })
if (!existsSync(join(out, 'AGENTS.md'))) {
  writeFileSync(join(out, 'AGENTS.md'), '# 发布验证产物\n\n本目录保存 npm pack 生成的安装包与 SHA-256 校验和，由 git 忽略，不进入发行包。\n')
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const packed = spawnSync(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', out], {
  cwd: root,
  env: { ...process.env, npm_config_ignore_scripts: 'true' },
  encoding: 'utf8',
  timeout: 120_000,
})
assert.ifError(packed.error)
assert.equal(packed.status, 0, packed.stderr || 'npm pack failed')
const reports = JSON.parse(packed.stdout)
assert.equal(reports.length, 1, 'Expected one npm tarball')
const report = reports[0]
assert.equal(report.name, source.name)
assert.equal(report.version, source.version)
assert.equal(basename(report.filename), report.filename, 'Unexpected tarball path')
const tarball = join(out, report.filename)
const bytes = readFileSync(tarball)
assert.equal(report.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`)

// Read regular files from npm's own short-path tarball without extracting it.
const tar = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
const files = new Map()
const field = buffer => buffer.toString('utf8').replace(/\0.*$/s, '').trim()
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512)
  if (header.every(byte => byte === 0)) break
  const size = Number.parseInt(field(header.subarray(124, 136)) || '0', 8)
  assert(Number.isSafeInteger(size) && size >= 0, 'Invalid tar entry size')
  const body = tar.subarray(offset + 512, offset + 512 + size)
  assert.equal(body.length, size, 'Truncated tar entry')
  const type = header[156]
  if (type === 0 || type === 48) {
    const prefix = field(header.subarray(345, 500))
    const name = `${prefix ? `${prefix}/` : ''}${field(header.subarray(0, 100))}`
    assert(name.startsWith('package/'), `Unexpected tar entry: ${name}`)
    files.set(name.slice(8), body)
  } else {
    assert([53, 120, 103].includes(type), 'Unsupported npm tar entry type')
  }
  offset += 512 + Math.ceil(size / 512) * 512
}
const localPath = value => {
  assert.equal(typeof value, 'string', 'Expected a relative resource path')
  const name = value.replace(/^\.\//, '')
  assert(!name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..'), `Unsafe resource path: ${value}`)
  return posix.normalize(name)
}
const resource = name => {
  name = localPath(name)
  assert(files.has(name) && files.get(name).length > 0, `Missing or empty packed resource: ${name}`)
  return files.get(name)
}
const pkg = JSON.parse(resource('package.json'))
assert.equal(pkg.name, source.name)
assert.equal(pkg.version, source.version)
assert.equal(pkg.type, 'module')
assert.equal(pkg.dsh?.client?.platform, 'web')
assert.equal(pkg.exports?.['.'], `./${pkg.main.replace(/^\.\//, '')}`)
const host = resource(pkg.main)
const client = resource(pkg.exports['./client'])
resource(pkg.exports['./package.json'])
const patch = resource(pkg.dsh.bundle.patch).toString('utf8')
const escapedName = pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
assert(/^- insert:/m.test(patch), 'Bundle patch must insert the plugin')
assert(new RegExp(`^\\s+name:\\s*["']?${escapedName}["']?\\s*$`, 'm').test(patch), 'Bundle patch package name must match package.json')
resource('LICENSE')
resource('PUBLISHING.md')

const hostModule = await import(`data:text/javascript;base64,${host.toString('base64')}`)
assert.equal(typeof hostModule.apply, 'function', 'Packed host must export apply')
let registration
runInNewContext(client.toString('utf8'), {
  window: { __ModuleLoader__: { load(value) { registration = value } } },
}, { timeout: 1000, filename: 'packed-client.js' })
assert.equal(typeof registration?.factory, 'function', 'Packed client must register a module factory')

for (const readme of ['README.md', 'README.en.md']) {
  const text = resource(readme).toString('utf8')
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '')
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue
    resource(decodeURIComponent(target.split(/[?#]/)[0]))
  }
}
const screenshots = JSON.parse(resource('screenshots.json'))
assert(Array.isArray(screenshots) && screenshots.length >= 1 && screenshots.length <= 8)
for (const image of screenshots) resource(image)
for (const name of files.keys()) {
  assert(!/(^|\/)(?:node_modules|\.git|\.verification|artifacts)(?:\/|$)|(^|\/)\.npmrc$/.test(name), `Unexpected private or generated file in package: ${name}`)
}

const stableName = `${pkg.name.split('/').pop()}.tgz`
if (report.filename !== stableName) copyFileSync(tarball, join(out, stableName))
const hash = createHash('sha256').update(bytes).digest('hex')
writeFileSync(join(out, 'SHA256SUMS'), `${hash}  ${report.filename}\n${hash}  ${stableName}\n`)
console.log(`Package check passed: ${pkg.name}@${pkg.version}, ${files.size} files, ${bytes.length} bytes`)
console.log('Host/client entries, bundle patch, README links and screenshots resolve in the actual tarball.')
console.log(`Artifacts: artifacts/${report.filename}, artifacts/${stableName}, artifacts/SHA256SUMS`)
if (args.includes('--release')) {
  console.log('Ready for publication. Complete npm web login, then run:')
  console.log('npm publish --access public --registry=https://registry.npmjs.org')
}
