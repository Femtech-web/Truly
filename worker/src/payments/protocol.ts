import type { Address } from 'viem'
export interface PaymentOrder {
  id: string; wallet_address: string; skill_id: string; skill_version: number
  asset: 'NIM' | 'USDT'; network: 'nimiq-testnet' | 'nimiq-mainnet' | 'polygon'; token_address: string | null
  sender: string; recipient: string; amount_atomic: string; decimals: number
  request_key: string; request_hash: string; binding_nonce: string; sender_verified_at: string | null
  transaction_hash: string | null; status: 'quoted' | 'submitted' | 'validated' | 'rejected'
  created_at: string; expires_at: string; validated_at: string | null
  path_title?: string
}
export function bindingData(order: PaymentOrder, origin: string) {
  return {
    domain: { name: 'Truly purchase', version: '1', chainId: 137, verifyingContract: order.token_address as Address },
    primaryType: 'Purchase' as const,
    types: { Purchase: [
      { name: 'app', type: 'string' }, { name: 'order', type: 'string' },
      { name: 'beneficiary', type: 'string' }, { name: 'path', type: 'string' },
      { name: 'amount', type: 'string' }, { name: 'recipient', type: 'address' },
      { name: 'nonce', type: 'string' }, { name: 'validUntil', type: 'string' },
    ] },
    message: { app: origin, order: order.id, beneficiary: order.wallet_address,
      path: `${order.skill_id}@${order.skill_version}`, amount: `${order.amount_atomic} atomic USDT`,
      recipient: order.recipient as Address, nonce: order.binding_nonce, validUntil: order.expires_at },
  }
}
export function publicOrder(order: PaymentOrder, origin: string) {
  return { id: order.id, pathId: order.skill_id, version: order.skill_version, asset: order.asset,
    pathTitle: order.path_title ?? null,
    network: order.network, tokenAddress: order.token_address, sender: order.sender,
    recipient: order.recipient, amountAtomic: order.amount_atomic, decimals: order.decimals,
    senderVerified: Boolean(order.sender_verified_at), transactionHash: order.transaction_hash,
    status: order.status, createdAt: order.created_at, expiresAt: order.expires_at,
    binding: order.asset === 'USDT' && !order.sender_verified_at ? bindingData(order, origin) : null }
}
