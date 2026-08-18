'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { resolveFileType } from '@/lib/files'
import { getBrowserClient } from '@/lib/supabase/client'
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_LABEL,
  MAX_FILE_BYTES,
  type UploadedFile,
} from '@/lib/schemas/request'
import { cn } from '@/lib/utils'

import type { RequestFormValues } from './form-model'

const BUCKET = 'cc-portal'
const DEFAULT_HINT = `${ALLOWED_FILE_LABEL} · up to 100MB each`

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Uploads go straight from the browser to Supabase Storage using a short-lived
 * signed URL, so a 100MB artwork file never streams through the app server.
 */
export function FileUpload({
  label = 'Upload artwork',
  required,
  hint = DEFAULT_HINT,
  description,
}: {
  label?: string
  required?: boolean
  hint?: string
  description?: string
}) {
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

    const contentType = resolveFileType(file.name)

    if (!contentType) {
      toast.error(`${file.name} must be a ${ALLOWED_FILE_LABEL} file`)
      return null
    }

    const response = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType, size: file.size }),
    })

    const signed = await response.json()

    if (!response.ok || !signed.success) {
      toast.error(signed.message ?? `Could not prepare ${file.name} for upload`)
      return null
    }

    // uploadToSignedUrl ignores its contentType option for Blob bodies — it
    // posts the file as multipart, and Storage checks the *part's* type, which
    // the browser copies from File.type. Re-wrapping is the only way to correct
    // it. new File([file], ...) references the same bytes, so a 100MB upload is
    // not buffered here.
    const payload =
      file.type === contentType ? file : new File([file], file.name, { type: contentType })

    const { error: uploadError } = await getBrowserClient()
      .storage.from(BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, payload, { contentType })

    if (uploadError) {
      toast.error(`Upload failed for ${file.name}: ${uploadError.message}`)
      return null
    }

    return {
      name: file.name,
      path: signed.path,
      size: file.size,
      contentType,
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
        // Read at write time, not from the render closure: two overlapping drops
        // would otherwise clobber each other's additions.
        form.setValue('files', [...(form.getValues('files') ?? []), ...uploaded].slice(0, 10))
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
      (form.getValues('files') ?? []).filter((file) => file.path !== path),
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
        <p className="text-xs text-muted-foreground">{hint}</p>

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

      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}
