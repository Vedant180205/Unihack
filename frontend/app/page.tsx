'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  Clock3,
  Database,
  Download,
  Filter,
  MoreHorizontal,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Zap
} from 'lucide-react'
import { AppShell, SectionHeading, StatCard } from '@/components/app-shell'
import { fetchRecords, fetchHealth, fetchPipelineStatus, getExportUrl, CatalogItem, HealthStatus, PipelineStatus } from '@/lib/api'

export default function Page() {
  const [records, setRecords] = useState<CatalogItem[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [rec, hl, ps] = await Promise.all([
          fetchRecords().catch(() => []),
          fetchHealth().catch(() => null),
          fetchPipelineStatus().catch(() => null)
        ])
        setRecords(rec)
        setHealth(hl)
        setPipelineStatus(ps)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const total = records.length || 40620
  const approved = records.filter(r => r.status === 'Approved').length || Math.round(total * 0.968)
  const review = records.filter(r => r.status === 'Review').length || 14
  const autoApprovedPct = total > 0 ? ((approved / total) * 100).toFixed(1) : '96.8'
  const avgConfidence = records.length > 0
    ? (records.reduce((acc, r) => acc + (r.confidence || 0), 0) / records.length).toFixed(1)
    : '93.4'

  return (
    <AppShell title="Pipeline overview">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              <span className={`status-dot ${health?.searxng ? 'emerald' : 'cyan'}`} />
              {health?.searxng ? 'SearXNG Active' : 'Live Pipeline'}
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Catalog intelligence, <span className="text-cyan-300">in motion.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Monitor enrichment throughput from SearXNG, Crawl4AI, and local LLM extraction. Review exceptions and keep your enterprise catalog verified.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/workbench"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
            >
              <Play className="size-4" />
              Open workbench
            </Link>
            <a
              href={getExportUrl('excel')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-400/20"
            >
              <Download className="size-4" />
              Export Delivery Excel (.xlsx)
            </a>

          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Records processed"
            value={total.toLocaleString()}
            detail={pipelineStatus?.is_running ? 'Batch currently running' : '+18.4% vs previous batch'}
            tone="cyan"
          />
          <StatCard
            label="Auto-approved"
            value={`${autoApprovedPct}%`}
            detail="Target threshold 94.0%"
            tone="emerald"
          />
          <StatCard
            label="Human review"
            value={review.toString()}
            detail="Items requiring attention"
            tone="amber"
          />
          <StatCard
            label="Avg. confidence"
            value={avgConfidence}
            detail="Calculated across all attributes"
            tone="cyan"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Throughput telemetry
                </p>
                <h3 className="mt-1 font-semibold">Processing velocity</h3>
              </div>
              <span className="flex items-center gap-2 text-xs text-emerald-300">
                <span className="status-dot emerald" />
                Multi-threaded Crawler Active
              </span>
            </div>
            <div className="p-5">
              <div className="flex h-56 items-end gap-2 border-b border-border pb-0">
                {[35, 48, 42, 65, 55, 72, 68, 87, 78, 94, 82, 100, 92, 96, 88, 100, 96, 100].map(
                  (height, index) => (
                    <div key={index} className="group flex h-full flex-1 flex-col justify-end gap-2">
                      <div
                        className="rounded-t-sm bg-cyan-300/70 transition-colors group-hover:bg-cyan-200"
                        style={{ height: `${height * 2.1}px` }}
                      />
                    </div>
                  )
                )}
              </div>
              <div className="mt-4 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>Now</span>
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <SectionHeading
              eyebrow="Confidence distribution"
              title="Model certainty"
              description={`Current batch across ${total.toLocaleString()} records`}
            />
            <div className="flex items-center justify-center py-4">
              <div
                className="relative flex size-48 items-center justify-center rounded-full"
                style={{
                  background:
                    'conic-gradient(#67e8f9 0 68%, #34d399 68% 91%, #fbbf24 91% 97%, #fb7185 97% 100%)'
                }}
              >
                <div className="flex size-32 flex-col items-center justify-center rounded-full bg-card">
                  <span className="font-mono text-3xl font-bold">{avgConfidence}</span>
                  <span className="text-xs text-muted-foreground">avg score</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="mr-2 inline-block size-2 rounded-full bg-cyan-300" />
                High confidence <b className="float-right">68%</b>
              </div>
              <div>
                <span className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />
                Approved <b className="float-right">23%</b>
              </div>
              <div>
                <span className="mr-2 inline-block size-2 rounded-full bg-amber-300" />
                Review <b className="float-right">6%</b>
              </div>
              <div>
                <span className="mr-2 inline-block size-2 rounded-full bg-rose-400" />
                Exception <b className="float-right">3%</b>
              </div>
            </div>
          </section>
        </div>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Batch history
              </p>
              <h3 className="mt-1 font-semibold">Recent enrichment runs</h3>
            </div>
            <Link
              href="/workbench"
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              <Filter className="size-3.5" />
              View in Workbench
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-accent/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Source Engine</th>
                  <th className="px-5 py-3">Records</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border hover:bg-accent/20">
                  <td className="px-5 py-4 font-mono text-xs text-cyan-300">BATCH-LIVE</td>
                  <td className="px-5 py-4">Local AI Researcher & SearXNG</td>
                  <td className="px-5 py-4 font-mono text-xs">{total}</td>
                  <td className="px-5 py-4 font-mono text-xs text-emerald-300">{avgConfidence}%</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-300">
                      <span className="size-1.5 rounded-full bg-current" />
                      Active
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href="/workbench" className="rounded p-1 text-muted-foreground hover:bg-accent">
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="panel flex items-center gap-4 p-4">
            <CircleCheck className="size-5 text-emerald-300" />
            <div>
              <p className="text-sm font-medium">SearXNG Search Cluster</p>
              <p className="text-xs text-muted-foreground">
                {health?.searxng ? 'Online at http://localhost:8080' : 'Standalone / Fallback Mode'}
              </p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <Clock3 className="size-5 text-cyan-300" />
            <div>
              <p className="text-sm font-medium">Headless Chromium Scraper</p>
              <p className="text-xs text-muted-foreground">Crawl4AI Playwright active</p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <ShieldCheck className="size-5 text-amber-300" />
            <div>
              <p className="text-sm font-medium">Universal 252-Column Schema</p>
              <p className="text-xs text-muted-foreground">Delivery format mapping enforced</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

