import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '@/lib/config';
import { PrintRequest, ApiResponse, UploadedFile } from '@/types/request';

// Helper function to sanitize filename
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace any character that's not alphanumeric, dot, or hyphen with underscore
    .replace(/_{2,}/g, '_');         // Replace multiple consecutive underscores with a single one
}

// Helper function to upload files with better error handling
async function uploadFiles(files: File[], supabase: SupabaseClient) {
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  const BUCKET_NAME = 'cc-portal';

  const uploadedFiles: UploadedFile[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      console.log('Processing file:', file.name);
      
      // Validate file size and type
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File ${file.name} exceeds maximum size of 100MB`);
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`File ${file.name} has unsupported type. Allowed types: JPG, PNG, PDF`);
      }

      // Sanitize the filename
      const sanitizedName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${sanitizedName}`;
      const filePath = `files/${fileName}`;

      console.log('Uploading file:', {
        originalName: file.name,
        sanitizedName,
        filePath
      });

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, await file.arrayBuffer(), {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      // Get the base URL from your environment
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      // Construct the public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;

      console.log('Generated URL:', publicUrl);

      uploadedFiles.push({
        name: file.name,
        path: data.path,
        url: publicUrl
      });

    } catch (err) {
      const error = err as Error;
      console.error('Upload error:', error);
      errors.push(`Failed to upload ${file.name}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`File upload errors:\n${errors.join('\n')}`);
  }

  console.log('All files uploaded successfully:', uploadedFiles);
  return uploadedFiles;
}

// Helper function to send notifications
async function sendNotifications(data: PrintRequest, files: UploadedFile[], config: Awaited<ReturnType<typeof loadConfig>>) {
  const message = `
New print request submitted:
Full Name: ${data.fullName}
Email: ${data.email}
Phone: ${data.phone || 'Not provided'}
Department: ${data.department}
Event Name: ${data.eventName}
Quantity: ${data.quantity}
Project Type: ${data.projectType}
Project Description: ${data.projectDescription}

Uploaded Files:
${files.map(file => `- ${file.name}: ${file.url}`).join('\n')}
  `.trim();

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
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const config = await loadConfig();
    
    // Validate Supabase configuration
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Invalid Supabase configuration');
    }

    // Initialize Supabase client with validation
    let supabase;
    try {
      supabase = createClient(
        config.supabase.url,
        config.supabase.serviceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    } catch (error) {
      console.error('Supabase client creation error:', error);
      throw new Error('Failed to initialize storage client');
    }

    const formData = await request.formData();
    
    // Parse form data
    const requestData: PrintRequest = {
      fullName: formData.get('fullName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      department: formData.get('department') as string,
      eventName: formData.get('eventName') as string,
      quantity: Number(formData.get('quantity')),
      projectType: formData.get('projectType') as string,
      projectDescription: formData.get('projectDescription') as string,
      files: formData.getAll('files') as File[]
    };

    // Basic validation
    if (!requestData.fullName || !requestData.email || !requestData.department) {
      throw new Error('Missing required fields');
    }

    // Upload files
    const files = formData.getAll('files') as File[];
    if (!files.length) {
      throw new Error('At least one file is required');
    }
    const uploadedFiles = await uploadFiles(files, supabase);

    // Send notifications
    await sendNotifications(requestData, uploadedFiles, config);

    return NextResponse.json({
      success: true,
      message: 'Request submitted successfully',
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Error processing request:', error);
    
    // More specific error messages
    let errorMessage = 'An unknown error occurred';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('Invalid Supabase')) {
        errorMessage = 'Storage service configuration error';
        statusCode = 503;
      } else if (error.message.includes('Missing required fields')) {
        errorMessage = error.message;
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: statusCode });
  }
}