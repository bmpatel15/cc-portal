'use client'

import { useFormContext, type FieldPath } from 'react-hook-form'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { RequestFormValues } from './form-model'

type Name = FieldPath<RequestFormValues>

interface BaseProps {
  name: Name
  label: string
  description?: string
  required?: boolean
  className?: string
}

function Required({ required }: { required?: boolean }) {
  if (!required) return null
  return (
    <span className="text-destructive" aria-hidden>
      {' '}
      *
    </span>
  )
}

/** Clearing on change keeps a corrected answer from still showing its old error. */
function useClearOnChange(name: Name) {
  const form = useFormContext<RequestFormValues>()
  return () => form.clearErrors(name)
}

export function TextField({
  name,
  label,
  description,
  required,
  className,
  type = 'text',
  placeholder,
}: BaseProps & { type?: string; placeholder?: string }) {
  const form = useFormContext<RequestFormValues>()
  const clear = useClearOnChange(name)

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <Required required={required} />
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(event) => {
                clear()
                field.onChange(event)
              }}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function NumberField({
  name,
  label,
  description,
  required,
  className,
  min = 0,
  step,
}: BaseProps & { min?: number; step?: string }) {
  const form = useFormContext<RequestFormValues>()
  const clear = useClearOnChange(name)

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <Required required={required} />
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="number"
              inputMode="decimal"
              min={min}
              step={step}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(event) => {
                clear()
                field.onChange(event)
              }}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function TextAreaField({
  name,
  label,
  description,
  required,
  className,
  placeholder,
  rows = 3,
}: BaseProps & { placeholder?: string; rows?: number }) {
  const form = useFormContext<RequestFormValues>()
  const clear = useClearOnChange(name)

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <Required required={required} />
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              rows={rows}
              placeholder={placeholder}
              className="resize-y"
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(event) => {
                clear()
                field.onChange(event)
              }}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export interface Choice {
  value: string
  label: string
}

export function SelectField({
  name,
  label,
  description,
  required,
  className,
  placeholder = 'Select an option',
  choices,
}: BaseProps & { placeholder?: string; choices: Choice[] }) {
  const form = useFormContext<RequestFormValues>()
  const clear = useClearOnChange(name)

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <Required required={required} />
          </FormLabel>
          <Select
            value={typeof field.value === 'string' ? field.value : ''}
            onValueChange={(value) => {
              clear()
              field.onChange(value)
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Segmented radio cards — larger tap targets than a bare radio list. */
export function RadioField({
  name,
  label,
  description,
  required,
  className,
  choices,
  columns = 2,
}: BaseProps & { choices: Choice[]; columns?: number }) {
  const form = useFormContext<RequestFormValues>()
  const clear = useClearOnChange(name)

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            <Required required={required} />
          </FormLabel>
          <FormControl>
            <RadioGroup
              value={typeof field.value === 'string' ? field.value : ''}
              onValueChange={(value) => {
                clear()
                field.onChange(value)
              }}
              className={cn('grid gap-2', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}
            >
              {choices.map((choice) => {
                const id = `${name}-${choice.value}`
                const selected = field.value === choice.value

                return (
                  <label
                    key={choice.value}
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors',
                      'hover:border-primary/50 hover:bg-accent/50',
                      selected && 'border-primary bg-primary/5 ring-1 ring-primary',
                    )}
                  >
                    <RadioGroupItem value={choice.value} id={id} />
                    <span className="font-medium">{choice.label}</span>
                  </label>
                )
              })}
            </RadioGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
