'use client'

import { useWatch } from 'react-hook-form'

import {
  LOCATIONS_WITH_OTHER,
  MAX_PHOTOGRAPHERS,
  MAX_VIDEOGRAPHERS,
  OTHER_OPTION,
  PHOTO_PURPOSES,
  VIDEO_FORMATS,
  VIDEO_TYPES,
} from '@/lib/schemas/request'

import { SelectField, TextAreaField, TextField, RadioField } from '../fields'
import { FileUpload } from '../file-upload'
import { REVEAL_CLASS, YES_NO, choicesFrom, countChoices } from './choices'

export function PhotoVideoStep() {
  const requiresPhoto = useWatch({ name: 'details.requiresPhoto' })
  const requiresVideo = useWatch({ name: 'details.requiresVideo' })
  const photoPurpose = useWatch({ name: 'details.photoPurpose' })
  const photoLocation = useWatch({ name: 'details.photoLocation' })
  const videoType = useWatch({ name: 'details.videoType' })
  const videoLocation = useWatch({ name: 'details.videoLocation' })

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
          {/* Paired into rows: the short answers used to sit in a single column
              of full-width boxes, which made a five-question branch scroll. */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* A dropdown rather than a number box -- the roster is the roster,
                and a request for twenty photographers is not one anybody can fill. */}
            <SelectField
              name="details.photographerCount"
              label="How many photographers?"
              required
              placeholder="Select a number"
              choices={countChoices(MAX_PHOTOGRAPHERS)}
            />
            <SelectField
              name="details.photoPurpose"
              label="What is the photography for?"
              required
              placeholder="Select purpose"
              choices={choicesFrom(PHOTO_PURPOSES)}
            />
            {/* Its own row: a box tucked into the next cell would sit under the
                count and read as belonging to it. */}
            {photoPurpose === OTHER_OPTION ? (
              <TextField
                name="details.photoPurposeOther"
                label="What is it for?"
                placeholder="Optional — describe the purpose"
                className="sm:col-span-2"
              />
            ) : null}

            <SelectField
              name="details.photoLocation"
              label="Where does it take place?"
              required
              placeholder="Select a location"
              choices={choicesFrom(LOCATIONS_WITH_OTHER)}
            />
            {photoLocation === OTHER_OPTION ? (
              <TextField
                name="details.photoLocationOther"
                label="Which location?"
                required
                placeholder="Type the location"
              />
            ) : null}
          </div>

          <TextAreaField
            name="details.photoLocationNotes"
            label="Anything about the setting?"
            placeholder="Optional — e.g. on stage, behind the podium"
            rows={2}
          />

          <TextAreaField
            name="details.photoDeliverables"
            label="Are there any specific deliverables?"
            placeholder="Optional — e.g. number of edited photos"
            rows={2}
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
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              name="details.videographerCount"
              label="How many videographers?"
              required
              placeholder="Select a number"
              choices={countChoices(MAX_VIDEOGRAPHERS)}
            />
            <SelectField
              name="details.videoType"
              label="What type of video?"
              required
              placeholder="Select video type"
              choices={choicesFrom(VIDEO_TYPES)}
            />
            {videoType === OTHER_OPTION ? (
              <TextField
                name="details.videoTypeOther"
                label="Which type?"
                placeholder="Optional — describe the video"
                className="sm:col-span-2"
              />
            ) : null}

            <SelectField
              name="details.videoLocation"
              label="Where does it take place?"
              required
              placeholder="Select a location"
              choices={choicesFrom(LOCATIONS_WITH_OTHER)}
            />
            {videoLocation === OTHER_OPTION ? (
              <TextField
                name="details.videoLocationOther"
                label="Which location?"
                required
                placeholder="Type the location"
              />
            ) : null}

            <SelectField
              name="details.videoFormat"
              label="Live, recorded, or both?"
              required
              placeholder="Select video format"
              choices={choicesFrom(VIDEO_FORMATS)}
            />
            <TextField
              name="details.videoDeadline"
              label="When is the finished video due?"
              type="date"
              required
              description="On or after the event date."
            />
          </div>

          <TextAreaField
            name="details.videoLocationNotes"
            label="Anything about the setting?"
            placeholder="Optional — e.g. two angles, interviews in the side room"
            rows={2}
          />

          <TextAreaField
            name="details.videoAudience"
            label="Who is the video for?"
            placeholder="Optional — the intended use and audience"
            rows={2}
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
