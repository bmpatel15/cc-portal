'use client'

import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { TEAM_LABELS } from '@/lib/schemas/labels'
import { TEAMS } from '@/lib/schemas/request'
import type {
  AnalyticsSnapshot,
  TeamPeriodPoint,
  TurnaroundPoint,
} from '@/lib/analytics/service'
import type { PeriodComparison } from '@/lib/analytics/periods'

/**
 * The charts, kept apart from the dashboard shell so the shell stays about
 * layout and state and these stay about drawing.
 *
 * Every chart here is wrapped in `ChartContainer`, which resolves the
 * `--chart-1..5` custom properties already defined in globals.css. That is what
 * makes them follow the theme without a second palette — and it is also why the
 * PDF export has to inline the computed colours before serialising, since a
 * detached SVG has no access to those variables.
 */

/**
 * Shown wherever there is not yet enough data to draw something truthful.
 *
 * A single bar under a "requests over time" heading looks like a collapse
 * rather than a young portal, so below the threshold we say what is actually
 * going on instead of drawing it.
 */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
      <LineChartIcon className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Not enough history yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

const volumeConfig = {
  current: { label: 'Requests', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

export function VolumeChart({ data }: { data: PeriodComparison[] }) {
  const points = data.map((entry) => ({
    label: entry.period.label,
    current: entry.current,
  }))

  return (
    <ChartContainer config={volumeConfig} className="h-[260px] w-full">
      <BarChart data={points} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const teamConfig = {
  audio: { label: TEAM_LABELS.audio, color: 'hsl(var(--chart-1))' },
  'photo-video': { label: TEAM_LABELS['photo-video'], color: 'hsl(var(--chart-2))' },
  'content-creation': {
    label: TEAM_LABELS['content-creation'],
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

export function TeamMixChart({ data }: { data: TeamPeriodPoint[] }) {
  return (
    <ChartContainer config={teamConfig} className="h-[260px] w-full">
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {TEAMS.map((team) => (
          <Bar key={team} dataKey={team} stackId="team" fill={`var(--color-${team})`} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

const turnaroundConfig = {
  medianHours: { label: 'Median', color: 'hsl(var(--chart-1))' },
  p90Hours: { label: '90th percentile', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig

/**
 * Median and p90 together, never a mean.
 *
 * Turnaround is right-skewed — a handful of requests that sat over a holiday
 * drag an average somewhere no real request lives. The median says what a
 * typical request looks like; p90 says how bad the tail gets. The gap between
 * the two lines is the interesting part.
 */
export function TurnaroundChart({ data }: { data: TurnaroundPoint[] }) {
  return (
    <ChartContainer config={turnaroundConfig} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(value: number) => `${value}h`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="medianHours"
          stroke="var(--color-medianHours)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="p90Hours"
          stroke="var(--color-p90Hours)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  )
}

const STATUS_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function StatusMixChart({ data }: { data: AnalyticsSnapshot['statusMix'] }) {
  const points = data.filter((slice) => slice.count > 0)

  const config = React.useMemo(
    () =>
      Object.fromEntries(
        points.map((slice, index) => [
          slice.key,
          { label: slice.label, color: STATUS_COLORS[index % STATUS_COLORS.length] },
        ]),
      ) satisfies ChartConfig,
    [points],
  )

  if (points.length === 0) {
    return <ChartEmpty message="No requests in this period yet." />
  }

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <Pie data={points} dataKey="count" nameKey="label" innerRadius={55} outerRadius={90}>
          {points.map((slice, index) => (
            <Cell key={slice.key} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
      </PieChart>
    </ChartContainer>
  )
}

const departmentConfig = {
  count: { label: 'Requests', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

export function DepartmentChart({
  data,
}: {
  data: AnalyticsSnapshot['departments']
}) {
  // Top ten keeps the axis readable; the rest are still in the CSV.
  const points = data.slice(0, 10)

  if (points.length === 0) {
    return <ChartEmpty message="No requests in this period yet." />
  }

  return (
    <ChartContainer config={departmentConfig} className="h-[280px] w-full">
      <BarChart data={points} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="department"
          tickLine={false}
          axisLine={false}
          width={120}
          tickMargin={4}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

const timeInStatusConfig = {
  totalHours: { label: 'Total hours', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

export function TimeInStatusChart({
  data,
}: {
  data: { label: string; totalHours: number }[]
}) {
  const populated = data.some((entry) => entry.totalHours > 0)

  if (!populated) {
    return <ChartEmpty message="No status changes recorded in this period yet." />
  }

  return (
    <ChartContainer config={timeInStatusConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => `${value}h`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="totalHours" fill="var(--color-totalHours)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
