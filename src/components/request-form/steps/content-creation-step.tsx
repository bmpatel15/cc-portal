'use client'

import { useWatch } from 'react-hook-form'

import { CONTENT_TYPES, PRINT_TYPES } from '@/lib/schemas/request'

import { NumberField, RadioField, SelectField, TextAreaField, TextField } from '../fields'
import { FileUpload } from '../file-upload'
import { REVEAL_CLASS, YES_NO, choicesFrom } from './choices'

export function ContentCreationStep() {
  const contentType = useWatch({ name: 'details.contentType' })
  const printType = useWatch({ name: 'details.printType' })

  return (
    <div className="space-y-6">
      <SelectField
        name="details.contentType"
        label="What type of content?"
        required
        placeholder="Select content type"
        choices={choicesFrom(CONTENT_TYPES)}
      />

      {contentType === 'graphics' ? (
        <div className={REVEAL_CLASS}>
          <TextAreaField
            name="details.description"
            label="Description of what is needed"
            required
            rows={4}
          />
          <RadioField
            name="details.mobileVersion"
            label="Will there be a need for a mobile version?"
            required
            choices={YES_NO}
          />
          <RadioField
            name="details.horizontalVersion"
            label="Will there be a need for a horizontal version?"
            required
            choices={YES_NO}
          />
        </div>
      ) : null}

      {contentType === 'video' ? (
        <div className={REVEAL_CLASS}>
          <TextAreaField
            name="details.videoBrief"
            label="Describe the video that is needed"
            required
            rows={4}
            placeholder="Purpose, length, audience, and anything that must be included"
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

      {contentType === 'printing' ? (
        <div className={REVEAL_CLASS}>
          <SelectField
            name="details.printType"
            label="What type of print?"
            required
            placeholder="Select print type"
            choices={choicesFrom(PRINT_TYPES)}
          />

          {printType === 'other' ? (
            <TextAreaField name="details.printDescription" label="Description" required />
          ) : null}

          <div className="grid gap-5 sm:grid-cols-3">
            <NumberField name="details.quantity" label="Quantity" required min={1} />
            <NumberField name="details.width" label="Width (inches)" required min={0} step="0.1" />
            <NumberField name="details.height" label="Height (inches)" required min={0} step="0.1" />
          </div>
        </div>
      ) : null}

      {/* One instance for the whole step: FileUpload binds the shared `files`
          field, so a second copy inside the printing branch would render a
          duplicate list writing to the same array. */}
      <FileUpload
        label={contentType === 'printing' ? 'Upload artwork' : 'Reference files'}
        required={contentType === 'printing'}
        description={
          contentType === 'printing'
            ? 'The team needs the artwork to produce your print job.'
            : 'Optional — rough drawings, sketches, or examples of what you have in mind.'
        }
      />
    </div>
  )
}
