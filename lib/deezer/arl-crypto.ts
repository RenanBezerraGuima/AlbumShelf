import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ENCODED_PARTS = 4;

export class DeezerArlCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeezerArlCryptoError';
  }
}

function decodeEncryptionKey(encodedKey: string) {
  const trimmedKey = encodedKey.trim();
  if (!trimmedKey) {
    throw new DeezerArlCryptoError('DEEZER_ARL_ENCRYPTION_KEY is not configured.');
  }

  const candidates = [
    Buffer.from(trimmedKey, 'base64'),
    Buffer.from(trimmedKey, 'hex'),
  ];

  const key = candidates.find((candidate) => candidate.length === KEY_LENGTH);
  if (!key) {
    throw new DeezerArlCryptoError(
      'DEEZER_ARL_ENCRYPTION_KEY must decode to 32 bytes. Generate one with `openssl rand -base64 32`.',
    );
  }

  return key;
}

export function encryptArl(arl: string, encodedKey = process.env.DEEZER_ARL_ENCRYPTION_KEY) {
  if (!encodedKey) {
    throw new DeezerArlCryptoError('DEEZER_ARL_ENCRYPTION_KEY is not configured.');
  }

  const key = decodeEncryptionKey(encodedKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(arl, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptArl(encryptedArl: string, encodedKey = process.env.DEEZER_ARL_ENCRYPTION_KEY) {
  if (!encodedKey) {
    throw new DeezerArlCryptoError('DEEZER_ARL_ENCRYPTION_KEY is not configured.');
  }

  const parts = encryptedArl.split(':');
  if (parts.length !== ENCODED_PARTS || parts[0] !== 'v1') {
    throw new DeezerArlCryptoError('Unsupported encrypted Deezer ARL format.');
  }

  const key = decodeEncryptionKey(encodedKey);
  const iv = Buffer.from(parts[1], 'base64url');
  const authTag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || ciphertext.length === 0) {
    throw new DeezerArlCryptoError('Invalid encrypted Deezer ARL payload.');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function maskArl(arl: string) {
  const trimmed = arl.trim();
  if (trimmed.length <= 8) return '****';
  return `...${trimmed.slice(-4)}`;
}
