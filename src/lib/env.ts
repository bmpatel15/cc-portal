const requiredEnvVars = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASS',
] as const;

export function validateEnv() {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
} 