import { pathToFileURL } from 'node:url'
import { resolve as pathResolve, extname } from 'node:path'
import { existsSync } from 'node:fs'

const projectRoot = pathResolve(import.meta.dirname, '..')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = pathResolve(projectRoot, 'src', specifier.slice(2))
    if (!extname(target)) {
      const candidates = ['.ts', '.tsx', '.vue', '.js', '.mjs']
      const found = candidates.find((ext) => existsSync(target + ext))
      if (found) target = target + found
    }
    return nextResolve(pathToFileURL(target).href, context)
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.vue')) {
    return { format: 'module', source: 'export default {};', shortCircuit: true }
  }
  return nextLoad(url, context)
}
