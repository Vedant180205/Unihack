'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
  FileSpreadsheet,
  Layers,
  Filter,
  RefreshCw,
  Hash,
  Database,
  ArrowUpDown,
  Play,
  RotateCcw,
  UploadCloud
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue, useBatch } from '@/components/app-shell'
import { ExportReportModal } from '@/components/export-report-modal'

export type Item = {
  sku: string
  name: string
  category: string
  confidence: number
  invoice: string
  mobile: string
  status: string
  brand?: string
  mfrUrl?: string
}

const seedDataset: Item[] = [
  {
    sku: '7100075678',
    name: '3M Cubitron II Stikit Film Disc 775L (5 in)',
    category: 'Industrial Supplies > Film Discs',
    confidence: 99,
    invoice: '3M 5 IN FILM DISC 250EA/CASE',
    mobile: '3M Cubitron II film disc 775L with precision shaped ceramic grain, 5 in diameter',
    status: 'Approved',
    brand: '3M®',
  },
  {
    sku: 'DCB518ASTS06G',
    name: 'Diablo 1/2 in x 18 in Sanding Belt 6pc Assorted',
    category: 'Industrial Supplies > Sanding Belts',
    confidence: 96,
    invoice: 'DIABLO ½X18 SANDING BELT 6',
    mobile: 'Diablo 1/2 in x 18 in detail file sanding belts, assorted 50/80/120 grit 6-pack',
    status: 'Approved',
    brand: 'Diablo®',
  },
  {
    sku: '4816AF',
    name: 'Hex Bolt M8 x 40mm Zinc Plated Steel (Box of 50)',
    category: 'Fasteners & Hardware',
    confidence: 88,
    invoice: 'HEX BOLT M8X40 ZP 50PK',
    mobile: 'Hexagonal head machine bolt, zinc plated steel, M8 thread x 40mm length 50-pack',
    status: 'Review',
    brand: 'FastenMaster',
  },
  {
    sku: '77BC21',
    name: 'Industrial Pressure Gauge 0–10 bar Bottom Mount',
    category: 'Instrumentation & Process',
    confidence: 97,
    invoice: 'PRESS GAUGE 0-10 BAR BM',
    mobile: 'Industrial pressure gauge with 0 to 10 bar range, 1/4 in NPT bottom connection',
    status: 'Approved',
    brand: 'WIKA',
  },
  {
    sku: '2DE901',
    name: 'Cable Gland M20 IP68 Ingress Protected (Pack of 10)',
    category: 'Electrical & Automation',
    confidence: 84,
    invoice: 'CABLE GLAND M20 IP68 10PK',
    mobile: 'Nylon cable gland with M20 thread, strain relief, and IP68 waterproof rating',
    status: 'Review',
    brand: 'LAPP',
  },
  {
    sku: 'A1C490',
    name: 'Heavy Duty Nitrile Safety Gloves Large (Pair)',
    category: 'Safety & PPE',
    confidence: 92,
    invoice: 'NITRILE GLOVES LARGE 1PR',
    mobile: 'Reusable heavy-duty nitrile work gloves, large size with EN388 Cut Level B',
    status: 'Approved',
    brand: 'Ansell',
  },
  {
    sku: 'WDTS7024RZ',
    name: 'Whirlpool Commercial Dishwasher Control Module',
    category: 'Commercial Appliances',
    confidence: 95,
    invoice: 'WHIRLPOOL CTRL MOD WDTS',
    mobile: 'Whirlpool commercial dishwasher main electronic control unit assembly replacement',
    status: 'Approved',
    brand: 'Whirlpool®',
  },
  {
    sku: 'PDSH4816AF',
    name: 'Frigidaire Heavy Duty Filtration Assembly',
    category: 'Kitchen & Appliance Parts',
    confidence: 94,
    invoice: 'FRIGIDAIRE FILTRATION ASM',
    mobile: 'Frigidaire OEM replacement stainless water filtration assembly with seal',
    status: 'Approved',
    brand: 'Frigidaire®',
  },
  {
    sku: '556012-B',
    name: 'Stainless Steel Flange Ball Valve 2 in 150#',
    category: 'Valves & Actuation',
    confidence: 89,
    invoice: 'SS BALL VALVE 2IN 150#',
    mobile: 'Two-piece full port stainless steel flanged ball valve, 2 in size, class 150 rating',
    status: 'Review',
    brand: 'Apollo',
  },
  {
    sku: '889021-K',
    name: 'Pneumatic Polyurethane Tubing 8mm OD x 50m Blue',
    category: 'Pneumatics & Fluid Power',
    confidence: 96,
    invoice: 'PU TUBE 8MM OD 50M BLU',
    mobile: 'Flexible polyurethane air tubing, 8mm outer diameter, 50m coil in blue finish',
    status: 'Approved',
    brand: 'Festo',
  },
  {
    sku: '445100-M',
    name: 'Tapered Roller Bearing Assembly 45mm Bore',
    category: 'Bearings & Power Transmission',
    confidence: 86,
    invoice: 'TAPER ROLLER BRG 45MM',
    mobile: 'Precision single row tapered roller bearing cone and cup set, 45mm inside bore',
    status: 'Review',
    brand: 'Timken',
  },
  {
    sku: '992014-X',
    name: 'High-Temperature Silicone Sealant 300ml Red',
    category: 'Adhesives & Chemicals',
    confidence: 98,
    invoice: 'HI-TEMP SILICONE 300ML',
    mobile: 'RTV high-temperature silicone gasket maker and sealant, 300ml cartridge in red',
    status: 'Approved',
    brand: 'Loctite®',
  },
]

