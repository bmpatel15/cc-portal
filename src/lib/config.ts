import { getSecret } from './secrets';

export async function loadConfig() {
  // Validate Supabase URL format
  const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    throw new Error('Invalid Supabase URL. Must start with https://');
  }

  return {
    supabase: {
      url: supabaseUrl,
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