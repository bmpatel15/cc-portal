import { format } from 'date-fns'

import { GRANULARITY_NOUN } from './periods'
import type { AnalyticsSnapshot } from './service'

/**
 * The downloadable PDF report.
 *
 * Charts are drawn directly with jsPDF's vector primitives rather than
 * captured from the page. Screen-capture was the obvious route and it is the
 * wrong one here: the on-screen charts take every colour from the
 * `--chart-1..5` custom properties, and those do not resolve inside a detached
 * SVG — so a serialised chart arrives unstyled or black. Rasterising through
 * html2canvas works around that but brings its own font and dark-mode
 * problems, and bloats a two-page report into a megabyte of screenshots.
 *
 * Drawing from the data instead sidesteps all three: the output is vector, it
 * is legible at any zoom, it prints on white regardless of the viewer's theme,
 * and it cannot silently disagree with the numbers because it reads the same
 * snapshot the charts do.
 */

/** Fixed print palette. The report always prints on white, whatever the UI theme. */
const INK = { r: 24, g: 24, b: 27 }
const MUTED = { r: 113, g: 113, b: 122 }
const RULE = { r: 228, g: 228, b: 231 }
const SERIES = [
  { r: 37, g: 99, b: 235 },
  { r: 217, g: 119, b: 6 },
  { r: 5, g: 150, b: 105 },
  { r: 220, g: 38, b: 38 },
  { r: 124, g: 58, b: 237 },
]

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 40
const CONTENT_WIDTH = PAGE.width - MARGIN * 2

type Doc = import('jspdf').jsPDF

