import 'server-only'

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

// ============================================================
// EWUKAI
// CHIFFREMENT DES IDENTIFIANTS DE PRESTATAIRES DE PAIEMENT
// ============================================================

const ALGORITHM =
  'aes-256-gcm'

const VERSION =
  'v1'

const IV_LENGTH =
  12

const AUTH_TAG_LENGTH =
  16

// ============================================================
// CHIFFRER
// ============================================================

export function encryptPaymentCredential(
  value: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    throw new Error(
      'Payment credential cannot be empty.'
    )
  }

  const key =
    getEncryptionKey()

  const iv =
    randomBytes(
      IV_LENGTH
    )

  const cipher =
    createCipheriv(
      ALGORITHM,
      key,
      iv
    )

  const encrypted =
    Buffer.concat([
      cipher.update(
        normalized,
        'utf8'
      ),

      cipher.final(),
    ])

  const authTag =
    cipher.getAuthTag()

  return [
    VERSION,

    iv.toString(
      'base64url'
    ),

    authTag.toString(
      'base64url'
    ),

    encrypted.toString(
      'base64url'
    ),
  ].join('.')
}

// ============================================================
// DECHIFFRER
// ============================================================

export function decryptPaymentCredential(
  encryptedValue: string
) {
  const parts =
    encryptedValue
      .trim()
      .split('.')

  if (
    parts.length !==
    4
  ) {
    throw new Error(
      'Invalid encrypted payment credential.'
    )
  }

  const [
    version,
    ivEncoded,
    authTagEncoded,
    encryptedEncoded,
  ] =
    parts

  if (
    version !==
    VERSION
  ) {
    throw new Error(
      'Unsupported payment credential version.'
    )
  }

  const iv =
    Buffer.from(
      ivEncoded,
      'base64url'
    )

  const authTag =
    Buffer.from(
      authTagEncoded,
      'base64url'
    )

  const encrypted =
    Buffer.from(
      encryptedEncoded,
      'base64url'
    )

  if (
    iv.length !==
    IV_LENGTH
  ) {
    throw new Error(
      'Invalid payment credential IV.'
    )
  }

  if (
    authTag.length !==
    AUTH_TAG_LENGTH
  ) {
    throw new Error(
      'Invalid payment credential authentication tag.'
    )
  }

  const key =
    getEncryptionKey()

  const decipher =
    createDecipheriv(
      ALGORITHM,
      key,
      iv
    )

  decipher.setAuthTag(
    authTag
  )

  const decrypted =
    Buffer.concat([
      decipher.update(
        encrypted
      ),

      decipher.final(),
    ])

  return decrypted.toString(
    'utf8'
  )
}

// ============================================================
// VERIFIER SI UNE VALEUR EST CHIFFREE
// ============================================================

export function isEncryptedPaymentCredential(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return false
  }

  return value.startsWith(
    `${VERSION}.`
  )
}

// ============================================================
// MASQUAGE POUR L'INTERFACE
// ============================================================

export function maskPaymentCredential(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return 'Non configuré'
  }

  return '••••••••••••'
}

// ============================================================
// CLE MAITRE
// ============================================================

function getEncryptionKey() {
  const raw =
    process.env
      .PAYMENT_CREDENTIALS_ENCRYPTION_KEY
      ?.trim()

  if (!raw) {
    throw new Error(
      'PAYMENT_CREDENTIALS_ENCRYPTION_KEY is missing.'
    )
  }

  let key:
    Buffer

  try {
    key =
      Buffer.from(
        raw,
        'base64'
      )
  } catch {
    throw new Error(
      'PAYMENT_CREDENTIALS_ENCRYPTION_KEY is invalid.'
    )
  }

  if (
    key.length !==
    32
  ) {
    throw new Error(
      'PAYMENT_CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes.'
    )
  }

  return key
}