'use client'

import { useWatch } from 'react-hook-form'

import {
  LOCATIONS,
  MAX_HANDHELD_MICS,
  MAX_HEADSET_MICS,
  MAX_WIRED_MICS,
} from '@/lib/schemas/request'

import { NumberField, RadioField, SelectField, TextAreaField } from '../fields'
import { FileUpload } from '../file-upload'
import { REVEAL_CLASS, YES_NO, choicesFrom } from './choices'

export function AudioStep() {
  const requiresMics = useWatch({ name: 'details.requiresMics' })

  return (
    <div className="space-y-6">
      <SelectField
        name="details.location"
        label="Location"
        required
        placeholder="Select a location"
        choices={choicesFrom(LOCATIONS)}
      />

      <RadioField
        name="details.requiresMics"
        label="Are microphones required?"
        required
        choices={YES_NO}
      />

      {requiresMics === 'yes' ? (
        <div className={REVEAL_CLASS}>
          {/* The kinds are asked for side by side rather than behind a
              wireless-or-wired choice: an event often needs some of each, and
              picking one type used to hide the other. */}
          <div className="space-y-1">
            <p className="text-sm font-medium">How many of each are needed?</p>
            <p className="text-sm text-muted-foreground">
              Leave a kind blank if none are needed. The counts stop at what the team owns.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField
              name="details.handheldCount"
              label="Wireless handheld"
              min={0}
              max={MAX_HANDHELD_MICS}
              description={`Up to ${MAX_HANDHELD_MICS}`}
            />
            <NumberField
              name="details.headsetCount"
              label="Wireless headset"
              min={0}
              max={MAX_HEADSET_MICS}
              description={`Up to ${MAX_HEADSET_MICS}`}
            />
            <NumberField
              name="details.wiredCount"
              label="Wired"
              min={0}
              max={MAX_WIRED_MICS}
              description={`Up to ${MAX_WIRED_MICS}`}
            />
          </div>
        </div>
      ) : null}

      <RadioField
        name="details.requiresSpeakers"
        label="Are speakers required?"
        required
        choices={YES_NO}
      />

      <TextAreaField
        name="details.audioDescription"
        label="Additional notes"
        placeholder="Anything else the audio team should know"
      />

      <FileUpload
        label="Reference files"
        description="Optional — stage plots, run sheets, or a rough sketch of the setup."
      />
    </div>
  )
}
