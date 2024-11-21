import { getSecret } from './secrets';

export async function loadConfig() {
  return {
    supabase: {
      url: await getSecret('NEXT_PUBLIC_SUPABASE_URL'),
      serviceKey: await getSecret('SUPABASE_SERVICE_ROLE_KEY'),
    },
    telegramToken: await getSecret('TELEGRAM_BOT_TOKEN'),
    telegramChatId: await getSecret('TELEGRAM_CHAT_ID'),
    email: {
      host: await getSecret('EMAIL_HOST'),
      port: await getSecret('EMAIL_PORT'),
      secure: await getSecret('EMAIL_SECURE'),
      user: await getSecret('EMAIL_USER'),
      pass: await getSecret('EMAIL_PASS'),
      from: await getSecret('EMAIL_FROM'),
      to: await getSecret('EMAIL_TO'),
    },
  };
} 