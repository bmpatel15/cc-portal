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
      {/* The day only. A requestor often books before the schedule is settled,
          and a required time box left them guessing -- the team asks for the
          call time when it matters. */}
      <TextField
        name="eventDate"
        label="Event date"
        type="date"
        required
        description="The day the event takes place."
      />
    </div>
  )
}
