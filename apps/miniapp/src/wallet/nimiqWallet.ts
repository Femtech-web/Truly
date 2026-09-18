import { init, type NimiqProvider } from '@nimiq/mini-app-sdk'
import { isErrorResponse } from './errors'
import { sendNimiqPayment } from './nimiq-payment'
import type { WalletPort } from './types'

class NimiqWalletAdapter implements WalletPort {
  readonly kind = 'nimiq' as const

  constructor(private readonly provider: NimiqProvider) {}

  isConsensusEstablished() {
    return this.provider.isConsensusEstablished()
  }

  async listAccounts() {
    const result = await this.provider.listAccounts()

    if (isErrorResponse(result)) {
      throw result
    }

    return result
  }

  async sign(message: string) {
    const result = await this.provider.sign(message)

    if (isErrorResponse(result)) {
      throw result
    }

    return result
  }

  disconnect() {
    this.provider.disconnect()
  }

  async payNim(input: { recipient: string; value: number; reference: string }) {
    return sendNimiqPayment(this.provider, input)
  }
}

export async function createNimiqWallet(): Promise<WalletPort> {
  const provider = await init({ timeout: 10_000 })
  return new NimiqWalletAdapter(provider)
}
