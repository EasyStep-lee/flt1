import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const algorithm = 'scrypt';
const keyLength = 32;
const dummyHash = `${algorithm}$${Buffer.alloc(16).toString('base64url')}$${scryptSync('invalid-welfare-card-secret', Buffer.alloc(16), keyLength).toString('base64url')}`;

export const hashWelfareCardSecret = (secret: string, salt = randomBytes(16)): string => {
  const digest = scryptSync(secret, salt, keyLength);
  return `${algorithm}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
};

export const verifyWelfareCardSecret = (secret: string, encodedHash: string | null | undefined): boolean => {
  const encoded = encodedHash ?? dummyHash;
  const [name, saltValue, digestValue, ...rest] = encoded.split('$');
  if (name !== algorithm || rest.length > 0 || !saltValue || !digestValue) {
    scryptSync(secret, Buffer.alloc(16), keyLength);
    return false;
  }
  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(digestValue, 'base64url');
    const actual = scryptSync(secret, salt, expected.length);
    return expected.length === keyLength && timingSafeEqual(actual, expected);
  } catch {
    scryptSync(secret, Buffer.alloc(16), keyLength);
    return false;
  }
};
