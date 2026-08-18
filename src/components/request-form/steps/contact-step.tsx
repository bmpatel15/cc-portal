'use client'

import { TextField } from '../fields'

export function ContactStep() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField name="fullName" label="Full name" required placeholder="Akshar Patel" />
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        placeholder="jane@example.org"
        description="Your confirmation and tracking link go here."
      />
      <TextField name="phone" label="Phone" type="tel" placeholder="Optional" />
      <TextField name="department" label="Department" required placeholder="Youth Ministry" />
    </div>
  )
}
