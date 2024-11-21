'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ApiResponse } from '@/types/request'

export default function ModernRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [team, setTeam] = useState<string>("")
  const [contentType, setContentType] = useState<string>("")
  const [mobileVersion, setMobileVersion] = useState<string>("")
  const [horizontalVersion, setHorizontalVersion] = useState<string>("")
  const [printType, setPrintType] = useState<string>("")
  const [requiresMics, setRequiresMics] = useState<string>("")
  const [micType, setMicType] = useState<string>("")
  const [requiresSpeakers, setRequiresSpeakers] = useState<string>("")
  const [requiresPhoto, setRequiresPhoto] = useState<string>("")
  const [photographerCount, setPhotographerCount] = useState<string>("")
  const [photoPurpose, setPhotoPurpose] = useState<string>("")
  const [photoLocation, setPhotoLocation] = useState<string>("")
  const [photoDeliverables, setPhotoDeliverables] = useState<string>("")
  const [requiresVideo, setRequiresVideo] = useState<string>("")
  const [videographerCount, setVideographerCount] = useState<string>("")
  const [videoType, setVideoType] = useState<string>("")
  const [videoAudience, setVideoAudience] = useState<string>("")
  const [videoLocation, setVideoLocation] = useState<string>("")
  const [videoFormat, setVideoFormat] = useState<string>("")
  const [videoDeadline, setVideoDeadline] = useState<string>("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList) {
      setFiles(Array.from(fileList))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      
      // Handle files only for printing requests
      if (team === "content-creation" && contentType === "printing") {
        // Remove any existing file entries
        formData.delete('artwork')
        // Add each file to formData
        files.forEach(file => {
          formData.append('artwork', file)
        })
      }

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
      setTeam("")
      setContentType("")
      setMobileVersion("")
      setHorizontalVersion("")
      setPrintType("")
      setRequiresMics("")
      setMicType("")
      setRequiresSpeakers("")
      setRequiresPhoto("")
      setPhotographerCount("")
      setPhotoPurpose("")
      setPhotoLocation("")
      setPhotoDeliverables("")
      setRequiresVideo("")
      setVideographerCount("")
      setVideoType("")
      setVideoAudience("")
      setVideoLocation("")
      setVideoFormat("")
      setVideoDeadline("")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
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

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="eventName" className="text-sm sm:text-base">Event Name *</Label>
                <Input 
                  id="eventName" 
                  name="eventName" 
                  required
                  className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="eventDateTime" className="text-sm sm:text-base">Event Date and Time *</Label>
                <Input 
                  id="eventDateTime" 
                  name="eventDateTime" 
                  type="datetime-local" 
                  required 
                  className="h-8 sm:h-9 text-sm sm:text-base transition-colors focus:border-primary"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="team">Which team would you like assistance from? *</Label>
                <Select 
                  name="team" 
                  value={team} 
                  onValueChange={setTeam}
                >
                  <SelectTrigger className="h-8 sm:h-9 text-sm sm:text-base">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="photo-video">Photo/Video</SelectItem>
                    <SelectItem value="content-creation">Content Creation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {team === "content-creation" && (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="contentType">What Type of Content *</Label>
                    <Select required value={contentType} onValueChange={setContentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="graphics">Graphics</SelectItem>
                        <SelectItem value="video">Video Creation</SelectItem>
                        <SelectItem value="printing">Printing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {contentType === "graphics" && (
                    <>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="description">Description of what is needed *</Label>
                        <Textarea 
                          id="description" 
                          name="description" 
                          required
                          className="min-h-[80px] text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label>Will there be a need for a Mobile Version? *</Label>
                        <RadioGroup required value={mobileVersion} onValueChange={setMobileVersion}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="mobile-yes" />
                            <Label htmlFor="mobile-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="mobile-no" />
                            <Label htmlFor="mobile-no">No</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label>Will there be a need for a Horizontal Version? *</Label>
                        <RadioGroup required value={horizontalVersion} onValueChange={setHorizontalVersion}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="horizontal-yes" />
                            <Label htmlFor="horizontal-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="horizontal-no" />
                            <Label htmlFor="horizontal-no">No</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </>
                  )}

                  {contentType === "printing" && (
                    <>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="printType">What type of print? *</Label>
                        <Select required value={printType} onValueChange={setPrintType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select print type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="podium-banner">Podium Banner</SelectItem>
                            <SelectItem value="vinyl-banner">Vinyl Banner</SelectItem>
                            <SelectItem value="indoor-poster">Indoor Poster</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {printType === "other" && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label htmlFor="printDescription">Description *</Label>
                          <Textarea 
                            id="printDescription" 
                            name="printDescription" 
                            required
                            className="min-h-[80px] text-sm sm:text-base"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="quantity">Quantity *</Label>
                        <Input 
                          id="quantity" 
                          name="quantity" 
                          type="number" 
                          min="1"
                          required 
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label htmlFor="width">Width (inches) *</Label>
                          <Input 
                            id="width" 
                            name="width" 
                            type="number" 
                            min="0"
                            step="0.1"
                            required 
                            className="h-8 sm:h-9 text-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label htmlFor="height">Height (inches) *</Label>
                          <Input 
                            id="height" 
                            name="height" 
                            type="number" 
                            min="0"
                            step="0.1"
                            required 
                            className="h-8 sm:h-9 text-sm sm:text-base"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="artwork">Upload Artwork *</Label>
                        <Input 
                          id="artwork" 
                          name="artwork" 
                          type="file" 
                          multiple={false}
                          accept=".jpg,.jpeg,.png,.pdf,.ai,.psd"
                          required={contentType === "printing"}
                          onChange={handleFileChange}
                          className="text-sm sm:text-base transition-colors focus:border-primary"
                        />
                        {files.length > 0 && (
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                            Selected file: {files[0].name}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {team === "photo-video" && (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label>Is photography needed? *</Label>
                    <RadioGroup required value={requiresPhoto} onValueChange={setRequiresPhoto}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="photo-yes" />
                        <Label htmlFor="photo-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="photo-no" />
                        <Label htmlFor="photo-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {requiresPhoto === "yes" && (
                    <>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="photographerCount">How many photographers will be required? *</Label>
                        <Input 
                          id="photographerCount"
                          name="photographerCount"
                          type="number"
                          min="1"
                          required
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="photoPurpose">What is the purpose of the photography? *</Label>
                        <Select required value={photoPurpose} onValueChange={setPhotoPurpose}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purpose" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="event-coverage">Event Coverage</SelectItem>
                            <SelectItem value="invited-guests">Invited Guests</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="photoLocation">What is the location and setting for the photography? *</Label>
                        <Textarea 
                          id="photoLocation"
                          name="photoLocation"
                          required
                          className="min-h-[80px] text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="photoDeliverables">Are there any specific deliverables required? *</Label>
                        <Textarea 
                          id="photoDeliverables"
                          name="photoDeliverables"
                          placeholder="e.g., number of edited photos"
                          required
                          className="min-h-[80px] text-sm sm:text-base"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label>Is videography needed? *</Label>
                    <RadioGroup required value={requiresVideo} onValueChange={setRequiresVideo}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="video-yes" />
                        <Label htmlFor="video-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="video-no" />
                        <Label htmlFor="video-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {requiresVideo === "yes" && (
                    <>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videographerCount">How many videographers will be required? *</Label>
                        <Input 
                          id="videographerCount"
                          name="videographerCount"
                          type="number"
                          min="1"
                          required
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videoType">What type of video is being requested? *</Label>
                        <Select required value={videoType} onValueChange={setVideoType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select video type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="interviews">Interviews</SelectItem>
                            <SelectItem value="program-recording">Program Recording</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videoAudience">What is the intended use and audience for the video? *</Label>
                        <Textarea 
                          id="videoAudience"
                          name="videoAudience"
                          required
                          className="min-h-[80px] text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videoLocation">Where will the videography take place? *</Label>
                        <Textarea 
                          id="videoLocation"
                          name="videoLocation"
                          required
                          className="min-h-[80px] text-sm sm:text-base"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videoFormat">Are you looking for live video, recorded video, or both? *</Label>
                        <Select required value={videoFormat} onValueChange={setVideoFormat}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select video format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="live">Live Video</SelectItem>
                            <SelectItem value="recorded">Recorded Video</SelectItem>
                            <SelectItem value="both">Both Live and Recorded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="videoDeadline">What is the deadline for the completed video? *</Label>
                        <Input 
                          id="videoDeadline"
                          name="videoDeadline"
                          type="date"
                          required
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {team === "audio" && (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Select required name="location">
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main-hall">Main Hall</SelectItem>
                        <SelectItem value="gym">Gym</SelectItem>
                        <SelectItem value="outdoors">Outdoors</SelectItem>
                        <SelectItem value="bky-rooms">e/i BKY Rooms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label>Are Microphones Required? *</Label>
                    <RadioGroup required value={requiresMics} onValueChange={setRequiresMics}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="mics-yes" />
                        <Label htmlFor="mics-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="mics-no" />
                        <Label htmlFor="mics-no">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {requiresMics === "yes" && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label>What type of microphones? *</Label>
                      <RadioGroup required value={micType} onValueChange={setMicType}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="wireless" id="mic-wireless" />
                          <Label htmlFor="mic-wireless">Wireless</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="wired" id="mic-wired" />
                          <Label htmlFor="mic-wired">Wired</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {micType === "wireless" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="handheldCount">How many Handheld? *</Label>
                        <Input 
                          id="handheldCount" 
                          name="handheldCount" 
                          type="number" 
                          min="0"
                          required 
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor="headsetCount">How many Headsets? *</Label>
                        <Input 
                          id="headsetCount" 
                          name="headsetCount" 
                          type="number" 
                          min="0"
                          required 
                          className="h-8 sm:h-9 text-sm sm:text-base"
                        />
                      </div>
                    </div>
                  )}

                  {micType === "wired" && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="wiredCount">How many wired mics? *</Label>
                      <Input 
                        id="wiredCount" 
                        name="wiredCount" 
                        type="number" 
                        min="1"
                        required 
                        className="h-8 sm:h-9 text-sm sm:text-base"
                      />
                    </div>
                  )}

                  {(requiresMics === "no" || requiresMics === "yes") && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label>Are Speakers Required? *</Label>
                      <RadioGroup required value={requiresSpeakers} onValueChange={setRequiresSpeakers}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="speakers-yes" />
                          <Label htmlFor="speakers-yes">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="speakers-no" />
                          <Label htmlFor="speakers-no">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="audioDescription">Additional Notes</Label>
                    <Textarea 
                      id="audioDescription" 
                      name="audioDescription" 
                      className="min-h-[80px] text-sm sm:text-base"
                    />
                  </div>
                </>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}