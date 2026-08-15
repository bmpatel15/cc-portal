'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getBrowserClient } from '@/lib/supabase/client'
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  type UploadedFile,
} from '@/lib/schemas/request'
import { cn } from '@/lib/utils'

import type { RequestFormValues } from './form-model'

const BUCKET = 'cc-portal'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Uploads go straight from the browser to Supabase Storage using a short-lived
 * signed URL, so a 100MB artwork file never streams through the app server.
 */
export function FileUpload({ label = 'Upload artwork', required }: { label?: string; required?: boolean }) {
  const form = useFormContext<RequestFormValues>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)

  const files = form.watch('files') ?? []
  const error = form.formState.errors.files?.message as string | undefined

  async function uploadOne(file: File): Promise<UploadedFile | null> {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is larger than 100MB`)
      return null
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
      toast.error(`${file.name} must be a JPG, PNG, or PDF`)
      return null
    }

    const response = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    })

    const signed = await response.json()

    if (!response.ok || !signed.success) {
      toast.error(signed.message ?? `Could not prepare ${file.name} for upload`)
      return null
    }

    const { error: uploadError } = await getBrowserClient()
      .storage.from(BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })

    if (uploadError) {
      toast.error(`Upload failed for ${file.name}: ${uploadError.message}`)
      return null
    }

    return {
      name: file.name,
      path: signed.path,
      size: file.size,
      contentType: file.type as UploadedFile['contentType'],
    }
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return

    setUploading(true)
    form.clearErrors('files')

    try {
      const results = await Promise.all(Array.from(selected).map(uploadOne))
      const uploaded = results.filter((result): result is UploadedFile => result !== null)

      if (uploaded.length > 0) {
        form.setValue('files', [...files, ...uploaded].slice(0, 10))
        toast.success(uploaded.length === 1 ? 'File uploaded' : `${uploaded.length} files uploaded`)
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeFile(path: string) {
    form.setValue(
      'files',
      files.filter((file) => file.path !== path),
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium leading-snug">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </Label>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-input',
          error && 'border-destructive/60',
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}

        <p className="text-sm text-muted-foreground">
          {uploading ? 'Uploading…' : 'Drag and drop, or'}{' '}
          {!uploading ? (
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              choose a file
            </button>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">JPG, PNG, or PDF · up to 100MB each</p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_FILE_EXTENSIONS}
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.path}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(file.path)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        The team needs the artwork to produce your print job.
      </p>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}
