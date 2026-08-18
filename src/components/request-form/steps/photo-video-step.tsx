'use client'

import { useWatch } from 'react-hook-form'

import { PHOTO_PURPOSES, VIDEO_FORMATS, VIDEO_TYPES } from '@/lib/schemas/request'

import { NumberField, RadioField, SelectField, TextAreaField, TextField } from '../fields'
import { FileUpload } from '../file-upload'
import { REVEAL_CLASS, YES_NO, choicesFrom } from './choices'

export function PhotoVideoStep() {
  const requiresPhoto = useWatch({ name: 'details.requiresPhoto' })
  const requiresVideo = useWatch({ name: 'details.requiresVideo' })

  return (
    <div className="space-y-6">
      <RadioField
        name="details.requiresPhoto"
        label="Is photography needed?"
        required
        choices={YES_NO}
      />

      {requiresPhoto === 'yes' ? (
        <div className={REVEAL_CLASS}>
          <NumberField
            name="details.photographerCount"
            label="How many photographers will be required?"
            required
            min={1}
            className="sm:max-w-xs"
          />
          <SelectField
            name="details.photoPurpose"
            label="What is the purpose of the photography?"
            required
            placeholder="Select purpose"
            choices={choicesFrom(PHOTO_PURPOSES)}
          />
          <TextAreaField
            name="details.photoLocation"
            label="What is the location and setting for the photography?"
            required
          />
          <TextAreaField
            name="details.photoDeliverables"
            label="Are there any specific deliverables required?"
            required
            placeholder="e.g. number of edited photos"
          />
        </div>
      ) : null}

      <RadioField
        name="details.requiresVideo"
        label="Is videography needed?"
        required
        choices={YES_NO}
      />

      {requiresVideo === 'yes' ? (
        <div className={REVEAL_CLASS}>
          <NumberField
            name="details.videographerCount"
            label="How many videographers will be required?"
            required
            min={1}
            className="sm:max-w-xs"
          />
          <SelectField
            name="details.videoType"
            label="What type of video is being requested?"
            required
            placeholder="Select video type"
            choices={choicesFrom(VIDEO_TYPES)}
          />
          <TextAreaField
            name="details.videoAudience"
            label="What is the intended use and audience for the video?"
            required
          />
          <TextAreaField
            name="details.videoLocation"
            label="Where will the videography take place?"
            required
          />
          <SelectField
            name="details.videoFormat"
            label="Are you looking for live video, recorded video, or both?"
            required
            placeholder="Select video format"
            choices={choicesFrom(VIDEO_FORMATS)}
          />
          <TextField
            name="details.videoDeadline"
            label="What is the deadline for the completed video?"
            type="date"
            required
            className="sm:max-w-xs"
          />
        </div>
      ) : null}

      <FileUpload
        label="Reference files"
        description="Optional — shot lists, references, or a rough sketch of what you have in mind."
      />
    </div>
  )
}
