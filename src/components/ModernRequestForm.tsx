'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { HardDriveIcon as DriveIcon, FileIcon, Clock } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export default function ModernRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)
  const [isFileReqOpen, setIsFileReqOpen] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => {
      document.documentElement.style.scrollBehavior = 'auto'
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
  
    const formData = new FormData(event.currentTarget);
    
    if (files) {
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
    }
  
    try {
      const response = await fetch('/api/submit-request', {
        method: 'POST',
        body: formData,
      });
  
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (response.ok) {
          alert(data.message || 'Request submitted successfully!');
          event.currentTarget.reset();
          setFiles(null);
        } else {
          throw new Error(data.message || 'Failed to submit request');
        }
      } else {
        // If the response is not JSON, it's likely an error page
        const text = await response.text();
        console.error('Received non-JSON response:', text);
        throw new Error('Received an unexpected response from the server');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error instanceof Error ? error.message : 'An unknown error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="text-2xl font-bold">Content Request Form</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          <div className="mb-8 space-y-6">
            <div className="text-lg">
              Jay Swaminarayan and welcome to the Cotent Request Portal!
            </div>
            
            <p className="text-gray-600">
              To ensure the best possible results and timely delivery of your print materials, please note:
            </p>

            <div className="space-y-4">
              <Collapsible open={isFileReqOpen} onOpenChange={setIsFileReqOpen}>
                <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
                  <FileIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">File Requirements</span>
                  <CollapsibleTrigger asChild>
                    <Button variant="link" className="ml-auto p-0 h-auto font-normal">
                      {isFileReqOpen ? 'Show Less' : 'Show More'}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-4 space-y-2 text-gray-600">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Upload your artwork in the exact dimensions needed for printing</li>
                    <li>Accepted file formats: JPG, PSD, and PDF</li>
                    <li>Ensure files are high-resolution and properly formatted</li>
                    <li>Double-check all measurements before submission</li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
                <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Timeline Information</span>
                  <CollapsibleTrigger asChild>
                    <Button variant="link" className="ml-auto p-0 h-auto font-normal">
                      {isTimelineOpen ? 'Show Less' : 'Show More'}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-4 space-y-2 text-gray-600">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Please submit requests at least <span className="font-semibold">2 weeks</span> before your needed date</li>
                    <li>All requests are processed in order of submission</li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="text-gray-600">
              <p className="mb-4">
                Your request will be added to our print queue and processed in the order received. We'll notify you once your
                project begins processing and when it is ready for pickup.
              </p>
              <p>
                Need design help or have questions? Feel free to reach out to our Content Creation Team at{' '}
                <a href="mailto:tampacontentteam@gmail.com" className="text-blue-600 hover:underline">
                  tampacontentteam@gmail.com
                </a>
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Client Information Section */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Client Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-1 text-gray-700">
                    Full Name
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    required
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1 text-gray-700">
                    Email Address
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1 text-gray-700">
                    Phone Number
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    type="tel" 
                    required
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-gray-700">
                    Department
                  </Label>
                  <Input 
                    id="department" 
                    name="department"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientInfo" className="text-gray-700">Additional Information (optional)</Label>
                <Textarea 
                  id="clientInfo" 
                  name="clientInfo"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </section>

            {/* Event Details Section */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Event Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventName" className="flex items-center gap-1 text-gray-700">
                    Event Name
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="eventName" 
                    name="eventName" 
                    required
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="flex items-center gap-1 text-gray-700">
                    Quantity
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="quantity" 
                    name="quantity" 
                    type="number" 
                    min="1" 
                    required
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventDescription" className="text-gray-700">Event Description (optional)</Label>
                <Textarea 
                  id="eventDescription" 
                  name="eventDescription"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectDescription" className="flex items-center gap-1 text-gray-700">
                  Project Description
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea 
                  id="projectDescription" 
                  name="projectDescription" 
                  required
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-gray-700">
                  Project Type
                  <span className="text-red-500">*</span>
                </Label>
                <RadioGroup name="projectType" className="grid grid-cols-2 gap-4 sm:grid-cols-4" required>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="posters" id="posters" />
                    <Label htmlFor="posters" className="text-gray-700">Posters</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="large-outdoor-banners" id="large-outdoor-banners" />
                    <Label htmlFor="large-outdoor-banners" className="text-gray-700">Large Outdoor Banners</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="podium-banner" id="podium-banner" />
                    <Label htmlFor="podium-banner" className="text-gray-700">Podium Banner</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="text-gray-700">Other</Label>
                  </div>
                </RadioGroup>
              </div>
            </section>

            {/* Artwork Files Section */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Artwork Files</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artworkDescription" className="text-gray-700">Artwork Description (optional)</Label>
                  <Textarea 
                    id="artworkDescription" 
                    name="artworkDescription"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="files" className="flex items-center gap-1 text-gray-700">
                    Upload your Artwork Files
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                    <Input
                      id="files"
                      name="files"
                      type="file"
                      multiple
                      required
                      onChange={(e) => setFiles(e.target.files)}
                      className="max-w-full sm:max-w-[300px] border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-100"
                      onClick={() => window.open('https://drive.google.com', '_blank')}
                    >
                      <DriveIcon className="h-4 w-4" />
                      View your files
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-colors duration-300"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}