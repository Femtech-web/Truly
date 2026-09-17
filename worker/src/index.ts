import { getCatalog, getCreator } from './catalog'
import { HttpError, isOriginAllowed, json, problem, withCors } from './http'
import { approveChallenge, cancelChallenge, createChallenge, exchangeChallenge, getChallengeByCode } from './pairing'
import type { Env } from './types'
import { getDesktopSession } from './sessions'
import { createWalletChallenge, verifyWalletChallenge, listDevices, revokeDevice } from './device-management'
import { rateLimit } from './rate-limits'
import { createLearningTurn } from './learning/turn'
import { activateLearningSession, getDesktopLearningSession, listWalletLearningSessions } from './learning/sessions'
import { createTask, activateTask, listTasks } from './learning/tasks'
import { transcribeVoice } from './learning/speech'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!isOriginAllowed(request, env)) {
      return problem(403, 'origin_not_allowed', 'Truly cannot open from this address.')
    }

    if (request.method === 'OPTIONS') {
      return withCors(request, env, new Response(null, { status: 204 }))
    }

    try {
      await rateLimit(request, env)
      ctx.waitUntil(env.DB.prepare('DELETE FROM rate_limit_windows WHERE key IN (SELECT key FROM rate_limit_windows WHERE expires_at < ? LIMIT 100)')
        .bind(Date.now() - 60_000).run())
      const url = new URL(request.url)
      const segments = url.pathname.split('/').filter(Boolean)
      let response: Response

      if (request.method === 'GET' && url.pathname === '/health') {
        response = json({ status: 'ok' })
      } else if (request.method === 'GET' && url.pathname === '/v1/catalog') {
        response = await getCatalog(env)
      } else if (request.method === 'GET' && url.pathname === '/v1/desktop/session') {
        response = await getDesktopSession(request, env)
      } else if (request.method === 'GET' && url.pathname === '/v1/desktop/learning-session') {
        response = await getDesktopLearningSession(request, env)
      } else if (request.method === 'GET' && url.pathname === '/v1/learning/sessions') {
        response = await listWalletLearningSessions(request, env)
      } else if (request.method === 'POST' && url.pathname === '/v1/learning/sessions/activate') {
        response = await activateLearningSession(request, env)
      } else if (request.method === 'POST' && url.pathname === '/v1/learning/turn') {
        response = await createLearningTurn(request, env)
      } else if (request.method === 'POST' && url.pathname === '/v1/voice/transcriptions') {
        response = await transcribeVoice(request, env)
      } else if (request.method === 'GET' && url.pathname === '/v1/tasks') {
        response = await listTasks(request, env)
      } else if (request.method === 'POST' && url.pathname === '/v1/tasks') {
        response = await createTask(request, env)
      } else if (request.method === 'POST' && segments.length === 4 && segments[0] === 'v1' && segments[1] === 'tasks' && segments[2] && segments[3] === 'activate') {
        response = await activateTask(segments[2], request, env)
      } else if (request.method === 'POST' && url.pathname === '/v1/auth/challenges') {
        response = await createWalletChallenge(request, env)
      } else if (request.method === 'POST' && segments.length === 5 && segments[0] === 'v1' && segments[1] === 'auth' && segments[2] === 'challenges' && segments[3] && segments[4] === 'verify') {
        response = await verifyWalletChallenge(segments[3], request, env)
      } else if (request.method === 'GET' && url.pathname === '/v1/devices') {
        response = await listDevices(request, env)
      } else if (request.method === 'POST' && segments.length === 4 && segments[0] === 'v1' && segments[1] === 'devices' && segments[2] && segments[3] === 'revoke') {
        response = await revokeDevice(segments[2], request, env)
      } else if (request.method === 'GET' && segments.length === 3 && segments[0] === 'v1' && segments[1] === 'creators' && segments[2]) {
        response = await getCreator(segments[2], env)
      } else if (request.method === 'POST' && url.pathname === '/v1/pairing/challenges') {
        response = await createChallenge(request, env)
      } else if (request.method === 'GET' && segments.length === 4 && segments[0] === 'v1' && segments[1] === 'pairing' && segments[2] === 'code' && segments[3]) {
        response = await getChallengeByCode(segments[3], env)
      } else if (request.method === 'POST' && segments.length === 5 && segments[0] === 'v1' && segments[1] === 'pairing' && segments[2] === 'challenges' && segments[3] && segments[4] === 'approve') {
        response = await approveChallenge(segments[3], request, env)
      } else if (request.method === 'POST' && segments.length === 5 && segments[0] === 'v1' && segments[1] === 'pairing' && segments[2] === 'challenges' && segments[3] && segments[4] === 'exchange') {
        response = await exchangeChallenge(segments[3], request, env)
      } else if (request.method === 'POST' && segments.length === 5 && segments[0] === 'v1' && segments[1] === 'pairing' && segments[2] === 'challenges' && segments[3] && segments[4] === 'cancel') {
        response = await cancelChallenge(segments[3], request, env)
      } else {
        response = problem(404, 'not_found', 'Truly could not find that request.')
      }

      return withCors(request, env, response)
    } catch (error) {
      const response = error instanceof HttpError
        ? problem(error.status, error.code, error.message)
        : problem(500, 'internal_error', 'Truly could not finish that. Please try again.')
      if (response.status === 429) response.headers.set('retry-after', '60')
      return withCors(request, env, response)
    }
  },
} satisfies ExportedHandler<Env>
