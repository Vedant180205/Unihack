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
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Pagination states
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalRows, setTotalRows] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Launch pipeline action states
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [pipelineLimit, setPipelineLimit] = useState<number | 'all'>('all')
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
    const limitToProcess = pipelineLimit === 'all' ? totalRows : Math.min(pipelineLimit, totalRows)
    
    setIsLaunching(true)
    setLaunchProgress(10)
    setLaunchStage(`Starting pipeline for ${limitToProcess} records...`)

    try {
      let inputPath: string | undefined
      try { inputPath = localStorage.getItem('uniclean_input_path') || undefined } catch {}

      const job = await api.runPipeline({ input_path: inputPath, limit: limitToProcess, skip: 0 })
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
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-background/80 text-xs text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[5%] truncate">#</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[16%] truncate">SKU / MPN</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[18%] truncate">Manufacturer</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[25%] truncate">Description</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[12%] truncate">E1 Brand</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[12%] truncate">Unilog Brand</th>
                      <th className="px-3 py-3 font-medium uppercase tracking-wider w-[12%] truncate">DIB Brand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                          Loading CSV data...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
                              
                            }}
                            className={`group cursor-pointer transition-colors hover:bg-accent/40 ${
                              selected === item ? 'bg-accent/60' : ''
                            }`}
                          >
                            <td className="px-3 py-4 font-mono text-[11px] text-muted-foreground truncate">
                              {(page - 1) * limit + i + 1}
                            </td>
                            <td className="px-3 py-4 font-mono text-cyan-300 font-medium truncate">
                              {mpn}
                            </td>
                            <td className="px-3 py-4 font-medium text-foreground truncate">
                              {mfr}
                            </td>
                            <td className="px-3 py-4 text-xs text-muted-foreground truncate">
                              {desc}
                            </td>
                            <td className="px-3 py-4 text-xs text-muted-foreground truncate">
                              {item['E1_Brand'] || '-'}
                            </td>
                            <td className="px-3 py-4 text-xs text-muted-foreground truncate">
                              {item['Unilog_Brand'] || '-'}
                            </td>
                            <td className="px-3 py-4 text-xs text-muted-foreground truncate">
                              {item['DIB_Brand'] || '-'}
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

          {selected ? (
            <Inspector item={selected} approve={approve} />
          ) : (
            <aside className="panel p-5 w-full lg:w-[450px] shrink-0 flex flex-col min-h-[600px] items-center justify-center text-muted-foreground border border-border/50 bg-background/30 backdrop-blur-md">
              <Layers className="size-8 mb-3 opacity-20" />
              <p className="text-sm">Select a row to inspect</p>
            </aside>
          )}
        </div>

        {/* Bottom Banner: Launch Pipeline Action Card */}
        <div className="panel p-6 sm:p-8 bg-gradient-to-r from-card via-card/95 to-cyan-950/20 border border-cyan-400/30 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative z-10">
            <div className="space-y-4 max-w-xl">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-0.5 mb-3 text-xs font-medium text-cyan-300 font-mono tracking-wider uppercase">
                  <Sparkles className="size-3.5 animate-pulse" />
                  Execution Scope
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  Ready to Execute Autonomous Enrichment?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  Launch web crawlers, spec sheet PDF ingestion, neural attribute synthesis, and 252-column normalization for this dataset batch.
                </p>
              </div>

              {/* Prominent Custom Row Selector */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-background/60 border border-cyan-500/30 shadow-inner max-w-md">
                <div className="flex-1">
                  <label className="text-sm font-bold text-cyan-300 block mb-1">Items to Process</label>
                  <p className="text-xs text-muted-foreground">Select or type custom number</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalRows}
                    value={pipelineLimit === 'all' ? totalRows : pipelineLimit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > totalRows) setPipelineLimit('all');
                      else setPipelineLimit(val);
                    }}
                    disabled={isLaunching}
                    className="w-24 rounded-lg border-2 border-cyan-500/50 bg-background px-3 py-2 text-base text-foreground font-mono font-bold focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 text-center"
                  />
                  <button
                    onClick={() => setPipelineLimit('all')}
                    className="text-xs font-semibold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg px-3 py-2.5 transition-colors shadow-sm"
                  >
                    Max ({totalRows})
                  </button>
                </div>
              </div>
            </div>

            {/* Launch Action Button */}
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={handleLaunchPipeline}
                disabled={isLaunching || totalRows === 0}
                className={`inline-flex items-center gap-3 rounded-2xl px-8 py-5 text-base font-bold shadow-xl transition-all w-full justify-center lg:w-auto ${
                  !isLaunching && totalRows > 0
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] ring-4 ring-cyan-400/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              >
                {isLaunching ? (
                  <>
                    <RotateCcw className="size-5 animate-spin" />
                    Launching Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="size-5 fill-current" />
                    Launch for {pipelineLimit === 'all' ? totalRows : Math.min(pipelineLimit, totalRows)} Items
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground font-mono text-center lg:text-right w-full">
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
}: {
  item: Item
  approve: () => void
}) {
  const mpn = item['Mfg_Part_Num'] || item['PART_NUMBER'] || 'N/A'
  
  return (
    <aside className="panel p-5 w-full lg:w-[450px] shrink-0 flex flex-col max-h-[700px] border border-border/50 bg-background/30 backdrop-blur-md">
      <div className="mb-5 flex items-start justify-between shrink-0">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Raw CSV Inspector</p>
          <h3 className="mt-1 font-semibold text-foreground">
            {mpn}
          </h3>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {Object.entries(item).map(([key, value]) => {
          if (!value) return null
          return (
            <div key={key} className="rounded-md border border-border/50 bg-background/50 p-2.5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {key}
              </p>
              <div className="text-xs font-mono text-cyan-200/90 break-words whitespace-pre-wrap">
                {value}
              </div>
            </div>
          )
        })}
      </div>

    </aside>
  )
}










