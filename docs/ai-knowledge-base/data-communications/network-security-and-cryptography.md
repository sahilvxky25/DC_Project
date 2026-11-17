# Network Security and Cryptography Fundamentals

## Security goals

- **Confidentiality:** prevent unauthorized disclosure.
- **Integrity:** detect or prevent unauthorized modification.
- **Authentication:** verify an identity or message origin.
- **Authorization:** decide what an authenticated identity may do.
- **Availability:** keep systems and services usable.

Security is achieved through layered controls and sound operational practices, not encryption alone.

## Hashing, encryption, and signatures

- A cryptographic hash maps input data to a fixed-length digest. A secure hash such as SHA-256 is designed to be one-way; hashing is not encryption.
- Symmetric encryption uses a shared secret key. Authenticated encryption modes such as AES-GCM provide confidentiality and integrity when used correctly with unique nonces for a given key.
- Asymmetric cryptography uses related public and private keys. RSA-OAEP can encrypt small pieces of data; practical systems often use hybrid encryption to protect data with a symmetric key and use public-key cryptography to protect or agree that key.
- Digital signatures provide a way to verify that a message was signed by the holder of a private key and has not been modified, subject to correct key validation.

## Key agreement and TLS

Diffie–Hellman key agreement lets parties derive shared secret material over an untrusted channel. Authenticated key agreement binds the exchange to identities to resist man-in-the-middle attacks. TLS combines key agreement, certificate-based authentication, and authenticated encryption.

## Teaching examples versus production cryptography

Caesar and XOR demonstrations are intentionally insecure teaching examples. Do not use them to protect real information. Production applications should use vetted cryptographic libraries, secure protocols, appropriate key management, and current security guidance. Avoid implementing cryptographic primitives from scratch.

## BitSecure security-lab boundaries

BitSecure includes browser-based demonstrations of Caesar/XOR teaching ciphers, AES-GCM, RSA-OAEP hybrid encryption, ECDH key agreement, and SHA-256 hashing, as documented in the repository README. These activities illustrate concepts; they are not a substitute for a reviewed production cryptographic design.

## Safety note for an AI tutor

The assistant may explain defensive security concepts and the educational labs. It must not claim a simulated firewall or packet capture is operating on a real device. It should encourage users to test only systems they own or are authorized to assess.
