'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Bell,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Database,
  Gauge,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
  Check,
  CheckCircle2,
  Clock3,
  Layers
} from 'lucide-react'
import { Toaster, toast } from 'sonner'

export interface BatchItem {
  id: string
  name: string
  source: string
  records: string
  confidence: string
  status: 'Live' | 'Completed' | 'Review'
}

export const INITIAL_BATCHES: BatchItem[] = [
  { id: 'Batch 1', name: 'Batch 1', source: 'User Uploaded Ingestion Feed', records: '1,000', confidence: '99.4%', status: 'Live' },
  { id: 'BATCH-24.08.17', name: 'BATCH-24.08.17', source: 'Industrial MRO master', records: '18,420', confidence: '99.2%', status: 'Completed' },
  { id: 'BATCH-24.08.16', name: 'BATCH-24.08.16', source: 'Electrical components', records: '12,860', confidence: '96.8%', status: 'Completed' },
  { id: 'BATCH-24.08.15', name: 'BATCH-24.08.15', source: 'Facilities & safety', records: '9,340', confidence: '91.4%', status: 'Review' },
]

interface BatchContextType {
  activeBatch: string
  setActiveBatch: (batchId: string) => void
  batches: BatchItem[]
}

const BatchContext = createContext<BatchContextType>({
  activeBatch: 'BATCH-24.08.17',
  setActiveBatch: () => undefined,
  batches: INITIAL_BATCHES,
})

export const useBatch = () => useContext(BatchContext)

const PendingContext = createContext<{ pending: number; decrement: () => void }>({
  pending: 14,
  decrement: () => undefined
})
export const usePendingQueue = () => useContext(PendingContext)

