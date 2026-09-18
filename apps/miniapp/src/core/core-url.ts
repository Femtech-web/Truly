interface CoreUrlInput {
  production: boolean
  configuredUrl?: string
  origin: string
}

export function resolveCoreUrl({ production, configuredUrl, origin }: CoreUrlInput): string {
  // Production is intentionally same-origin: the Worker serves both the Mini App
  // and `/v1`. Never let a developer's LAN `.env` leak into a release bundle.
  if (production) return origin
  return configuredUrl?.trim() ?? ''
}
