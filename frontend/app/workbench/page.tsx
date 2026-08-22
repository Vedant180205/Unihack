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
  UploadCloud,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue, useBatch } from '@/components/app-shell'
import { api, type CsvPreviewResponse } from '@/lib/api'
import { ExportReportModal } from '@/components/export-report-modal'

export type Item = Record<string, string>

export default function Workbench() {
  const router = useRouter()
  const { decrement } = usePendingQueue()
  const { activeBatch, setRowCount, rowCount: globalRowCount } = useBatch()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item | null>(null)
  const [query, setQuery] = useState('')
  const [inspector, setInspector] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Pagination states
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Launch pipeline action states
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [launchStage, setLaunchStage] = useState('')

  // Fetch real records from FastAPI on mount & page change
  useEffect(() => {
    const fetchCsv = async () => {
      setIsLoading(true)
      try {
        let inputPath: string | undefined
        try { inputPath = localStorage.getItem('uniclean_input_path') || undefined } catch {}

        const res = await api.getCsvPreview(inputPath, page, limit)
        if (res.success && res.rows.length > 0) {
          setItems(res.rows)
          if (!selected || page !== 1) setSelected(res.rows[0])
          setTotalRows(res.total_rows)
          setTotalPages(res.total_pages)
          setRowCount(res.total_rows)
        }
      } catch (err: any) {
        toast.error(`Failed to load CSV: ${err.message}`)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCsv()
  }, [page, limit])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (i) =>
        (i['Mfg_Part_Num'] || i['PART_NUMBER'] || '').toLowerCase().includes(q) ||
        (i['Part_Desc'] || '').toLowerCase().includes(q) ||
        (i['MANUFACTURER_NAME'] || i['Part_Manuf'] || '').toLowerCase().includes(q)
    )
  }, [items, query])

  const handleLaunchPipeline = async () => {
    setIsLaunching(true)
    setLaunchProgress(10)
    setLaunchStage(`Starting pipeline for all records...`)

    try {
      let inputPath: string | undefined
      try { inputPath = localStorage.getItem('uniclean_input_path') || undefined } catch {}

      const job = await api.runPipeline({ input_path: inputPath, limit: totalRows, skip: 0 })
      setLaunchProgress(20)
      setLaunchStage(`Job ${job.job_id} launched — enriching records...`)

      // Poll job status every 2 seconds
      const poll = setInterval(async () => {
        try {
          const status = await api.getJobStatus(job.job_id)
          const pct = status.total > 0
            ? Math.round(20 + (status.processed / status.total) * 75)
            : 50
          setLaunchProgress(pct)
          setLaunchStage(`Processing ${status.processed}/${status.total} records...`)

          if (status.status === 'done') {
            clearInterval(poll)
            setLaunchProgress(100)
            setLaunchStage('Pipeline complete! Opening Overview...')
            toast.success(`Enrichment complete for ${status.processed} records!`)
            setTimeout(() => router.push('/overview'), 600)
          } else if (status.status === 'failed') {
            clearInterval(poll)
            toast.error(`Pipeline failed: ${status.error}`)
            setIsLaunching(false)
          }
        } catch { /* ignore polling errors */ }
      }, 2000)
    } catch (err: any) {
      toast.error(`Failed to launch pipeline: ${err.message}`)
      setIsLaunching(false)
    }
  }

  const approve = () => {
    toast.success(`Approved raw CSV row`)
    decrement()
  }

  return (
    <AppShell title="Data workbench">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <SectionHeading
          title="Review CSV Data"
          description="Preview raw uploaded CSV rows before sending them through the autonomous pipeline."
          icon={Layers}
        >
          <div className="flex gap-3">
            <button
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-950/20 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/30 transition-colors"
            >
              <FileSpreadsheet className="size-4" />
              Export delivery report
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-4 py-1.5 text-xs font-semibold text-cyan-950 hover:bg-cyan-300 transition-colors shadow-sm">
              <Check className="size-4" />
              Approve selected
            </button>
          </div>
        </SectionHeading>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search MPN, Brand, or Description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background/50 pl-9 pr-4 py-2 text-sm text-foreground focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 relative">
          {/* Main Table Section */}
          <section className="flex-1 space-y-4">
            <div className="panel overflow-hidden border border-border/50 bg-background/30 backdrop-blur-md flex flex-col min-h-[600px]">
              <div className="flex items-center justify-between border-b border-border/50 bg-accent/30 px-4 py-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active CSV Preview</p>
                  <h3 className="text-sm font-semibold text-foreground">
                    {totalRows} records
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value))
                      setPage(1)
                    }}
                    className="rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-background/80 text-xs text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">SKU / MPN</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">Manufacturer</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">E1 Brand</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">Unilog Brand</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wider">DIB Brand</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                          Loading CSV data...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No matching records found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item, i) => {
                        const mpn = item['Mfg_Part_Num'] || item['PART_NUMBER'] || 'N/A'
                        const desc = item['Part_Desc'] || 'N/A'
                        const mfr = item['MANUFACTURER_NAME'] || item['Part_Manuf'] || item['BRAND_NAME'] || 'N/A'
                        
                        return (
                          <tr
                            key={i}
                            onClick={() => {
                              setSelected(item)
                              setInspector(true)
                            }}
                            className={`group cursor-pointer transition-colors hover:bg-accent/40 ${
                              selected === item ? 'bg-accent/60' : ''
                            }`}
                          >
                            <td className="px-4 py-4 font-mono text-[11px] text-muted-foreground">
                              {(page - 1) * limit + i + 1}
                            </td>
                            <td className="px-4 py-4 font-mono text-cyan-300 font-medium">
                              {mpn}
                            </td>
                            <td className="px-4 py-4 font-medium text-foreground">
                              {mfr}
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground truncate max-w-[300px]">
                              {desc}
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground truncate max-w-[150px]">
                              {item['E1_Brand'] || '-'}
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground truncate max-w-[150px]">
                              {item['Unilog_Brand'] || '-'}
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground truncate max-w-[150px]">
                              {item['DIB_Brand'] || '-'}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <ArrowRight className="size-4 text-muted-foreground ml-auto" />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="border-t border-border/50 bg-accent/20 p-3 flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalRows)} of {totalRows} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded hover:bg-accent disabled:opacity-50"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="font-mono">Page {page} of {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded hover:bg-accent disabled:opacity-50"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {selected && (
            <Inspector
              item={selected}
              approve={approve}
              close={() => setInspector(false)}
              compact={inspector}
            />
          )}
        </div>

        {/* Bottom Banner: Launch Pipeline Action Card */}
        <div className="panel p-6 sm:p-8 bg-gradient-to-r from-card via-card/95 to-cyan-950/20 border border-cyan-400/30 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-0.5 text-xs font-medium text-cyan-300 font-mono tracking-wider uppercase">
                <Sparkles className="size-3.5 animate-pulse" />
                Batch Execution Scope: {totalRows} Records
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
                disabled={isLaunching || totalRows === 0}
                className={`inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold shadow-xl transition-all ${
                  !isLaunching && totalRows > 0
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
                    Launch Pipeline for {totalRows} Items &rarr;
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
  const mpn = item['Mfg_Part_Num'] || item['PART_NUMBER'] || 'N/A'
  
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Raw CSV Inspector</p>
          <h3 className="mt-1 font-semibold text-foreground">
            {mpn}
          </h3>
        </div>
        {compact && (
          <button aria-label="Close inspector" onClick={close} className="rounded p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {Object.entries(item).map(([key, value]) => {
          if (!value) return null
          return (
            <div key={key} className="rounded-md border border-border/50 bg-background/30 p-2.5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {key}
              </p>
              <div className="text-xs font-mono text-cyan-200/90 break-words">
                {value}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={approve}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-300 transition-colors shadow-sm"
        >
          <CheckCircle2 className="size-4" />
          Approve Raw Input
        </button>
      </div>
    </aside>
  )
}


