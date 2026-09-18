export function handoffActionCopy(input: { busy: boolean; deliveredDeviceName: string | null }): string {
  if (input.busy) return 'Getting the Mac ready…'
  if (input.deliveredDeviceName) return `Loaded in Truly on ${input.deliveredDeviceName}`
  return 'Continue on my Mac'
}
