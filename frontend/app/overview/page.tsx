'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  Clock3,
  Database,
  Filter,
  MoreHorizontal,
  Play,
  ShieldCheck,
  TriangleAlert,
  Zap,
  FileSpreadsheet,
  Download,
  UploadCloud
} from 'lucide-react'
import { AppShell, SectionHeading, StatCard, useBatch } from '@/components/app-shell'
import { ExportReportModal } from '@/components/export-report-modal'

export default function OverviewPage() {
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const { activeBatch, setActiveBatch, batches } = useBatch()

  return (
    <AppShell title="Pipeline overview">
      <div className="mx-auto max-w-[1500px]">
        {/* Top Hero Banner */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              <span className="status-dot cyan" />
              Live pipeline
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Catalog intelligence, <span className="text-cyan-300">in motion.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Monitor enrichment throughput, review exceptions, and keep your enterprise catalog moving from raw data to trusted records.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <UploadCloud className="size-4" />
              Upload new dataset
            </Link>
            <Link
              href="/workbench"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Play className="size-4" />
              Open workbench
            </Link>
            <button
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileSpreadsheet className="size-4" />
              Export report
            </button>
          </div>
        </div>

        {/* Top Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Records processed" value="40,620" detail="+18.4% vs previous batch" tone="cyan" />
          <StatCard label="Auto-approved" value="96.8%" detail="Target threshold 94.0%" tone="emerald" />
          <StatCard label="Human review" value="14" detail="Items require attention" tone="amber" />
          <StatCard label="Avg. confidence" value="93.4" detail="+2.1 points this run" tone="cyan" />
        </div>

        {/* Mid Section Charts */}
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
                12.4k records / hour
              </span>
            </div>
            <div className="p-5">
              <div className="flex h-56 items-end gap-2 border-b border-border pb-0">
                {[35, 48, 42, 65, 55, 72, 68, 87, 78, 94, 82, 100, 92, 96, 88, 100, 96, 100].map((height, index) => (
                  <div key={index} className="group flex h-full flex-1 flex-col justify-end gap-2">
                    <div
                      className="rounded-t-sm bg-cyan-300/70 transition-colors group-hover:bg-cyan-200"
                      style={{ height: `${height * 2.1}px` }}
                    />
                  </div>
                ))}
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
              description="Current batch across 40,620 records"
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
                  <span className="font-mono text-3xl">93.4</span>
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

        {/* Batch History Table */}
        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Batch history
              </p>
              <h3 className="mt-1 font-semibold">Recent enrichment runs</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/20"
              >
                <Download className="size-3.5" />
                Export 252-Col Delivery
              </button>
              <button className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
                <Filter className="size-3.5" />
                Filter view
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-accent/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Batch</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Records</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const isCurrent = batch.id === activeBatch
                  return (
                    <tr
                      key={batch.id}
                      onClick={() => {
                        setActiveBatch(batch.id)
                        setExportModalOpen(true)
                      }}
                      className={`border-t border-border hover:bg-accent/20 cursor-pointer transition-colors ${
                        isCurrent ? 'bg-cyan-400/5 font-medium' : ''
                      }`}
                    >
                      <td className="px-5 py-4 font-mono text-xs text-cyan-300">
                        <div className="flex items-center gap-2">
                          {isCurrent && <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                          {batch.name}
                        </div>
                      </td>
                      <td className="px-5 py-4">{batch.source}</td>
                      <td className="px-5 py-4 font-mono text-xs">{batch.records}</td>
                      <td className="px-5 py-4 font-mono text-xs text-emerald-300">{batch.confidence}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ${
                            batch.status === 'Live'
                              ? 'bg-cyan-400/15 text-cyan-300 font-semibold'
                              : batch.status === 'Review'
                              ? 'bg-amber-300/10 text-amber-300'
                              : 'bg-emerald-300/10 text-emerald-300'
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          aria-label={`Open ${batch.name}`}
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Status Indicators */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="panel flex items-center gap-4 p-4">
            <CircleCheck className="size-5 text-emerald-300" />
            <div>
              <p className="text-sm font-medium">Optimizer online</p>
              <p className="text-xs text-muted-foreground">All 252 delivery rules active</p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <Clock3 className="size-5 text-cyan-300" />
            <div>
              <p className="text-sm font-medium">Delivery sync ready</p>
              <p className="text-xs text-muted-foreground">output.csv &amp; output.xlsx in sync</p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <ShieldCheck className="size-5 text-amber-300" />
            <div>
              <p className="text-sm font-medium">Governance active</p>
              <p className="text-xs text-muted-foreground">Audit trail recording</p>
            </div>
          </div>
        </div>

        {/* Interactive Export & Preview Modal */}
        <ExportReportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
        />
      </div>
    </AppShell>
  )
}
