/**
 * SHA-256 hash for ArrayBuffer or string. Returns hex string.
 */
export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
