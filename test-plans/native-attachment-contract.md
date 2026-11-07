# Attachment encryption contract — changes requested from native

Keep the new fixed-header AttachmentCipher design and the current algorithm:
`tink-aes256-gcm-hkdf-64k+commit-v1`, with the commitment label
`sceyt.attachment.key-commitment.v1` and a 72-byte combined header.

The updated shared spec derives a dedicated commitment key:

```text
commitKey = HKDF-SHA256(ikm, salt = empty,
                       info = "sceyt.attachment.key-commitment.v1", length = 32)
commitment = HMAC-SHA256(commitKey, attachmentId || Tink header)
```

The label has no terminator. The HMAC input is exactly 56 bytes (16-byte ID and
40-byte Tink header), with no separator. Do not use the input key directly as
the HMAC key. Tink's segment-key derivation and ciphertext are unchanged; only
the first 32 bytes of a fixed test object's combined header change. This is a
pre-release correction within version 1, with no old-commitment fallback.

## 1. Attachment key: base64url JSON

The attachment key is unpadded base64url of UTF-8 JSON containing exactly:

```json
{"v":1,"k":"<base64url of 32 key bytes>","aid":"<base64url of 16 attachment-ID bytes>"}
```

Use this instead of the binary 49-byte token. Do not include `alg`, `ps`, salt,
nonce prefix or header. Version 1 fixes the algorithm. The decoded key and ID
must be exactly 32 and 16 bytes; malformed keys or unsupported versions fail
with InvalidEncryption. JSON property order has no semantic significance.

The cipher API takes 16 raw attachment-ID bytes. Encoding the ID happens only
inside the JSON key representation; it does not change the cipher input type.
The application keeps plaintext size outside the token.

## 2. Upload checkpoints: new shape, version 1

Keep checkpoint data version **1**, not 2, with this new structure:

```text
cipher: attachment key + original 72-byte header
opaque data: {v: 1, fileSize, fileModified, parts}
parts: {"offset:length": "base64url SHA-256 of the ciphertext range"}
```

Salt and nonce prefix already exist in the header, so do not duplicate them in
data. The source ID is SHA-256 of the complete 72-byte header. Keep the complete
checkpoint private, never in message metadata. When serializing, explicitly save
the attachment key, header bytes and opaque data; restore the cipher before the
upload. File-size, modification-time and recorded-range checks remain mandatory.

## 3. Random access: read(), with strict native semantics

Name the public method `read(offset, length)` instead of `pread(offset, length)`.
Internal OS reads may still use pread. Keep the native behavior:

- Return exactly `length` bytes or an error; never silently clip at EOF.
- A range extending past the end fails with OutOfRange.
- Reading zero bytes at EOF succeeds; a zero-byte read past EOF fails.
- Encrypting-view offsets refer to ciphertext; decrypting-view offsets refer to plaintext.
- Opening a decrypting view verifies its header and the final tag of an empty file
  before returning the view.
- A header of a length other than 72 bytes fails with InvalidArgument; a mismatched
  commitment or header fails with Authentication.

## Other web behavior retained

The web raw encrypting random-access view also checks hashes of repeated or
overlapping plaintext segments, failing with FileChanged before returning changed
ciphertext. WAAFI uses this view directly. Native can add the same guard in its raw
view; its existing PreparedUpload range hashes remain useful for saved checkpoints.

Web transfers currently verify/decrypt after downloading the complete ciphertext.
Playback while downloading and persistence across an application reload remain out
of scope for the web implementation. No removal of native media-download features
is requested.
