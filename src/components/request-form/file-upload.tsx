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
  MAX_FILES,
  MAX_FILE_BYTES,
  type UploadedFile,
} from '@/lib/schemas/request'
import { cn } from '@/lib/utils'

import type { RequestFormValues } from './form-model'

const BUCKET = 'cc-portal'
const DEFAULT_HINT = `${ALLOWED_FILE_LABEL} · up to 100MB each`

/**
 * How many files to upload at once.
 *
 * Browsers allow about six connections per origin, so firing all ten at once
 * means every one of them crawls and none finishes early -- the whole batch
 * appears stuck. Three keeps the pipe busy while letting files land one by one.
 */
const UPLOAD_CONCURRENCY = 3

/**
 * Run `worker` over `items`, at most `limit` at a time, in order.
 *
 * `cursor++` needs no lock: JavaScript is single-threaded and nothing awaits
 * between reading the index and incrementing it.
 */
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let cursor = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++

        try {
          results[index] = { status: 'fulfilled', value: await worker(items[index]) }
        } catch (reason) {
          results[index] = { status: 'rejected', reason }
        }
      }
    }),
  )

  return results
}

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

    // Both the fetch and the json() parse are inside the try: a 500 or 502 from
    // the platform is an HTML error page, not JSON, so parsing it throws. Caught
    // here rather than at the batch level because only here is the filename
    // still known -- an error surfaced further up cannot say which file failed.
    let signed: { success?: boolean; message?: string; path: string; token: string }

    try {
      const response = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType, size: file.size }),
      })

      signed = await response.json()

      if (!response.ok || !signed.success) {
        toast.error(signed.message ?? `Could not prepare ${file.name} for upload`)
        return null
      }
    } catch {
      toast.error(`Could not prepare ${file.name} for upload`)
      return null
    }

    // uploadToSignedUrl ignores its contentType option for Blob bodies — it
    // posts the file as multipart, and Storage checks the *part's* type, which
    // the browser copies from File.type. Re-wrapping is the only way to correct
    // it. new File([file], ...) references the same bytes, so a 100MB upload is
    // not buffered here.
    const payload =
      file.type === contentType ? file : new File([file], file.name, { type: contentType })

    // Reports failure through `error` rather than by throwing, but a transport
    // abort can still reject, and one aborted upload must not discard the rest.
    try {
      const { error: uploadError } = await getBrowserClient()
        .storage.from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, payload, { contentType })

      if (uploadError) {
        toast.error(`Upload failed for ${file.name}: ${uploadError.message}`)
        return null
      }
    } catch {
      toast.error(`Upload failed for ${file.name}`)
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

    // The cap is applied before anything is uploaded. It used to be a slice
    // afterwards, which meant the extra files were pushed to storage, paid for,
    // and then dropped from the form without the user being told.
    const remaining = MAX_FILES - (form.getValues('files') ?? []).length

    if (remaining <= 0) {
      toast.error(`You can attach at most ${MAX_FILES} files. Remove one first.`)
      return
    }

    const incoming = Array.from(selected)
    const accepted = incoming.slice(0, remaining)
    const rejected = incoming.slice(remaining)

    if (rejected.length > 0) {
      // Named while the list is short enough to read, so the user can see which
      // of their files did not make it rather than counting the ones that did.
      toast.error(
        rejected.length <= 3
          ? `${rejected.map((file) => file.name).join(', ')} not attached — the limit is ${MAX_FILES} files.`
          : `${rejected.length} files not attached — the limit is ${MAX_FILES} files.`,
      )
    }

    setUploading(true)
    form.clearErrors('files')

    try {
      // Settled rather than all-or-nothing: uploadOne is written not to throw,
      // and this is the backstop if that ever stops being true. A single
      // rejection must not discard files that already reached storage.
      const results = await runPool(accepted, UPLOAD_CONCURRENCY, uploadOne)
      const uploaded = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : [],
      )

      if (uploaded.length > 0) {
        // Read at write time, not from the render closure: two overlapping drops
        // would otherwise clobber each other's additions.
        const before = form.getValues('files') ?? []
        const next = [...before, ...uploaded].slice(0, MAX_FILES)

        form.setValue('files', next)

        // Counted from what actually landed in the form. Two overlapping drops
        // each measure `remaining` before the other writes, so between them they
        // can still overshoot the cap -- and the count the user is shown has to
        // survive that.
        const added = next.length - before.length

        if (added > 0) {
          toast.success(added === 1 ? 'File uploaded' : `${added} files uploaded`)
        }
      }
    } catch (error) {
      // Both call sites invoke this as `void handleFiles(...)`, so without this
      // the rejection is unhandled and the user just watches the spinner stop.
      console.error('File upload batch failed:', error)
      toast.error('Something went wrong while uploading. Please try again.')
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
