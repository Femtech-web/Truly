export type WalletKind = 'nimiq'

export interface WalletPort {
  kind: WalletKind
  isConsensusEstablished(): Promise<boolean>
  listAccounts(): Promise<string[]>
  sign(message: string): Promise<{ publicKey: string; signature: string }>
  payNim(input: { recipient: string; value: number; reference: string }): Promise<string>
  disconnect(): void
}

export type WalletStatus =
  | 'initializing'
  | 'ready'
  | 'unavailable'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'failed'

export interface WalletState {
  status: WalletStatus
  kind: WalletKind | null
  account: string | null
  consensus: boolean | null
  message: string | null
}
