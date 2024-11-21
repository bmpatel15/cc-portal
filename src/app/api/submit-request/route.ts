import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '@/lib/config';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Add validation for required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'EMAIL_TO'
];

// Helper function to validate environment variables
function validateEnvVars() {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
  }
}

// Helper function to validate form data
function validateFormData(formData: FormData) {
  const requiredFields = ['fullName', 'email', 'department', 'projectType'];
  const missingFields = requiredFields.filter(field => !formData.get(field));
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

// Helper function to upload files to Supabase Storage
async function uploadFilesToSupabase(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('print-requests')  // Create this bucket in Supabase
        .upload(`files/${fileName}`, await file.arrayBuffer(), {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from('print-requests')
        .getPublicUrl(`files/${fileName}`);

      return {
        name: file.name,
        path: data.path,
        url: publicUrl
      };
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables first
    validateEnvVars();

    const formData = await request.formData();
    validateFormData(formData);

    // Get configuration
    const config = await loadConfig();

    const files = formData.getAll('files') as File[];
    const uploadedFiles = await uploadFilesToSupabase(files);

    // Create the message
    const message = `
New request submitted:
Full Name: ${formData.get('fullName')}
Email: ${formData.get('email')}
Phone: ${formData.get('phone')}
Department: ${formData.get('department')}
Event Name: ${formData.get('eventName')}
Quantity: ${formData.get('quantity')}
Project Type: ${formData.get('projectType')}
Project Description: ${formData.get('projectDescription')}
Uploaded Files:
${uploadedFiles.map(file => `- ${file.name}: ${file.url}`).join('\n')}
    `;

    // Send Telegram notification
    const bot = new TelegramBot(config.telegramToken, { polling: false });
    await bot.sendMessage(config.telegramChatId, message);

    // Send email notification
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: parseInt(config.email.port),
      secure: config.email.secure === 'true',
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    await transporter.sendMail({
      from: config.email.from,
      to: config.email.to,
      subject: 'New Print Request Submitted',
      text: message,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Request submitted successfully',
      files: uploadedFiles 
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }, 
      { status: error instanceof Error && error.message.includes('Missing required fields') ? 400 : 500 }
    );
  }
}