function Counter({ label, value, type }: { label: string; value: string; type: 'invoice' | 'mobile' }) {
  const count = value.length
  const valid = type === 'invoice' ? count <= 40 : count >= 60 && count <= 80
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
        valid
          ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300'
          : type === 'invoice'
          ? 'border-rose-400/30 bg-rose-400/5 text-rose-300'
          : 'border-amber-400/30 bg-amber-400/5 text-amber-300'
      }`}
    >
      <span>{label}</span>
      <span className="font-mono text-[11px]">
        {count}/{type === 'invoice' ? 40 : '60–80'} CHARS —{' '}
        {valid ? 'VALID' : type === 'invoice' ? 'OVER LIMIT' : 'CHECK RANGE'}
      </span>
    </div>
  )
}

export default function Workbench() {
  const router = useRouter()
  const { decrement } = usePendingQueue()
  const { activeBatch } = useBatch()
  const [items, setItems] = useState<Item[]>(seedDataset)
  const [selected, setSelected] = useState<Item>(seedDataset[0])
  const [query, setQuery] = useState('')
  const [inspector, setInspector] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Row limit control states
  const [rowLimit, setRowLimit] = useState<number | 'all'>(10)
  const [customInput, setCustomInput] = useState<string>('10')

  // Launch pipeline action states
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [launchStage, setLaunchStage] = useState('')

  // Apply row limit first, then search query
  const slicedItems = useMemo(() => {
    if (rowLimit === 'all') return items
    return items.slice(0, rowLimit)
  }, [items, rowLimit])

  const filtered = useMemo(() => {
    if (!query.trim()) return slicedItems
    const q = query.toLowerCase()
    return slicedItems.filter(
      (i) =>
        i.sku.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
    )
  }, [slicedItems, query])

  const handleSetRowLimit = (limit: number | 'all') => {
    setRowLimit(limit)
    if (limit === 'all') {
      setCustomInput('')
      toast.info(`Showing all ${items.length} records in dataset`)
    } else {
      setCustomInput(String(limit))
      toast.info(`Dataset limited to top ${limit} rows`)
    }
  }

  const handleCustomLimitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseInt(customInput, 10)
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(parsed, items.length)
      setRowLimit(clamped)
      setCustomInput(String(clamped))
      toast.success(`Row scope set to ${clamped} items`)
    } else if (customInput.toLowerCase() === 'all') {
      handleSetRowLimit('all')
    } else {
      toast.error(`Please enter a valid number between 1 and ${items.length}`)
    }
  }

  const handleLaunchPipeline = () => {
    setIsLaunching(true)
    setLaunchProgress(20)
    setLaunchStage(`Ingesting sliced batch (${filtered.length} rows)...`)

    setTimeout(() => {
      setLaunchProgress(55)
      setLaunchStage('Validating 252-column schema targets...')
    }, 400)

    setTimeout(() => {
      setLaunchProgress(85)
      setLaunchStage('Spawning autonomous web & PDF agents...')
    }, 850)

    setTimeout(() => {
      setLaunchProgress(100)
      setLaunchStage('Pipeline launched! Opening Overview...')
      toast.success(`Enrichment pipeline launched for ${filtered.length} records! Redirecting to Overview...`)
      setTimeout(() => {
        router.push(`/overview?batch=${encodeURIComponent(activeBatch)}`)
      }, 350)
    }, 1300)
  }

  const approve = () => {
    setItems((all) =>
      all.map((i) => (i.sku === selected.sku ? { ...i, confidence: 96, status: 'Approved' } : i))
    )
    setSelected({ ...selected, confidence: 96, status: 'Approved' })
    decrement()
    toast.success(`SKU #${selected.sku} approved and pushed to catalog`)
  }

  const pendingCount = useMemo(
    () => filtered.filter((i) => i.status === 'Review').length,
    [filtered]
  )
  const approvedCount = useMemo(
    () => filtered.filter((i) => i.status === 'Approved').length,
    [filtered]
  )

  return (
    <AppShell title="Data workbench">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Section Heading with Main Actions */}
        <SectionHeading
          eyebrow="Enrichment workspace"
          title="Review and refine records"
          description="Compare source values with AI-enriched 252-column catalog outputs before publishing."
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setExportModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileSpreadsheet className="size-4" />
                Export delivery report
              </button>
              <button
                onClick={approve}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-md"
              >
                <Check className="size-4" />
                Approve selected
              </button>
            </div>
          }
        />

        {/* Top Feature: Dataset Row Limiter & Scope Control Bar */}
        <div className="panel p-4 bg-gradient-to-r from-card via-card to-cyan-950/20 border-cyan-400/30 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Row Limiter Header & Info */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 shadow-inner">
                <Layers className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider font-mono">
                    Dataset Scope &amp; Row Limiter
                  </span>
                  <span className="rounded-full bg-cyan-400/15 border border-cyan-400/30 px-2 py-0.2 text-[10px] font-mono text-cyan-300">
                    Active: {activeBatch}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Limit row processing scope from the uploaded file to accelerate batch review and testing.
                </p>
              </div>
            </div>

            {/* Right: Presets & Custom Number Input */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground mr-1">Limit to:</span>

              {/* Preset Buttons */}
              {[5, 10, 25, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSetRowLimit(preset)}
                  className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                    rowLimit === preset
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm scale-105'
                      : 'border border-border/80 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {preset}
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleSetRowLimit('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                  rowLimit === 'all'
                    ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm scale-105'
                    : 'border border-border/80 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                All ({items.length})
              </button>

              {/* Custom Rows Input Form */}
              <form onSubmit={handleCustomLimitSubmit} className="flex items-center gap-1 ml-2">
                <label className="relative flex items-center">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Custom #"
                    className="w-20 rounded-md border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-mono text-foreground outline-none focus:border-cyan-400"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20"
                >
                  Set
                </button>
              </form>
            </div>
          </div>

          {/* Telemetry pill row */}
          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Scope: <strong className="font-mono text-cyan-300">{filtered.length}</strong> of{' '}
                <strong className="font-mono text-foreground">{items.length} rows</strong> in view
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <strong className="text-emerald-400">{approvedCount}</strong> approved
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="size-1.5 rounded-full bg-amber-400" />
                <strong className="text-amber-400">{pendingCount}</strong> pending review
              </span>
            </div>

            <span className="font-mono text-[10px] text-muted-foreground/80">
              {rowLimit === 'all' ? 'All dataset records loaded' : `Capped to first ${rowLimit} items`}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-inner">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Search records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, MPN, Brand, or category..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <SlidersHorizontal className="size-4" />
            Filters <ChevronDown className="size-3" />
          </button>
        </div>

        {/* Main Content Area (Table + Diff Inspector) */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4 bg-accent/20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Active Sliced Feed
                </p>
                <p className="mt-1 text-sm font-medium">
                  {filtered.length} matching records (Limit: {rowLimit === 'all' ? 'None' : rowLimit})
                </p>
              </div>
              <span className="rounded-full bg-amber-300/10 border border-amber-300/30 px-2.5 py-1 font-mono text-[10px] text-amber-300">
                {pendingCount} pending review
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-accent/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">SKU / MPN</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">State</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr
                      key={item.sku}
                      className={`cursor-pointer border-t border-border transition-colors hover:bg-accent/30 ${
                        selected.sku === item.sku ? 'bg-cyan-300/5 font-medium' : ''
                      }`}
                      onClick={() => {
                        setSelected(item)
                        setInspector(true)
                      }}
                    >
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-4 font-mono text-xs text-cyan-300 font-medium whitespace-nowrap">
                        #{item.sku}
                      </td>
                      <td className="px-4 py-4 font-medium text-foreground">
                        <div className="line-clamp-1">{item.name}</div>
                        {item.brand && (
                          <span className="text-[10px] font-mono text-muted-foreground">{item.brand}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{item.category}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`font-mono text-xs ${
                            item.confidence >= 90 ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {item.confidence}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.status === 'Approved'
                              ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                              : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ArrowRight className="size-4 text-muted-foreground ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Inspector
            item={selected}
            approve={approve}
            close={() => setInspector(false)}
            compact={inspector}
          />
        </div>

        {/* Bottom Banner: Launch Pipeline Action Card */}
        <div className="panel p-6 sm:p-8 bg-gradient-to-r from-card via-card/95 to-cyan-950/20 border border-cyan-400/30 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-0.5 text-xs font-medium text-cyan-300 font-mono tracking-wider uppercase">
                <Sparkles className="size-3.5 animate-pulse" />
                Batch Execution Scope: {filtered.length} of {items.length} Records Selected
              </div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Ready to Execute Autonomous Enrichment Pipeline?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Launch web crawlers, spec sheet PDF ingestion, neural attribute synthesis, and 252-column normalization for this dataset batch.
              </p>
            </div>

            {/* Launch Action Button */}
            <div className="flex flex-col sm:items-end gap-2">
              <button
                type="button"
                onClick={handleLaunchPipeline}
                disabled={isLaunching || filtered.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold shadow-xl transition-all ${
                  !isLaunching && filtered.length > 0
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              >
                {isLaunching ? (
                  <>
                    <RotateCcw className="size-4 animate-spin" />
                    Launching Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    Launch Pipeline for {filtered.length} Items →
                  </>
                )}
              </button>
              <p className="text-[11px] text-muted-foreground font-mono">
                Redirects to Live Telemetry &amp; Pipeline Overview
              </p>
            </div>
          </div>

          {/* Launch Progress Animation Bar */}
          {isLaunching && (
            <div className="space-y-2 pt-2 border-t border-border/60 animate-in fade-in duration-200">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-300 flex items-center gap-2">
                  <RotateCcw className="size-3 animate-spin" />
                  {launchStage}
                </span>
                <span className="text-foreground font-bold">{launchProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${launchProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <ExportReportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
        />
      </div>
    </AppShell>
  )
}

function Inspector({
  item,
  approve,
  close,
  compact,
}: {
  item: Item
  approve: () => void
  close: () => void
  compact: boolean
}) {
  return (
    <aside
      className={`${
        compact
          ? 'compact-inspector fixed inset-x-3 bottom-3 z-30 max-h-[78vh] overflow-auto shadow-2xl'
          : 'wide-inspector'
      } panel p-5`}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Diff inspector</p>
          <h3 className="mt-1 font-semibold text-foreground">
            #{item.sku} · {item.name}
          </h3>
        </div>
        {compact && (
          <button aria-label="Close inspector" onClick={close} className="rounded p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between rounded-md bg-accent/40 p-3">
        <span className="text-xs text-muted-foreground">AI confidence</span>
        <span
          className={`font-mono text-lg font-bold ${
            item.confidence >= 90 ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          {item.confidence}%
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Invoice description (≤40 chars)
          </p>
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm font-mono text-cyan-300">
            {item.invoice}
          </div>
          <div className="mt-2">
            <Counter label="Invoice desc" value={item.invoice} type="invoice" />
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Mobile description (60–80 chars)
          </p>
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm leading-6 text-foreground">
            {item.mobile}
          </div>
          <div className="mt-2">
            <Counter label="Mobile desc" value={item.mobile} type="mobile" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={approve}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-300 transition-colors shadow-sm"
        >
          <CheckCircle2 className="size-4" />
          Approve item
        </button>
        <button
          className="rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Open AI suggestions"
        >
          <Sparkles className="size-4" />
        </button>
      </div>
    </aside>
  )
}