const nav = [
  { href: '/', label: 'Home & Upload', icon: UploadCloud },
  { href: '/workbench', label: 'Data Workbench', icon: Database },
  { href: '/overview', label: 'Pipeline Overview', icon: LayoutDashboard },
  { href: '/audit', label: 'HITL Audit Queue', icon: ClipboardCheck },
  { href: '/benchmark', label: 'Benchmark', icon: Gauge },
]

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(14)
  const [activeBatch, setActiveBatchState] = useState<string>('BATCH-24.08.17')
  const [batches] = useState<BatchItem[]>(INITIAL_BATCHES)
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const decrement = () => setPending((value) => Math.max(0, value - 1))

  const setActiveBatch = (batchId: string) => {
    setActiveBatchState(batchId)
    try {
      localStorage.setItem('uniclean_active_batch', batchId)
    } catch {}
  }

  // Sync batch from localStorage or URL param on initial render
  useEffect(() => {
    const urlBatch = searchParams?.get('batch')
    if (urlBatch) {
      const match = batches.find((b) => b.id.toLowerCase() === urlBatch.toLowerCase())
      if (match) {
        setActiveBatchState(match.id)
        return
      }
    }

    try {
      const saved = localStorage.getItem('uniclean_active_batch')
      if (saved && batches.some((b) => b.id === saved)) {
        setActiveBatchState(saved)
      }
    } catch {}
  }, [searchParams, batches])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBatchDropdownOpen(false)
      }
    }
    if (batchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [batchDropdownOpen])

  const currentBatchObj = batches.find((b) => b.id === activeBatch) || batches[0]

  return (
    <BatchContext.Provider value={{ activeBatch, setActiveBatch, batches }}>
      <PendingContext.Provider value={{ pending, decrement }}>
        <div className="min-h-screen bg-background text-foreground">
          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0 ${
              open ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-20 items-center justify-between border-b border-border px-5">
              <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold tracking-tight">UniClean</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    AI operations
                  </span>
                </span>
              </Link>
              <button className="lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 px-3 py-6">
              <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Workspace
              </p>
              <nav className="flex flex-col gap-1">
                {nav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors ${
                      pathname === href
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="size-4" />
                      {label}
                    </span>
                    {label === 'HITL Audit Queue' && (
                      <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        {pending} pending
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
              <p className="mb-3 mt-9 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                System
              </p>
              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                <Settings2 className="size-4" />
                Configuration
              </button>
              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground">
                <Boxes className="size-4" />
                Data sources
              </button>
            </div>
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-cyan-400/15 font-mono text-xs text-cyan-300">
                  AM
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">Alex Morgan</p>
                  <p className="truncate text-[11px] text-muted-foreground">Catalog operations</p>
                </div>
                <ChevronDown className="size-3 text-muted-foreground" />
              </div>
            </div>
          </aside>

          {open && (
            <button
              className="fixed inset-0 z-30 bg-background/70 lg:hidden"
              aria-label="Close navigation overlay"
              onClick={() => setOpen(false)}
            />
          )}

          {/* Main Area */}
          <div className="lg:pl-64">
            <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-md p-2 hover:bg-accent lg:hidden"
                  aria-label="Open navigation"
                  onClick={() => setOpen(true)}
                >
                  <Menu />
                </button>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Workspace / Operations
                  </p>
                  <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                </div>
              </div>

              {/* Right Header: Search & Interactive Batch Selector */}
              <div className="flex items-center gap-3">
                <button className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent md:flex">
                  <Search className="size-3.5" />
                  Search <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘ K</kbd>
                </button>

                <button
                  className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-cyan-400" />
                </button>

                {/* Batch Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setBatchDropdownOpen(!batchDropdownOpen)}
                    className="flex items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:border-cyan-400/40 transition-all shadow-sm"
                    aria-expanded={batchDropdownOpen}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        currentBatchObj.status === 'Live'
                          ? 'bg-cyan-400 animate-pulse'
                          : currentBatchObj.status === 'Review'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="font-mono font-semibold">{activeBatch}</span>
                    <ChevronDown
                      className={`size-3 text-muted-foreground transition-transform duration-200 ${
                        batchDropdownOpen ? 'rotate-180 text-cyan-300' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {batchDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-border/60 mb-1">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Switch Active Batch
                        </p>
                        <p className="text-xs font-medium text-foreground mt-0.5">
                          Select catalog ingestion run
                        </p>
                      </div>

                      <div className="space-y-1">
                        {batches.map((batch) => {
                          const isSelected = batch.id === activeBatch
                          return (
                            <button
                              key={batch.id}
                              onClick={() => {
                                setActiveBatch(batch.id)
                                setBatchDropdownOpen(false)
                                toast.info(`Switched active view to ${batch.id}`)
                              }}
                              className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                                isSelected
                                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                                  : 'hover:bg-accent/60 text-foreground'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{batch.name}</span>
                                  <span
                                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono uppercase ${
                                      batch.status === 'Live'
                                        ? 'bg-cyan-400/20 text-cyan-300'
                                        : batch.status === 'Review'
                                        ? 'bg-amber-400/20 text-amber-300'
                                        : 'bg-emerald-400/20 text-emerald-300'
                                    }`}
                                  >
                                    {batch.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate max-w-44">
                                  {batch.source} • {batch.records} records
                                </p>
                              </div>

                              {isSelected && <Check className="size-4 text-cyan-300 shrink-0 ml-2" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <main className="min-h-[calc(100vh-5rem)] px-4 py-6 md:px-8 md:py-8">{children}</main>
          </div>
          <Toaster position="bottom-right" theme="dark" richColors />
        </div>
      </PendingContext.Provider>
    </BatchContext.Provider>
  )
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'cyan'
}: {
  label: string
  value: string
  detail: string
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose'
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <span className={`status-dot ${tone}`} />
      </div>
      <p className="mt-4 font-mono text-3xl font-medium tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { nav }
export function decrementPending(setPending: React.Dispatch<React.SetStateAction<number>>) {
  setPending((value) => Math.max(0, value - 1))
}
