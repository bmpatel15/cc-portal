// app/api/submit-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';
import { loadConfig } from '@/lib/config';
import { Readable } from 'stream';

// Add validation for required environment variables
const requiredEnvVars = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_DRIVE_FOLDER_ID',
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

// Helper function to convert FormData file to stream
async function formDataFileToStream(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Readable.from(Buffer.from(arrayBuffer));
}

// Helper function to upload files to Google Drive
async function uploadFilesToDrive(
  files: File[], 
  driveClient: ReturnType<typeof google.drive>
) {
  return Promise.all(
    files.map(async (file) => {
      const fileMetadata = {
        name: file.name,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      };
      
      const fileStream = await formDataFileToStream(file);
      
      const media = {
        mimeType: file.type,
        body: fileStream,
      };
      
      const response = await driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });
      
      return {
        name: file.name,
        id: response.data.id,
        webViewLink: response.data.webViewLink,
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

    // Parse credentials properly
    let credentials;
    try {
      credentials = config.googleCredentials;
      if (!credentials) {
        throw new Error('Google credentials not configured');
      }
    } catch (error: unknown) {
      console.error('Error parsing credentials:', error);
      throw new Error('Invalid Google credentials format');
    }

    // Initialize Google Drive with proper credentials
    const driveClient = google.drive({
      version: 'v3',
      auth: new google.auth.GoogleAuth({
        credentials: typeof credentials === 'string' ? undefined : credentials,
        keyFile: typeof credentials === 'string' ? credentials : undefined,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      }),
    });

    const files = formData.getAll('files') as File[];
    const uploadedFiles = await uploadFilesToDrive(files, driveClient);

    // Rest of your code using config values
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
${uploadedFiles.map(file => `- ${file.name}: ${file.webViewLink}`).join('\n')}
    `;

    // Update these to use config values
    const bot = new TelegramBot(config.telegramToken, { polling: false });
    await bot.sendMessage(config.telegramChatId, message);

    // Send email using config values
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
      message: 'Request submitted successfully' 
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