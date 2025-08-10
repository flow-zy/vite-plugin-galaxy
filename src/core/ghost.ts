import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
export interface GhostResult {
  packageJson: Record<string, string>
  ghosts: string[]
}

export async function detectGhostPkgs(
  ctx: PluginContext,
  importedIds: string[]
): Promise<GhostResult> {
  const root = ctx.config.root
  const pkgPath = resolve(root, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ])

  const ghosts = importedIds.filter(id => {
    const m = id.match(/^([^@\/]+|@[^\/]+\/[^\/]+)(\/|$)/)
    return m && !declared.has(m[1])
  })

  return { packageJson: pkg, ghosts }
}