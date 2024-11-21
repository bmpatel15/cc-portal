import { getSecret } from './secrets';

export async function loadConfig() {
  return {
    googleCredentials: await getSecret('GOOGLE_APPLICATION_CREDENTIALS'),
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
    googleDriveFolderId: await getSecret('GOOGLE_DRIVE_FOLDER_ID'),
  };
} 