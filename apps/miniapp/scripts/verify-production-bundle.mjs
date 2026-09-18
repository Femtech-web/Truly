import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const assets = new URL('../dist/assets/', import.meta.url)
const files = await readdir(assets)
const privateCoreUrl = /http:\/\/(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?/i

for (const file of files.filter(name => name.endsWith('.js'))) {
  const source = await readFile(join(assets.pathname, file), 'utf8')
  const leaked = source.match(privateCoreUrl)?.[0]
  if (leaked) {
    throw new Error(`Production bundle contains a private Core URL: ${leaked}`)
  }
}

console.log('Production bundle contains no localhost or private-LAN Core URL.')
