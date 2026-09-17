export interface Env {
  DB: D1Database
  ALLOWED_ORIGINS: string
  PAIRING_ORIGIN: string
  AI_PROVIDER?: string
  GROQ_MODEL?: string
  GROQ_TRANSCRIPTION_MODEL?: string
  GROQ_API_KEY?: string
  GROQ_DATA_CONTROLS_CONFIRMED?: string
  AI_DAILY_LIMIT?: string
}

export interface PairingChallengeRow {
  id: string
  device_install_id: string
  device_name: string
  platform: string
  code_hash: string
  nonce: string
  exchange_secret_hash: string
  miniapp_origin: string
  message: string
  expires_at: string
  status: 'pending' | 'approved' | 'exchanged' | 'expired' | 'cancelled'
  approved_wallet: string | null
  device_id: string | null
  public_key: string | null
  completed_at: string | null
  exchanged_at: string | null
  created_at: string
}

export interface JsonError {
  error: {
    code: string
    message: string
  }
}
