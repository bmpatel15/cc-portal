'use client'

import { useEffect, useState } from 'react'

import { TextField } from '../fields'
import { todayLocalDate } from '../form-model'

export function EventStep() {
  // Set after mount, not during render: this page is prerendered, so a date
  // computed on the server would be the build's date, not the requestor's.
  const [today, setToday] = useState('')
  useEffect(() => setToday(todayLocalDate()), [])

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        name="eventName"
        label="Event name"
        required
        placeholder="Annual Youth Retreat"
        className="sm:col-span-2"
      />
      {/* The day only. A requestor often books before the schedule is settled,
          and a required time box left them guessing -- the team asks for the
          call time when it matters. */}
      <TextField
        name="eventDate"
        label="Event date"
        type="date"
        required
        min={today || undefined}
        description="The day the event takes place."
      />
    </div>
  )
}
