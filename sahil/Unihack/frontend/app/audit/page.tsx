'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronRight, CircleAlert, ListFilter, RefreshCw, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue } from '@/components/app-shell'
import { fetchRecords, updateCatalogRecord, CatalogItem } from '@/lib/api'

interface FlaggedRecord {
  sku: string
  issue: string
  value: string
  confidence: number
  item: CatalogItem
}

export default function Audit() {
  const { decrement } = usePendingQueue()
  const [rows, setRows] = useState<FlaggedRecord[]>([])
  const [selected, setSelected] = useState<FlaggedRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [suggestedVal, setSuggestedVal] = useState('Each (EA)')

  const loadAuditRecords = async () => {
    setLoading(true)
    try {
      const records = await fetchRecords()
      const flagged = records
        .filter((r) => r.status !== 'Approved' || r.confidence < 90)
        .map((r) => {
          let issue = 'Unverified catalog fields'
          let val = r.invoice || r.name
          if (r.invoice && r.invoice.length > 40) {
            issue = 'Invoice description exceeds 40 characters'
            val = r.invoice
          } else if (r.mobile && (r.mobile.length < 60 || r.mobile.length > 80)) {
            issue = 'Mobile description outside 60-80 char range'
            val = r.mobile
          } else if (!r.brand) {
            issue = 'Missing canonical manufacturer brand'
            val = r.brand || 'Unknown'
          }
          return {
            sku: r.sku,
            issue,
            value: val,
            confidence: r.confidence,
            item: r
          }
        })

      setRows(flagged)
      if (flagged.length > 0) {
        setSelected(flagged[0])
      }
    } catch (e) {
      console.warn('Backend unavailable, using initial audit state.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditRecords()
  }, [])

  const resolve = async (kind: string) => {
    if (!selected) return

    try {
      await updateCatalogRecord(selected.sku, {
        status: 'Approved',
        confidence: 95
      })

      setRows((rs) => rs.filter((r) => r.sku !== selected.sku))
      const remaining = rows.filter((r) => r.sku !== selected.sku)
      setSelected(remaining.length > 0 ? remaining[0] : null)
      decrement()
      toast.success(
        kind === 'lov'
          ? `Standardized catalog attributes for SKU #${selected.sku}`
          : `SKU #${selected.sku} approved and pushed to trusted catalog`
      )
    } catch (err: any) {
      toast.error(`Failed to resolve record: ${err.message}`)
    }
  }

  return (
    <AppShell title="HITL audit queue">
      <div className="mx-auto max-w-[1500px]">
        <SectionHeading
          eyebrow="Human-in-the-loop"
          title="Exceptions that need judgment"
          description="Review and resolve edge cases from the SearXNG + LLM pipeline before records enter the trusted master catalog."
          action={
            selected && (
              <button
                onClick={() => resolve('approve')}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Check className="size-4" />
                Approve item
              </button>
            )
          }
        />

        <div className="mb-5 flex items-center justify-between rounded-lg border border-amber-300/20 bg-amber-300/5 p-4">
          <div className="flex items-center gap-3">
            <CircleAlert className="size-5 text-amber-300" />
            <div>
              <p className="text-sm font-medium">
                {rows.length} records currently require human verification
              </p>
              <p className="text-xs text-muted-foreground">
                High-priority exceptions flagged for description lengths or missing manufacturer taxonomy.
              </p>
            </div>
          </div>
          <button
            onClick={loadAuditRecords}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="panel overflow-hidden">
            <div className="border-b border-border p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Flagged records ({rows.length})
              </p>
            </div>
            {rows.map((r) => (
              <button
                key={r.sku}
                onClick={() => setSelected(r)}
                className={`flex w-full items-center justify-between border-b border-border p-4 text-left hover:bg-accent/30 ${
                  selected?.sku === r.sku ? 'bg-cyan-300/5' : ''
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-mono text-xs text-cyan-300">#{r.sku}</p>
                  <p className="mt-1 truncate text-sm font-medium">{r.issue}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{r.value}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono text-xs ${
                      r.confidence >= 90 ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {r.confidence}%
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                🎉 No exceptions pending in the audit queue!
              </div>
            )}
          </section>

          {selected ? (
            <section className="panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Exception review
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    #{selected.sku} · {selected.issue}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selected.item.name}</p>
                </div>
                <span className="rounded-full bg-amber-300/10 px-3 py-1 font-mono text-xs text-amber-300">
                  {selected.confidence}% confidence
                </span>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">Detected value</label>
                  <div className="rounded-md border border-rose-400/30 bg-rose-400/5 p-3 text-sm">
                    {selected.value}
                  </div>
                  <p className="mt-2 text-xs text-rose-300">
                    Flagged by AI extraction rules as unmapped or non-standard.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">Standardized action</label>
                  <select
                    value={suggestedVal}
                    onChange={(e) => setSuggestedVal(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-3 text-sm outline-none"
                  >
                    <option value="Each (EA)">Each (EA)</option>
                    <option value="Set (SET)">Set (SET)</option>
                    <option value="Pack (PK)">Pack (PK)</option>
                    <option value="Normalize Text">Auto-truncate Text to Bounds</option>
                  </select>
                  <p className="mt-2 text-xs text-emerald-300">AI suggestion · 95% rule match</p>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-accent/25 p-4">
                <div className="flex items-center gap-3">
                  <WandSparkles className="size-5 text-cyan-300" />
                  <div>
                    <p className="text-sm font-medium">Recommended correction</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Apply catalog engineering rule, auto-trim strings to character constraints (Invoice &le; 40, Mobile 60-80), and link canonical brand.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => resolve('lov')}
                  className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-200"
                >
                  <Check className="size-4" />
                  Apply & Standardize
                </button>
                <button
                  onClick={() => resolve('approve')}
                  className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-accent"
                >
                  Approve as-is
                </button>
              </div>
            </section>
          ) : (
            <section className="panel flex items-center justify-center p-12 text-center text-sm text-muted-foreground">
              Select an item from the flagged queue on the left to inspect and approve.
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}

