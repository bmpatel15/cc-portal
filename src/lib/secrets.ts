export async function getSecret(secretName: string) {
  const value = process.env[secretName];
  if (!value) {
    throw new Error(`Secret ${secretName} not found`);
  }
  return value;
} 