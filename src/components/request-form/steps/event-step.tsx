'use client'

import { TextField } from '../fields'

export function EventStep() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="eventName"
        label="Event name"
        required
        placeholder="Annual Youth Retreat"
        className="sm:col-span-2"
      />
      <TextField
        name="eventDateTime"
        label="Event date and time"
        type="datetime-local"
        required
        description="When the event itself takes place."
        className="sm:col-span-2"
      />
    </div>
  )
}
