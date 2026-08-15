'use client'

import { useWatch } from 'react-hook-form'

import { AUDIO_LOCATIONS } from '@/lib/schemas/request'

import { NumberField, RadioField, SelectField, TextAreaField } from '../fields'
import { REVEAL_CLASS, YES_NO, choicesFrom } from './choices'

export function AudioStep() {
  const requiresMics = useWatch({ name: 'details.requiresMics' })
  const micType = useWatch({ name: 'details.micType' })

  return (
    <div className="space-y-6">
      <SelectField
        name="details.location"
        label="Location"
        required
        placeholder="Select a location"
        choices={choicesFrom(AUDIO_LOCATIONS)}
      />

      <RadioField
        name="details.requiresMics"
        label="Are microphones required?"
        required
        choices={YES_NO}
      />

      {requiresMics === 'yes' ? (
        <div className={REVEAL_CLASS}>
          <RadioField
            name="details.micType"
            label="What type of microphones?"
            required
            choices={choicesFrom(['wireless', 'wired'])}
          />

          {micType === 'wireless' ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                name="details.handheldCount"
                label="How many handheld?"
                required
                min={0}
              />
              <NumberField name="details.headsetCount" label="How many headsets?" required min={0} />
            </div>
          ) : null}

          {micType === 'wired' ? (
            <NumberField
              name="details.wiredCount"
              label="How many wired mics?"
              required
              min={1}
              className="sm:max-w-xs"
            />
          ) : null}
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
    </div>
  )
}
