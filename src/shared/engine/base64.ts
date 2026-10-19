const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const b0 = bytes[index]
    const b1 = index + 1 < bytes.length ? bytes[index + 1] : 0
    const b2 = index + 2 < bytes.length ? bytes[index + 2] : 0
    out += BASE64_ALPHABET[b0 >> 2]
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]
    out += index + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '='
    out += index + 2 < bytes.length ? BASE64_ALPHABET[b2 & 0x3f] : '='
  }
  return out
}

export function base64ToBytes(value: string): Uint8Array {
  if (!BASE64_PATTERN.test(value) || value.length % 4 !== 0) {
    throw new Error(`响应字节不是有效的 base64：${value}`)
  }
  const clean = value.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let index = 0
  for (const char of clean) {
    const digit = BASE64_ALPHABET.indexOf(char)
    if (digit < 0) {
      throw new Error(`响应字节不是有效的 base64：${value}`)
    }
    buffer = (buffer << 6) | digit
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[index++] = (buffer >> bits) & 0xff
    }
  }
  return out.subarray(0, index)
}
