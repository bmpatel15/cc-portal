export interface PrintRequest {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  eventName: string;
  quantity: number;
  projectType: string;
  projectDescription: string;
  files: File[];
}

export interface UploadedFile {
  name: string;
  path: string;
  url: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
  files?: UploadedFile[];
  error?: string;
} 