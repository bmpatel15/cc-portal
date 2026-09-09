'use client'

import { useWatch } from 'react-hook-form'

import { DEPARTMENTS, DEPARTMENT_OTHER } from '@/lib/schemas/request'

import { SelectField, TextField } from '../fields'
import { REVEAL_CLASS, choicesFrom } from './choices'

export function ContactStep() {
  const department = useWatch({ name: 'department' })

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField name="fullName" label="Full name" required placeholder="Akshar Patel" />
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        placeholder="akshar@example.org"
        description="Your confirmation and tracking link go here."
      />
      <TextField name="phone" label="Phone" type="tel" placeholder="Optional" />
      <SelectField
        name="department"
        label="Department"
        required
        placeholder="Select a department"
        choices={choicesFrom(DEPARTMENTS)}
      />

      {/* Spans the row rather than taking the next grid cell, where it would sit
          under Phone and read as though it belonged to it. */}
      {department === DEPARTMENT_OTHER ? (
        <div className={`${REVEAL_CLASS} sm:col-span-2`}>
          <TextField
            name="departmentOther"
            label="Which department?"
            required
            placeholder="Type your department"
          />
        </div>
      ) : null}
    </div>
  )
}
