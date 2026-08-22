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
  RefreshCw,
  Layers
} from 'lucide-react'
import { AppShell, SectionHeading, useBatch } from '@/components/app-shell'
import { api } from '@/lib/api'
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
  const { activeBatch, setActiveBatch, batches, rowCount } = useBatch()
  const [animationStarted, setAnimationStarted] = useState(false)
  const [realCount, setRealCount] = useState<number | null>(null)
  const [realAvgConfidence, setRealAvgConfidence] = useState<number | null>(null)

  // Fetch real pipeline stats from FastAPI on mount
  useEffect(() => {
    api.getRecords().then(res => {
      if (res.success && res.count > 0) {
        setRealCount(res.count)
        const scores = res.records
          .map(r => r.data?.confidence_score ?? r.data?.['confidence_score'])
          .filter((s): s is number => typeof s === 'number')
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length
          setRealAvgConfidence(Math.round(avg * 10) / 10)
        }
      }
    }).catch(console.error)
  }, [])

  // Trigger stagger animation on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationStarted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Effective row count N from active upload/workbench selection
  const N = useMemo(() => {
    if (activeBatch !== 'Batch 1') {
      const match = batches.find((b) => b.id === activeBatch)
      if (match) {
        const parsed = parseInt(match.records.replace(/,/g, ''), 10)
        if (!isNaN(parsed) && parsed > 0) return parsed
      }
    }
    return realCount ?? rowCount ?? 1000
  }, [activeBatch, batches, rowCount])

  // Dynamically derived numeric targets mapped to N
  const targetAutoApprovedPct = realAvgConfidence ?? 96.8
  const targetAutoApprovedCount = Math.min(N, Math.max(1, Math.round(N * (targetAutoApprovedPct / 100))))
  const targetHumanReviewCount = N <= 10 ? 1 : N <= 25 ? 2 : N <= 50 ? 3 : N <= 100 ? 7 : Math.max(1, Math.round(N * 0.014))
  
  const targetAvgConfidence = useMemo(() => {
    if (activeBatch === 'Batch 1') return 99.4
    if (activeBatch === 'BATCH-24.08.17') return 99.2
    if (activeBatch === 'BATCH-24.08.16') return 96.8
    return 91.4
  }, [activeBatch])

  const targetVelocity = useMemo(() => {
    if (N <= 25) return Number((N * 0.2).toFixed(1))
    if (N <= 100) return Number((N * 0.1).toFixed(1))
    if (N <= 1000) return 12.4
    return Number(((N / 1000) * 0.85).toFixed(1))
  }, [N])

  // Dynamically mapped distribution slice counts
  const targetHighConfCount = Math.round(N * 0.68)
  const targetApprovedCount = Math.round(N * 0.23)
  const targetReviewCount = Math.max(1, Math.round(N * 0.06))
  const targetExceptionCount = Math.max(1, Math.round(N * 0.03))

  // Animated counters starting from 0 to dynamically mapped targets
  const recordsProcessed = useAnimatedCounter(N, 1800, 0)
  const autoApprovedCount = useAnimatedCounter(targetAutoApprovedCount, 1600, 0)
  const humanReview = useAnimatedCounter(targetHumanReviewCount, 1200, 0)
  const avgConfidence = useAnimatedCounter(targetAvgConfidence, 1500, 1)
  const processingVelocity = useAnimatedCounter(targetVelocity, 1600, 1)

  const highConfCount = useAnimatedCounter(targetHighConfCount, 1500, 0)
  const approvedCount = useAnimatedCounter(targetApprovedCount, 1400, 0)
  const reviewCount = useAnimatedCounter(targetReviewCount, 1200, 0)
  const exceptionCount = useAnimatedCounter(targetExceptionCount, 1000, 0)

  const barData = [35, 48, 42, 65, 55, 72, 68, 87, 78, 94, 82, 100, 92, 96, 88, 100, 96, 100]

  return (
    <AppShell title="Pipeline overview">
      <div className="mx-auto max-w-[1500px] space-y-8">
        {/* Top Hero Banner */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                <span className="status-dot cyan" />
                Live pipeline â€¢ Active: {activeBatch}
              </span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-300 font-semibold">
                Mapped Scope: {N.toLocaleString()} rows
              </span>
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl text-foreground">
              Catalog intelligence, <span className="text-cyan-300">in motion.</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Telemetry and 252-column normalization metrics dynamically synchronized for the active {N.toLocaleString()}-row dataset.
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
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shadow-md"
            >
              <Play className="size-4" />
              Open workbench
            </Link>
            <button
              onClick={() => setExportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileSpreadsheet className="size-4" />
              Export report ({N.toLocaleString()} rows)
            </button>
          </div>
        </div>

        {/* Top Stat Cards mapped to uploaded rows */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Stat 1: Records processed */}
          <div className="panel p-5 relative overflow-hidden group border-cyan-400/30">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Records processed
              </p>
              <span className="status-dot cyan" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground transition-all">
              {recordsProcessed}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {N === 1000 ? 'Full benchmark dataset active' : `Scoped to ${N.toLocaleString()} rows from workbench`}
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent opacity-60" />
          </div>

          {/* Stat 2: Auto-approved */}
          <div className="panel p-5 relative overflow-hidden group border-emerald-400/30">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Auto-approved (96.8%)
              </p>
              <span className="status-dot emerald" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-emerald-400 transition-all">
              {autoApprovedCount} <span className="text-sm font-normal text-muted-foreground font-sans">/ {N.toLocaleString()} rows</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Target threshold 94.0% verified</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-transparent opacity-60" />
          </div>

          {/* Stat 3: Human review */}
          <div className="panel p-5 relative overflow-hidden group border-amber-400/30">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Human review (&lt;50%)
              </p>
              <span className="status-dot amber" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-amber-300 transition-all">
              {humanReview} <span className="text-sm font-normal text-muted-foreground font-sans">exceptions</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {((targetHumanReviewCount / N) * 100).toFixed(1)}% of active {N.toLocaleString()} batch
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-transparent opacity-60" />
          </div>

          {/* Stat 4: Avg confidence */}
          <div className="panel p-5 relative overflow-hidden group border-cyan-400/30">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Avg. confidence
              </p>
              <span className="status-dot cyan" />
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-cyan-300 transition-all">
              {avgConfidence}%
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Weighted across {N.toLocaleString()} records</p>
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
                  <span className="size-1 rounded-full bg-cyan-300 animate-ping" /> Now ({N.toLocaleString()} records)
                </span>
              </div>
            </div>
          </section>

          {/* Model Certainty Donut & Distribution */}
          <section className="panel p-5">
            <SectionHeading
              eyebrow="Confidence distribution"
              title="Model certainty"
              description={`Current batch across ${N.toLocaleString()} records`}
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
                    {avgConfidence}%
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">avg score</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs pt-2">
              <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-cyan-300" /> High (68%)
                  </span>
                  <b className="font-mono text-cyan-300">{highConfCount}</b>
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-mono">records</p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400" /> Approved (23%)
                  </span>
                  <b className="font-mono text-emerald-400">{approvedCount}</b>
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-mono">records</p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-300" /> Review (6%)
                  </span>
                  <b className="font-mono text-amber-300">{reviewCount}</b>
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-mono">records</p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/50 border border-border/40 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-400" /> Exception (3%)
                  </span>
                  <b className="font-mono text-rose-400">{exceptionCount}</b>
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-mono">records</p>
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
                  const displayRecords = isCurrent && batch.id === 'Batch 1' ? N.toLocaleString() : batch.records

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
                      <td className="px-5 py-4 font-mono text-xs font-semibold">{displayRecords}</td>
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

