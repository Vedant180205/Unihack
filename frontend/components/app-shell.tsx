'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Boxes, ChevronDown, ClipboardCheck, Database, Gauge, LayoutDashboard, Menu, Search, Settings2, Sparkles, UploadCloud, X } from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import { Toaster } from 'sonner'

const PendingContext = createContext<{ pending: number; decrement: () => void }>({ pending: 14, decrement: () => undefined })
export const usePendingQueue = () => useContext(PendingContext)

const nav = [
  { href: '/', label: 'Home & Upload', icon: UploadCloud },
  { href: '/overview', label: 'Pipeline Overview', icon: LayoutDashboard },
  { href: '/workbench', label: 'Data Workbench', icon: Database },
  { href: '/audit', label: 'HITL Audit Queue', icon: ClipboardCheck },
  { href: '/benchmark', label: 'Benchmark', icon: Gauge },
]

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(14)
  const decrement = () => setPending((value) => Math.max(0, value - 1))
  return (
    <PendingContext.Provider value={{ pending, decrement }}><div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles /></span>
            <span><span className="block text-sm font-semibold tracking-tight">UniClean</span><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI operations</span></span>
          </Link>
          <button className="lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="flex-1 px-3 py-6">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
          <nav className="flex flex-col gap-1">
            {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`group flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors ${pathname === href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}`}><span className="flex items-center gap-3"><Icon className="size-4" />{label}</span>{label === 'HITL Audit Queue' && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">{pending} pending</span>}</Link>)}
          </nav>
          <p className="mb-3 mt-9 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">System</p>
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"><Settings2 className="size-4" />Configuration</button>
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"><Boxes className="size-4" />Data sources</button>
        </div>
        <div className="border-t border-border p-4"><div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3"><div className="flex size-8 items-center justify-center rounded-full bg-cyan-400/15 font-mono text-xs text-cyan-300">AM</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">Alex Morgan</p><p className="truncate text-[11px] text-muted-foreground">Catalog operations</p></div><ChevronDown className="size-3 text-muted-foreground" /></div></div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-background/70 lg:hidden" aria-label="Close navigation overlay" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button className="rounded-md p-2 hover:bg-accent lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Workspace / Operations</p><h1 className="text-lg font-semibold tracking-tight">{title}</h1></div></div>
          <div className="flex items-center gap-2"><button className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent md:flex"><Search className="size-3.5" />Search <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘ K</kbd></button><button className="relative rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Notifications"><Bell className="size-4" /><span className="absolute right-1 top-1 size-1.5 rounded-full bg-cyan-400" /></button><div className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs md:flex"><span className="size-1.5 rounded-full bg-emerald-400" />Batch 24.08.17 <ChevronDown className="size-3" /></div></div>
        </header>
        <main className="min-h-[calc(100vh-5rem)] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div></PendingContext.Provider>
  )
}

export function StatCard({ label, value, detail, tone = 'cyan' }: { label: string; value: string; detail: string; tone?: 'cyan' | 'emerald' | 'amber' | 'rose' }) {
  return <div className="panel p-5"><div className="flex items-start justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p><span className={`status-dot ${tone}`} /></div><p className="mt-4 font-mono text-3xl font-medium tracking-tight">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) { return <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{action}</div> }
export { nav }
export function decrementPending(setPending: React.Dispatch<React.SetStateAction<number>>) { setPending((value) => Math.max(0, value - 1)) }
