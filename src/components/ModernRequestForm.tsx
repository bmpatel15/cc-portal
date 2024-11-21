'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ApiResponse } from '@/types/request'

export default function ModernRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      
      // Remove any existing file entries and add the current files
      formData.delete('files')
      files.forEach(file => formData.append('files', file))

      const response = await fetch('/api/submit-request', {
        method: 'POST',
        body: formData,
      })

      const data: ApiResponse = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Submission failed')
      }

      setSuccess('Request submitted successfully!')
      form.reset()
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  return (
    <div className="flex-1 flex flex-col p-2 sm:p-4">
      <Card className="border-none shadow-lg flex-1 flex flex-col">
        <CardContent className="p-4 sm:p-6 flex-1 flex flex-col">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 flex-1 flex flex-col">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 sm:p-4 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 text-green-600 p-3 sm:p-4 rounded-md text-sm">
                {success}
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="fullName" className="text-sm sm:text-base">Full Name *</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    required 
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm sm:text-base">Email *</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="phone" className="text-sm sm:text-base">Phone</Label>
                  <Input 
                    id="phone" 
                    name="phone"
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="department" className="text-sm sm:text-base">Department *</Label>
                  <Input 
                    id="department" 
                    name="department" 
                    required
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="eventName" className="text-sm sm:text-base">Event Name *</Label>
                <Input 
                  id="eventName" 
                  name="eventName" 
                  required
                  className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="quantity" className="text-sm sm:text-base">Quantity *</Label>
                  <Input 
                    id="quantity" 
                    name="quantity" 
                    type="number" 
                    min="1"
                    step="1"
                    onKeyDown={(e) => {
                      // Prevent decimal point and non-numeric keys (except backspace, delete, arrows)
                      if (
                        e.key === '.' || 
                        e.key === '-' || 
                        e.key === 'e' ||
                        (!/[0-9]/.test(e.key) && 
                         !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key))
                      ) {
                        e.preventDefault();
                      }
                    }}
                    onWheel={(e) => e.currentTarget.blur()} // Prevent scroll wheel from changing value
                    required
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="projectType" className="text-sm sm:text-base">Project Type *</Label>
                  <Input 
                    id="projectType" 
                    name="projectType" 
                    required
                    className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="projectDescription" className="text-sm sm:text-base">Project Description *</Label>
                <Textarea 
                  id="projectDescription" 
                  name="projectDescription" 
                  required
                  className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base transition-colors focus:border-primary"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="files" className="text-sm sm:text-base">Upload Files *</Label>
                <Input 
                  id="files" 
                  name="files" 
                  type="file" 
                  multiple 
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  required 
                  className="text-sm sm:text-base transition-colors focus:border-primary"
                />
                {files.length > 0 && (
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2">
                    Selected files: {files.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-[200px] mx-auto h-9 sm:h-10 text-sm sm:text-base transition-all 
                hover:scale-[1.02] active:scale-[0.98] mt-auto bg-primary hover:bg-primary/90
                rounded-md font-medium shadow-sm"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Submitting...
                </span>
              ) : (
                'Submit Request'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}