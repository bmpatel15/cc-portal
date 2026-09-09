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
      {/* Split rather than one datetime-local: that control is fiddly to type
          into and each browser renders it differently. Two native pickers sit
          side by side on desktop and stack on a phone. */}
      <TextField
        name="eventDate"
        label="Event date"
        type="date"
        required
        description="The day the event takes place."
      />
      <TextField
        name="eventTime"
        label="Event time"
        type="time"
        required
        description="When it begins."
      />
    </div>
  )
}
