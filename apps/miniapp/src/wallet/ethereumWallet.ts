import { encodeFunctionData, erc20Abi, type Address } from 'viem'

interface EthereumProvider { request(input: { method: string; params?: unknown[] }): Promise<unknown> }
function provider(): EthereumProvider {
  const injected = (window as Window & { ethereum?: EthereumProvider }).ethereum
  if (!injected) throw new Error('Open Truly inside Nimiq Pay to use USDT.')
  return injected
}
export async function choosePolygonAccount(): Promise<Address> {
  const accounts = await provider().request({ method: 'eth_requestAccounts' })
  const account = Array.isArray(accounts) ? accounts[0] : null
  if (typeof account !== 'string' || !/^0x[0-9a-f]{40}$/i.test(account)) throw new Error('Choose a USDT wallet in Nimiq Pay.')
  return account as Address
}
export async function currentPolygonAccount(): Promise<Address | null> {
  const accounts = await provider().request({ method: 'eth_accounts' })
  const account = Array.isArray(accounts) ? accounts[0] : null
  return typeof account === 'string' && /^0x[0-9a-f]{40}$/i.test(account) ? account as Address : null
}
export async function approvePurchaseBinding(account: Address, binding: Record<string, unknown>): Promise<`0x${string}`> {
  const signature = await provider().request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(binding)] })
  if (typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) throw new Error('The USDT wallet approval was not completed.')
  return signature as `0x${string}`
}
export async function usePolygon(): Promise<void> {
  await provider().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] })
  const chain = await provider().request({ method: 'eth_chainId' })
  if (chain !== '0x89') throw new Error('Switch to Polygon before paying with USDT.')
}
export async function payUsdt(input: { account: Address; token: Address; recipient: Address; amount: bigint }): Promise<`0x${string}`> {
  const current = await currentPolygonAccount()
  if (current?.toLowerCase() !== input.account.toLowerCase()) throw new Error('The selected USDT wallet changed. Review the purchase again.')
  const hash = await provider().request({ method: 'eth_sendTransaction', params: [{ from: input.account, to: input.token,
    value: '0x0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [input.recipient, input.amount] }) }] })
  if (typeof hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Nimiq Pay did not return a transaction reference.')
  return hash as `0x${string}`
}
