'use client'

import * as React from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import type { Team } from '@/lib/schemas/request'

import {
  STEPS,
  emptyFormValues,
  stepIndex,
  validateValues,
  type RequestFormValues,
  type StepId,
} from './form-model'
import { Stepper } from './stepper'
import { ContactStep } from './steps/contact-step'
import { EventStep } from './steps/event-step'
import { TeamStep } from './steps/team-step'
import { AudioStep } from './steps/audio-step'
import { PhotoVideoStep } from './steps/photo-video-step'
import { ContentCreationStep } from './steps/content-creation-step'
import { ReviewStep } from './steps/review-step'
import { SuccessPanel } from './success-panel'

interface SubmitResult {
  trackingUrl: string
  reference: string
  email: string
}

const DETAIL_STEPS: Record<Team, React.ComponentType> = {
  audio: AudioStep,
  'photo-video': PhotoVideoStep,
  'content-creation': ContentCreationStep,
}

export function RequestWizard() {
  const form = useForm<RequestFormValues>({
    defaultValues: emptyFormValues,
    mode: 'onSubmit',
  })

  const [current, setCurrent] = React.useState(0)
  const [furthest, setFurthest] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<SubmitResult | null>(null)

  const step = STEPS[current]
  const team = form.watch('team')
  const isLast = current === STEPS.length - 1

  /**
   * Validate the whole request, then surface only the issues this step owns.
   * One schema pass drives every gate, so a step can never let through
   * something the API would reject.
   */
  function applyIssues(stepFilter?: (path: string) => boolean): boolean {
    const values = form.getValues()
    const { ok, issues } = validateValues(values)

    form.clearErrors()

    // `partialRequestSchema` leaves team optional; the team step requires it.
    if (stepFilter?.('team') && !values.team) {
      form.setError('team', { message: 'Select a team to continue' })
      return false
    }

    if (ok) return true

    const relevant = stepFilter ? issues.filter((issue) => stepFilter(issue.path)) : issues

    for (const issue of relevant) {
      form.setError(issue.path as FieldPath<RequestFormValues>, { message: issue.message })
    }

    return relevant.length === 0
  }

  function goTo(index: number) {
    setCurrent(index)
    setFurthest((previous) => Math.max(previous, index))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleNext() {
    if (!applyIssues(step.owns)) {
      toast.error('Please fix the highlighted answers')
      return
    }
    goTo(Math.min(current + 1, STEPS.length - 1))
  }

  function handleBack() {
    goTo(Math.max(current - 1, 0))
  }

  async function handleSubmit() {
    const values = form.getValues()
    const { ok, data, issues } = validateValues(values)

    if (!ok || !data) {
      // Send the user back to the first step that owns a problem.
      const firstBrokenStep = STEPS.find((candidate) =>
        issues.some((issue) => candidate.id !== 'review' && candidate.owns(issue.path)),
      )

      applyIssues()
      toast.error('Some answers still need attention')
      if (firstBrokenStep) goTo(stepIndex(firstBrokenStep.id))
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const body = await response.json()

      if (!response.ok || !body.success) {
        if (Array.isArray(body.errors)) {
          for (const issue of body.errors) {
            form.setError(issue.path as FieldPath<RequestFormValues>, { message: issue.message })
          }
        }
        throw new Error(body.message ?? 'Submission failed')
      }

      setResult({
        trackingUrl: body.trackingUrl,
        reference: String(body.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
        email: data.email,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    form.reset(emptyFormValues)
    setResult(null)
    setCurrent(0)
    setFurthest(0)
  }

  if (result) {
    return (
      <SuccessPanel
        trackingUrl={result.trackingUrl}
        reference={result.reference}
        email={result.email}
        onReset={reset}
      />
    )
  }

  const DetailStep = team ? DETAIL_STEPS[team as Team] : null

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (isLast) void handleSubmit()
          else handleNext()
        }}
      >
        <Card className="border-none shadow-lg">
          <CardContent className="space-y-6 p-5 sm:p-8">
            <Stepper
              current={current}
              furthest={furthest}
              onSelect={(id: StepId) => goTo(stepIndex(id))}
            />

            <Separator />

            <header className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </header>

            <div className="min-h-[18rem]">
              {step.id === 'contact' ? <ContactStep /> : null}
              {step.id === 'event' ? <EventStep /> : null}
              {step.id === 'team' ? <TeamStep /> : null}
              {step.id === 'details' ? (
                DetailStep ? (
                  <DetailStep />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Choose a team first — go back a step to pick one.
                  </p>
                )
              ) : null}
              {step.id === 'review' ? (
                <ReviewStep onEditStep={(id) => goTo(stepIndex(id))} />
              ) : null}
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={current === 0 || submitting}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <span className="text-xs text-muted-foreground">
                Step {current + 1} of {STEPS.length}
              </span>

              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : isLast ? (
                  <>
                    <Send className="h-4 w-4" />
                    Submit request
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
