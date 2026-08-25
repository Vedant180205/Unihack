'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue } from '@/components/app-shell'
import {
  fetchRecords,
  runSingleSKU,
  uploadBatchCSV,
  updateCatalogRecord,
  fetchPipelineStatus,
  getExportUrl,
  CatalogItem,
  PipelineStatus
} from '@/lib/api'

const defaultSeed: CatalogItem[] = [
  {
    sku: '4816AF',
    name: 'Hex Bolt M8 x 40mm Zinc',
    category: 'Fasteners',
    confidence: 88,
    invoice: 'HEX BOLT M8X40 ZP',
    mobile: 'Hexagonal head machine bolt, zinc plated steel, M8 thread x 40mm length',
    brand: 'Fastenal',
    mfr_url: 'https://www.fastenal.com',
    status: 'Review',
    attributes: [
      { label: 'Thread Size', value: 'M8', uom: 'mm' },
      { label: 'Length', value: '40', uom: 'mm' }
    ]
  },
  {
    sku: '77BC21',
    name: 'Pressure Gauge 0–10 bar',
    category: 'Instrumentation',
    confidence: 97,
    invoice: 'PRESS GAUGE 0-10 BAR',
    mobile: 'Industrial pressure gauge with 0 to 10 bar range and bottom connection',
    brand: 'WIKA',
    mfr_url: 'https://www.wika.com',
    status: 'Approved',
    attributes: [
      { label: 'Pressure Range', value: '0-10', uom: 'bar' }
    ]
  },
  {
    sku: '2DE901',
    name: 'Cable Gland M20 IP68',
    category: 'Electrical',
    confidence: 84,
    invoice: 'CABLE GLAND M20 IP68',
    mobile: 'Nylon cable gland with M20 thread and IP68 ingress protection rating',
    brand: 'Lapp Group',
    mfr_url: 'https://www.lappgroup.com',
    status: 'Review',
    attributes: [
      { label: 'IP Rating', value: 'IP68' }
    ]
  },
  {
    sku: 'A1C490',
    name: 'Nitrile Safety Gloves L',
    category: 'Safety',
    confidence: 92,
    invoice: 'NITRILE GLOVES LARGE',
    mobile: 'Reusable nitrile coated work gloves, large size, cut resistance level B',
    brand: 'Ansell',
    mfr_url: 'https://www.ansell.com',
    status: 'Approved',
    attributes: [
      { label: 'Size', value: 'Large' }
    ]
  }
]

function Counter({ label, value, type }: { label: string; value: string; type: 'invoice' | 'mobile' }) {
  const count = (value || '').length
  const valid = type === 'invoice' ? count <= 40 && count > 0 : count >= 60 && count <= 80
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
      <span className="font-mono">
        {count}/{type === 'invoice' ? 40 : '60–80'} CHARS — {valid ? 'VALID' : type === 'invoice' ? 'OVER LIMIT' : 'CHECK RANGE'}
      </span>
    </div>
  )
}

