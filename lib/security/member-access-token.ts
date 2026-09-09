import 'server-only'

import {
  createHash,
  randomBytes,
} from 'crypto'

export function generateMemberAccessToken() {
  return randomBytes(32)
    .toString('base64url')
}

export function hashMemberAccessToken(
  token: string
) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}