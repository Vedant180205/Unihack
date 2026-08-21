'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  UploadCloud,
  Sparkles,
  Activity,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { AppShell, SectionHeading, useBatch } from '@/components/app-shell'
import { ExportReportModal } from '@/components/export-report-modal'

// Smooth ease-out cubic animation function
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function useAnimatedCounter(target: number, duration: number = 1600, decimals: number = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const eased = easeOutCubic(progress)
      setValue(eased * target)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [target, duration])

  if (decimals === 0) {
    return Math.round(value).toLocaleString()
  }
  return value.toFixed(decimals)
}

export default function OverviewPage() {
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const { activeBatch, setActiveBatch, batches } = useBatch()
  const [animationStarted, setAnimationStarted] = useState(false)

  // Trigger stagger animation on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationStarted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Animated counters starting from 0 to target values
  const recordsProcessed = useAnimatedCounter(40620, 1800, 0)
  const autoApproved = useAnimatedCounter(96.8, 1600, 1)
  const humanReview = useAnimatedCounter(14, 1200, 0)
  const avgConfidence = useAnimatedCounter(93.4, 1500, 1)
  const processingVelocity = useAnimatedCounter(12.4, 1600, 1)

  const highConf = useAnimatedCounter(68, 1500, 0)
  const approvedPct = useAnimatedCounter(23, 1400, 0)
  const reviewPct = useAnimatedCounter(6, 1200, 0)
  const exceptionPct = useAnimatedCounter(3, 1000, 0)

  const barData = [35, 48, 42, 65, 55, 72, 68, 87, 78, 94, 82, 100, 92, 96, 88, 100, 96, 100]

  return (
    <AppShell title="Pipeline overview">
      <div className="mx-auto max-w-[1500px] space-y-8">
        {/* Top Hero Banner */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              <span className="status-dot cyan" />
              Live pipeline • Active Batch: {activeBatch}
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl text-foreground">
              Catalog intelligence, <span className="text-cyan-300">in motion.</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
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

        {/* Top Stat Cards with dynamic count-up animation */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Stat 1: Records processed */}
          <div className="panel p-5 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Records processed
              </p>
              <span className="status-dot cyan" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground transition-all">
              {recordsProcessed}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">+18.4% vs previous batch</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent opacity-60" />
          </div>

          {/* Stat 2: Auto-approved */}
          <div className="panel p-5 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Auto-approved
              </p>
              <span className="status-dot emerald" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-emerald-400 transition-all">
              {autoApproved}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Target threshold 94.0%</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-transparent opacity-60" />
          </div>

          {/* Stat 3: Human review */}
          <div className="panel p-5 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Human review
              </p>
              <span className="status-dot amber" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-amber-300 transition-all">
              {humanReview}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Items require attention</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent opacity-60" />
          </div>

          {/* Stat 4: Avg confidence */}
          <div className="panel p-5 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Avg. confidence
              </p>
              <span className="status-dot cyan" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-cyan-300 transition-all">
              {avgConfidence}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">+2.1 points this run</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent opacity-60" />
          </div>
        </div>

        {/* Mid Section Charts with animated growth */}
        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          {/* Throughput velocity chart */}
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5 bg-accent/10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Throughput telemetry
                </p>
                <h3 className="mt-1 font-semibold text-foreground">Processing velocity</h3>
              </div>
              <span className="flex items-center gap-2 text-xs text-emerald-300 font-mono font-semibold">
                <span className="status-dot emerald" />
                {processingVelocity}k records / hour
              </span>
            </div>
            <div className="p-5">
              {/* Dynamic Growing Bar Chart */}
              <div className="flex h-56 items-end gap-2 border-b border-border pb-0">
                {barData.map((targetHeight, index) => {
                  const animatedHeight = animationStarted ? targetHeight * 2.1 : 0
                  return (
                    <div key={index} className="group flex h-full flex-1 flex-col justify-end gap-2">
                      <div
                        className="rounded-t-sm bg-gradient-to-t from-cyan-500/60 to-cyan-300 transition-all duration-700 ease-out group-hover:from-cyan-400 group-hover:to-cyan-100 shadow-sm"
                        style={{
                          height: `${animatedHeight}px`,
                          transitionDelay: `${index * 30}ms`,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span className="text-cyan-300 font-semibold flex items-center gap-1">
                  <span className="size-1 rounded-full bg-cyan-300 animate-ping" /> Now
                </span>
              </div>
            </div>
          </section>

          {/* Model Certainty Donut & Distribution */}
          <section className="panel p-5">
            <SectionHeading
              eyebrow="Confidence distribution"
              title="Model certainty"
              description="Current batch across records"
            />
            <div className="flex items-center justify-center py-4">
              <div
                className={`relative flex size-48 items-center justify-center rounded-full transition-transform duration-1000 ${
                  animationStarted ? 'scale-100 opacity-100 rotate-0' : 'scale-90 opacity-20 -rotate-90'
                }`}
                style={{
                  background:
                    'conic-gradient(#67e8f9 0 68%, #34d399 68% 91%, #fbbf24 91% 97%, #fb7185 97% 100%)',
                  boxShadow: '0 0 35px -10px oklch(0.7 0.15 200 / 0.4)',
                }}
              >
                <div className="flex size-32 flex-col items-center justify-center rounded-full bg-card shadow-inner">
                  <span className="font-mono text-3xl font-bold text-foreground">
                    {avgConfidence}
                  </span>
                  <span className="text-xs text-muted-foreground">avg score</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-2 rounded-lg bg-background/50 border border-border/40">
                <span className="mr-1.5 inline-block size-2 rounded-full bg-cyan-300" />
                <span className="text-muted-foreground">High confidence</span>
                <b className="float-right font-mono text-cyan-300">{highConf}%</b>
              </div>
              <div className="p-2 rounded-lg bg-background/50 border border-border/40">
                <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-400" />
                <span className="text-muted-foreground">Approved</span>
                <b className="float-right font-mono text-emerald-400">{approvedPct}%</b>
              </div>
              <div className="p-2 rounded-lg bg-background/50 border border-border/40">
                <span className="mr-1.5 inline-block size-2 rounded-full bg-amber-300" />
                <span className="text-muted-foreground">Review</span>
                <b className="float-right font-mono text-amber-300">{reviewPct}%</b>
              </div>
              <div className="p-2 rounded-lg bg-background/50 border border-border/40">
                <span className="mr-1.5 inline-block size-2 rounded-full bg-rose-400" />
                <span className="text-muted-foreground">Exception</span>
                <b className="float-right font-mono text-rose-400">{exceptionPct}%</b>
              </div>
            </div>
          </section>
        </div>

        {/* Batch History Table */}
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 bg-accent/10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Batch history
              </p>
              <h3 className="mt-1 font-semibold text-foreground">Recent enrichment runs</h3>
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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel flex items-center gap-4 p-4">
            <CircleCheck className="size-5 text-emerald-300" />
            <div>
              <p className="text-sm font-medium text-foreground">Optimizer online</p>
              <p className="text-xs text-muted-foreground">All 252 delivery rules active</p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <Clock3 className="size-5 text-cyan-300" />
            <div>
              <p className="text-sm font-medium text-foreground">Delivery sync ready</p>
              <p className="text-xs text-muted-foreground">output.csv &amp; output.xlsx in sync</p>
            </div>
          </div>
          <div className="panel flex items-center gap-4 p-4">
            <ShieldCheck className="size-5 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-foreground">Governance active</p>
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