export async function exportDashboardPdf(snapshot: AnalyticsSnapshot): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const noun = GRANULARITY_NOUN[snapshot.granularity]
  let y = MARGIN

  /* Header ---------------------------------------------------------------- */

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setColor(doc, INK)
  doc.text('Request Analytics', MARGIN, y + 6)

  y += 24
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setColor(doc, MUTED)

  const range = snapshot.range
    ? `${format(new Date(snapshot.range.start), 'd MMM yyyy')} – ${format(
        new Date(snapshot.range.end),
        'd MMM yyyy',
      )}`
    : 'All time'
  doc.text(
    `${range}  ·  grouped by ${noun}  ·  generated ${format(
      new Date(snapshot.generatedAt),
      "d MMM yyyy 'at' h:mm a",
    )}`,
    MARGIN,
    y,
  )

  y += 18
  rule(doc, y)
  y += 20

  /* Headline figures ------------------------------------------------------ */

  const latest = snapshot.volume[snapshot.volume.length - 1]
  y = drawTiles(doc, y, [
    { label: `Requests this ${noun}`, value: String(latest?.current ?? 0) },
    {
      label: 'Median turnaround',
      value:
        snapshot.durations.medianTurnaroundHours === null
          ? '—'
          : `${snapshot.durations.medianTurnaroundHours} h`,
    },
    { label: 'Open backlog', value: String(snapshot.backlog.open) },
    {
      label: 'Completion rate',
      value:
        snapshot.outcomes.completionRate === null
          ? '—'
          : `${snapshot.outcomes.completionRate}%`,
    },
  ])

  y += 24

  /* Volume chart ---------------------------------------------------------- */

  y = heading(doc, y, 'Requests over time', `Submissions per ${noun}.`)

  const volumePoints = snapshot.volume.map((entry) => ({
    label: entry.period.label,
    value: entry.current,
  }))

  if (volumePoints.some((point) => point.value > 0)) {
    y = drawBarChart(doc, y, volumePoints)
  } else {
    y = note(doc, y, 'No requests in this range yet.')
  }

  y += 22

  /* Turnaround chart ------------------------------------------------------ */

  const turnaroundPoints = snapshot.turnaroundByPeriod.filter(
    (entry) => entry.medianHours !== null,
  )

  y = heading(
    doc,
    y,
    'Turnaround',
    'Submission to first completion, in hours. Elapsed time, not hours worked.',
  )

  if (turnaroundPoints.length > 0) {
    y = drawLineChart(
      doc,
      y,
      snapshot.turnaroundByPeriod.map((entry) => ({
        label: entry.label,
        median: entry.medianHours,
        p90: entry.p90Hours,
      })),
    )
  } else {
    y = note(doc, y, 'Nothing has been completed in this range yet.')
  }

  /* Comparison table ------------------------------------------------------ */

  doc.addPage()
  y = MARGIN

  y = heading(
    doc,
    y,
    `${noun.charAt(0).toUpperCase()}${noun.slice(1)}-over-${noun} comparison`,
    'A blank comparison means there was no prior period on record — not that it was zero.',
  )

  y = drawTable(
    doc,
    y,
    ['Period', 'Requests', 'Prior', 'Change'],
    [...snapshot.volume]
      .reverse()
      .map((entry) => [
        entry.period.label,
        String(entry.current),
        entry.prior === null ? '—' : String(entry.prior),
        entry.change === null ? '—' : `${entry.change > 0 ? '+' : ''}${Math.round(entry.change)}%`,
      ]),
    [0.4, 0.2, 0.2, 0.2],
  )

  y += 24

  /* Mix tables ------------------------------------------------------------ */

  y = heading(doc, y, 'Team split', null)
  y = drawTable(
    doc,
    y,
    ['Team', 'Requests', 'Share'],
    snapshot.teamMix.map((slice) => [slice.label, String(slice.count), `${slice.percent}%`]),
    [0.5, 0.25, 0.25],
  )

  y += 24

  y = heading(doc, y, 'Status mix', null)
  y = drawTable(
    doc,
    y,
    ['Status', 'Requests', 'Share'],
    snapshot.statusMix.map((slice) => [slice.label, String(slice.count), `${slice.percent}%`]),
    [0.5, 0.25, 0.25],
  )

  if (snapshot.departments.length > 0) {
    y += 24
    if (y > PAGE.height - 200) {
      doc.addPage()
      y = MARGIN
    }

    y = heading(doc, y, 'Busiest departments', 'Top ten. Department is free text on the form.')
    y = drawTable(
      doc,
      y,
      ['Department', 'Requests', 'Share'],
      snapshot.departments
        .slice(0, 10)
        .map((entry) => [entry.department, String(entry.count), `${entry.percent}%`]),
      [0.5, 0.25, 0.25],
    )
  }

  /* Footnote -------------------------------------------------------------- */

  y += 28
  if (y > PAGE.height - 90) {
    doc.addPage()
    y = MARGIN
  }

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  setColor(doc, MUTED)
  const caveats = doc.splitTextToSize(
    'Turnaround and time-in-stage are elapsed wall-clock time derived from the status history, not hours worked; logged hours are recorded separately and are never added to them. Per-person history is unavailable because assignment changes are not recorded.',
    CONTENT_WIDTH,
  )
  doc.text(caveats, MARGIN, y)

  const filename = `cc-portal-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  doc.save(filename)
}

/* -------------------------------------------------------------------------- */
/* Drawing primitives                                                         */
/* -------------------------------------------------------------------------- */

type Rgb = { r: number; g: number; b: number }

function setColor(doc: Doc, color: Rgb) {
  doc.setTextColor(color.r, color.g, color.b)
}

function rule(doc: Doc, y: number) {
  doc.setDrawColor(RULE.r, RULE.g, RULE.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE.width - MARGIN, y)
}

function heading(doc: Doc, y: number, title: string, subtitle: string | null): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setColor(doc, INK)
  doc.text(title, MARGIN, y)

  let next = y + 14

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(doc, MUTED)
    const lines = doc.splitTextToSize(subtitle, CONTENT_WIDTH)
    doc.text(lines, MARGIN, next)
    next += lines.length * 10
  }

  return next + 6
}

function note(doc: Doc, y: number, message: string): number {
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  setColor(doc, MUTED)
  doc.text(message, MARGIN, y + 10)
  return y + 24
}

function drawTiles(
  doc: Doc,
  y: number,
  tiles: { label: string; value: string }[],
): number {
  const gap = 10
  const width = (CONTENT_WIDTH - gap * (tiles.length - 1)) / tiles.length
  const height = 52

  tiles.forEach((tile, index) => {
    const x = MARGIN + index * (width + gap)

    doc.setDrawColor(RULE.r, RULE.g, RULE.b)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, width, height, 4, 4, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setColor(doc, MUTED)
    doc.text(tile.label.toUpperCase(), x + 8, y + 16)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    setColor(doc, INK)
    doc.text(tile.value, x + 8, y + 38)
  })

  return y + height
}

/** Nice round axis maximum, so gridlines land on readable numbers. */
function axisMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

function drawBarChart(
  doc: Doc,
  y: number,
  points: { label: string; value: number }[],
): number {
  const height = 150
  const axisLeft = MARGIN + 28
  const plotWidth = PAGE.width - MARGIN - axisLeft
  const baseline = y + height

  const max = axisMax(Math.max(...points.map((point) => point.value), 1))

  // Gridlines and y-axis labels.
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (max / 4) * tick
    const lineY = baseline - (height * tick) / 4

    doc.setDrawColor(RULE.r, RULE.g, RULE.b)
    doc.setLineWidth(0.5)
    doc.line(axisLeft, lineY, axisLeft + plotWidth, lineY)

    setColor(doc, MUTED)
    doc.text(String(Math.round(value)), axisLeft - 6, lineY + 2, { align: 'right' })
  }

  const slot = plotWidth / points.length
  const barWidth = Math.min(slot * 0.6, 28)

  points.forEach((point, index) => {
    const barHeight = (point.value / max) * height
    const x = axisLeft + slot * index + (slot - barWidth) / 2

    if (barHeight > 0) {
      doc.setFillColor(SERIES[0].r, SERIES[0].g, SERIES[0].b)
      doc.rect(x, baseline - barHeight, barWidth, barHeight, 'F')
    }

    // Label every bar when there is room, otherwise thin them out so the axis
    // stays readable rather than overprinting itself.
    const stride = Math.ceil((points.length * 34) / plotWidth)
    if (index % stride === 0) {
      doc.setFontSize(6.5)
      setColor(doc, MUTED)
      doc.text(point.label, x + barWidth / 2, baseline + 10, { align: 'center' })
    }
  })

  return baseline + 18
}

function drawLineChart(
  doc: Doc,
  y: number,
  points: { label: string; median: number | null; p90: number | null }[],
): number {
  const height = 150
  const axisLeft = MARGIN + 32
  const plotWidth = PAGE.width - MARGIN - axisLeft
  const baseline = y + height

  const values = points
    .flatMap((point) => [point.median, point.p90])
    .filter((value): value is number => value !== null)

  const max = axisMax(Math.max(...values, 1))

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (max / 4) * tick
    const lineY = baseline - (height * tick) / 4

    doc.setDrawColor(RULE.r, RULE.g, RULE.b)
    doc.setLineWidth(0.5)
    doc.line(axisLeft, lineY, axisLeft + plotWidth, lineY)

    setColor(doc, MUTED)
    doc.text(`${Math.round(value)}h`, axisLeft - 6, lineY + 2, { align: 'right' })
  }

  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const xFor = (index: number) => axisLeft + (points.length > 1 ? step * index : plotWidth / 2)
  const yFor = (value: number) => baseline - (value / max) * height

  const series: { key: 'median' | 'p90'; color: Rgb; dashed: boolean }[] = [
    { key: 'median', color: SERIES[0], dashed: false },
    { key: 'p90', color: SERIES[1], dashed: true },
  ]

  for (const line of series) {
    doc.setDrawColor(line.color.r, line.color.g, line.color.b)
    doc.setLineWidth(1.2)
    if (line.dashed) doc.setLineDashPattern([3, 3], 0)
    else doc.setLineDashPattern([], 0)

    let previous: { x: number; y: number } | null = null

    points.forEach((point, index) => {
      const value = point[line.key]
      if (value === null) return

      const current = { x: xFor(index), y: yFor(value) }
      if (previous) doc.line(previous.x, previous.y, current.x, current.y)

      doc.setFillColor(line.color.r, line.color.g, line.color.b)
      doc.circle(current.x, current.y, 1.8, 'F')

      previous = current
    })
  }

  doc.setLineDashPattern([], 0)

  // Legend.
  doc.setFontSize(7)
  series.forEach((line, index) => {
    const x = axisLeft + index * 70
    doc.setFillColor(line.color.r, line.color.g, line.color.b)
    doc.rect(x, baseline + 16, 8, 3, 'F')
    setColor(doc, MUTED)
    doc.text(line.key === 'median' ? 'Median' : '90th percentile', x + 12, baseline + 20)
  })

  const stride = Math.ceil((points.length * 34) / Math.max(plotWidth, 1))
  points.forEach((point, index) => {
    if (index % stride !== 0) return
    doc.setFontSize(6.5)
    setColor(doc, MUTED)
    doc.text(point.label, xFor(index), baseline + 10, { align: 'center' })
  })

  return baseline + 34
}

function drawTable(
  doc: Doc,
  y: number,
  headers: string[],
  rows: string[][],
  widths: number[],
): number {
  const rowHeight = 16
  let cursor = y

  const columnX = (index: number) =>
    MARGIN + widths.slice(0, index).reduce((total, width) => total + width, 0) * CONTENT_WIDTH

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setColor(doc, MUTED)
  headers.forEach((header, index) => {
    const align = index === 0 ? 'left' : 'right'
    const x = align === 'left' ? columnX(index) : columnX(index) + widths[index] * CONTENT_WIDTH - 4
    doc.text(header, x, cursor, { align })
  })

  cursor += 6
  rule(doc, cursor)
  cursor += 12

  doc.setFont('helvetica', 'normal')
  setColor(doc, INK)

  for (const row of rows) {
    // Spill onto a new page rather than printing over the footer.
    if (cursor > PAGE.height - MARGIN - rowHeight) {
      doc.addPage()
      cursor = MARGIN
    }

    row.forEach((cell, index) => {
      const align = index === 0 ? 'left' : 'right'
      const x =
        align === 'left' ? columnX(index) : columnX(index) + widths[index] * CONTENT_WIDTH - 4
      doc.text(cell, x, cursor, { align })
    })

    cursor += rowHeight
  }

  return cursor
}