export default function Workbench() {
  const { decrement } = usePendingQueue()
  const [items, setItems] = useState<CatalogItem[]>(defaultSeed)
  const [selected, setSelected] = useState<CatalogItem>(defaultSeed[0])
  const [query, setQuery] = useState('')
  const [inspector, setInspector] = useState(false)
  const [loading, setLoading] = useState(false)

  // Single SKU Runner State
  const [runnerOpen, setRunnerOpen] = useState(false)
  const [runSku, setRunSku] = useState('')
  const [runDesc, setRunDesc] = useState('')
  const [runBrand, setRunBrand] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // Batch Runner State
  const [batchStatus, setBatchStatus] = useState<PipelineStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load records from backend API
  const loadData = async () => {
    setLoading(true)
    try {
      const records = await fetchRecords()
      if (records && records.length > 0) {
        setItems(records)
        setSelected(records[0])
      }
    } catch (e) {
      console.warn('Backend offline or loading failed, using fallback data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Poll for batch status if running
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (batchStatus?.is_running) {
      interval = setInterval(async () => {
        const st = await fetchPipelineStatus()
        setBatchStatus(st)
        if (!st.is_running) {
          toast.success(`Batch complete! Processed ${st.processed_rows} records.`)
          loadData()
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [batchStatus?.is_running])

  const filtered = useMemo(
    () =>
      items.filter((i) =>
        `${i.sku} ${i.name} ${i.category} ${i.brand || ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [items, query]
  )

  const approve = async (itemToApprove = selected) => {
    try {
      await updateCatalogRecord(itemToApprove.sku, { status: 'Approved', confidence: 96 })
      setItems((all) =>
        all.map((i) => (i.sku === itemToApprove.sku ? { ...i, confidence: 96, status: 'Approved' } : i))
      )
      setSelected({ ...itemToApprove, confidence: 96, status: 'Approved' })
      decrement()
      toast.success(`SKU #${itemToApprove.sku} approved and published to catalog`)
    } catch (err: any) {
      toast.error(`Approval failed: ${err.message}`)
    }
  }

  const handleExecuteSingleSKU = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!runSku.trim() || !runDesc.trim()) {
      toast.error('Please provide both a Part Number and a Description')
      return
    }

    setIsRunning(true)
    const toastId = toast.loading(`Searching SearXNG & scraping specs for #${runSku}...`)

    try {
      const res = await runSingleSKU(runSku.trim(), runDesc.trim(), runBrand.trim())
      const enriched = res.data
      setItems((prev) => [enriched, ...prev.filter((i) => i.sku !== enriched.sku)])
      setSelected(enriched)
      setInspector(true)
      setRunnerOpen(false)
      setRunSku('')
      setRunDesc('')
      setRunBrand('')
      toast.success(`Successfully researched and enriched SKU #${enriched.sku}!`, { id: toastId })
    } catch (err: any) {
      toast.error(`Enrichment failed: ${err.message}`, { id: toastId })
    } finally {
      setIsRunning(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading(`Uploading ${file.name} to AI pipeline...`)
    try {
      const res = await uploadBatchCSV(file)
      toast.success(res.message, { id: toastId })
      const st = await fetchPipelineStatus()
      setBatchStatus(st)
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`, { id: toastId })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const pendingCount = items.filter((i) => i.status !== 'Approved').length

  return (
    <AppShell title="Data workbench">
      <div className="mx-auto max-w-[1500px]">
        <SectionHeading
          eyebrow="Enrichment workspace"
          title="Review and refine records"
          description="Execute the SearXNG + Crawl4AI + LLM researcher pipeline on supplier records, verify character bounds, and audit attributes."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRunnerOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-sm hover:bg-cyan-300"
              >
                <Sparkles className="size-4" />
                Enrich Single SKU
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                <Upload className="size-4" />
                Upload Batch CSV
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={() => approve(selected)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="size-4" />
                Approve selected
              </button>
              <a
                href={getExportUrl('excel')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-400/20"
                title="Export output.csv as formatted Excel (.xlsx)"
              >
                <Download className="size-4" />
                Export Delivery (.xlsx)
              </a>

            </div>
          }
        />

        {/* Batch Status Banner if running */}
        {batchStatus?.is_running && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-cyan-300" />
              <div>
                <p className="text-sm font-medium text-cyan-100">
                  Processing Batch: {batchStatus.processed_rows} of {batchStatus.total_rows} items
                </p>
                <p className="text-xs text-cyan-300/80">
                  Current: {batchStatus.current_part || 'Researching...'}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs text-cyan-300">
              {Math.round((batchStatus.processed_rows / (batchStatus.total_rows || 1)) * 100)}%
            </span>
          </div>
        )}

        {/* Single SKU Drawer/Modal */}
        {runnerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="panel w-full max-w-lg overflow-hidden border border-cyan-300/30 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/20 text-cyan-300">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold">Run AI Researcher Pipeline</h3>
                    <p className="text-xs text-muted-foreground">SearXNG Search ➔ Crawl4AI ➔ LLM Extraction</p>
                  </div>
                </div>
                <button onClick={() => setRunnerOpen(false)} className="rounded p-1 hover:bg-accent">
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteSingleSKU} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Part Number / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={runSku}
                    onChange={(e) => setRunSku(e.target.value)}
                    placeholder="e.g. DCB518ASTS06G or 4816AF"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyan-300"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Part Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={runDesc}
                    onChange={(e) => setRunDesc(e.target.value)}
                    placeholder="e.g. Diablo 1/2 in. x 18 in. SDS-Plus Hammer Drill Bit"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyan-300"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Manufacturer / Brand (Optional)
                  </label>
                  <input
                    type="text"
                    value={runBrand}
                    onChange={(e) => setRunBrand(e.target.value)}
                    placeholder="e.g. Diablo or Fastenal"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyan-300"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setRunnerOpen(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Running Pipeline...
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Execute Pipeline
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Search records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, description, category, or brand"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            title="Refresh records from backend"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_450px]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Live records
                </p>
                <p className="mt-1 text-sm font-medium">
                  {filtered.length} of {items.length} records in view
                </p>
              </div>
              <span className="rounded-full bg-amber-300/10 px-2.5 py-1 font-mono text-[10px] text-amber-300">
                {pendingCount} pending review
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-accent/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Brand / Category</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">State</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.sku}
                      className={`cursor-pointer border-t border-border transition-colors hover:bg-accent/30 ${
                        selected.sku === item.sku ? 'bg-cyan-300/5' : ''
                      }`}
                      onClick={() => {
                        setSelected(item)
                        setInspector(true)
                      }}
                    >
                      <td className="px-4 py-4 font-mono text-xs text-cyan-300">#{item.sku}</td>
                      <td className="px-4 py-4 font-medium">
                        <div className="max-w-[280px] truncate">{item.name}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {item.brand ? <span className="font-semibold text-foreground">{item.brand} · </span> : ''}
                        {item.category}
                      </td>
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
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] ${
                            item.status === 'Approved'
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : 'bg-amber-400/10 text-amber-300'
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        No records match your query. Click <b>"Enrich Single SKU"</b> above to research a new part.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <Inspector
            item={selected}
            approve={() => approve(selected)}
            close={() => setInspector(false)}
            compact={inspector}
          />
        </div>
      </div>
    </AppShell>
  )
}

function Inspector({
  item,
  approve,
  close,
  compact
}: {
  item: CatalogItem
  approve: () => void
  close: () => void
  compact: boolean
}) {
  if (!item) return null

  return (
    <aside
      className={`${
        compact
          ? 'compact-inspector fixed inset-x-3 bottom-3 z-30 max-h-[85vh] overflow-auto shadow-2xl'
          : 'wide-inspector'
      } panel p-5`}
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Diff & Spec Inspector</p>
          <h3 className="mt-1 font-semibold">
            #{item.sku} · {item.name}
          </h3>
          {item.brand && <p className="text-xs text-muted-foreground">Brand: {item.brand}</p>}
        </div>
        {compact && (
          <button aria-label="Close inspector" onClick={close} className="rounded p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between rounded-md bg-accent/40 p-3">
        <span className="text-xs text-muted-foreground">AI confidence score</span>
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
            Invoice description (Max 40)
          </p>
          <div className="rounded-md border border-border bg-background/50 p-3 font-mono text-sm">
            {item.invoice || '<Empty>'}
          </div>
          <div className="mt-2">
            <Counter label="Invoice length" value={item.invoice || ''} type="invoice" />
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Mobile description (60–80 chars)
          </p>
          <div className="rounded-md border border-border bg-background/50 p-3 text-sm leading-6">
            {item.mobile || '<Empty>'}
          </div>
          <div className="mt-2">
            <Counter label="Mobile length" value={item.mobile || ''} type="mobile" />
          </div>
        </div>

        {/* Manufacturer URL & Documentation */}
        {(item.mfr_url || (item.doc_links && Object.keys(item.doc_links).length > 0)) && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Sources & Documents
            </p>
            <div className="space-y-1.5 rounded-md border border-border bg-background/30 p-3 text-xs">
              {item.mfr_url && (
                <a
                  href={item.mfr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between text-cyan-300 hover:underline"
                >
                  <span className="truncate">Official Web Source</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
              {item.doc_links &&
                Object.entries(item.doc_links).map(([docTitle, docUrl]) => (
                  <a
                    key={docTitle}
                    href={docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-muted-foreground hover:text-cyan-300"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <FileText className="size-3" />
                      {docTitle}
                    </span>
                    <ExternalLink className="size-3" />
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Dynamic Extracted Attributes */}
        {item.attributes && item.attributes.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Extracted Specifications
            </p>
            <div className="grid grid-cols-2 gap-2">
              {item.attributes.map((attr, idx) => (
                <div key={idx} className="rounded border border-border/80 bg-accent/20 p-2 text-xs">
                  <p className="text-[10px] text-muted-foreground">{attr.label}</p>
                  <p className="font-mono font-medium">
                    {attr.value} {attr.uom || ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={approve}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-400 px-3 py-2.5 text-sm font-medium text-emerald-950 shadow hover:bg-emerald-300"
        >
          <CheckCircle2 className="size-4" />
          Approve & Publish
        </button>
      </div>
    </aside>
  )
}

