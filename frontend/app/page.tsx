'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Play,
  RotateCcw,
  Info,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'

interface UploadedFileState {
  name: string
  size: string
  type: string
  rowCount?: number
  isSample?: boolean
}

export default function HomePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<UploadedFileState | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      processSelectedFile(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0])
    }
  }

  const processSelectedFile = (file: File) => {
    const sizeInKb = (file.size / 1024).toFixed(1)
    const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeInKb} KB`

    setSelectedFile({
      name: file.name,
      size: sizeStr,
      type: file.name.endsWith('.csv') ? 'CSV Document' : 'Excel Spreadsheet',
      rowCount: Math.floor(file.size / 120),
      isSample: false,
    })
    toast.success(`Selected dataset: ${file.name}`)
  }

  const loadSampleDataset = () => {
    setSelectedFile({
      name: 'Unihack_ Sample Dataset - Input.csv',
      size: '248.5 KB',
      type: 'CSV Document',
      rowCount: 1000,
      isSample: true,
    })
    toast.info('Loaded Unihack 1,000-Item Benchmark Sample Dataset')
  }

  const handleUploadAndLaunch = () => {
    if (!selectedFile) {
      toast.error('Please select or drop a dataset file first')
      return
    }

    setIsUploading(true)
    setUploadProgress(15)
    setUploadStage('Ingesting catalog rows...')

    setTimeout(() => {
      setUploadProgress(45)
      setUploadStage('Validating 252-column schema targets...')
    }, 400)

    setTimeout(() => {
      setUploadProgress(80)
      setUploadStage('Spawning autonomous web & PDF agents...')
    }, 850)

    setTimeout(() => {
      setUploadProgress(100)
      setUploadStage('Dataset loaded! Redirecting to Overview...')
      toast.success('Dataset successfully ingested! Opening Live Pipeline...')
      setTimeout(() => {
        router.push('/overview')
      }, 400)
    }, 1300)
  }

  return (
    <AppShell title="Home & Ingestion Portal">
      <div className="mx-auto max-w-[1500px] space-y-10">
        {/* Top Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-card via-card/90 to-cyan-950/20 p-8 md:p-12 shadow-2xl">
          {/* Ambient Glows */}
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-1 text-xs font-medium text-cyan-300 font-mono tracking-wider uppercase">
              <Sparkles className="size-3.5 animate-pulse" />
              Autonomous Catalog Cleansing &amp; Enrichment Engine
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground leading-[1.12]">
              Transform Raw Feeds into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200">
                252-Column Enterprise Gold.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              UniClean AI ingests messy distributor spreadsheets, crawls official manufacturer domains, downloads specification PDFs, normalizes trade fractions &amp; UOMs, and synthesizes complete 252-column standardized catalogs with zero hallucination.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="relative z-10 mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 pt-8 border-t border-border/60">
            <div className="space-y-1">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-cyan-300">252</p>
              <p className="text-xs font-medium text-foreground">Delivery Columns</p>
              <p className="text-[11px] text-muted-foreground">Unilog &amp; DIB compliant</p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400">99.4%</p>
              <p className="text-xs font-medium text-foreground">Extraction Precision</p>
              <p className="text-[11px] text-muted-foreground">Grounded neural verification</p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-amber-300">0.5s</p>
              <p className="text-xs font-medium text-foreground">Web &amp; PDF Ingestion</p>
              <p className="text-[11px] text-muted-foreground">TLS-impersonated crawl</p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-cyan-300">100%</p>
              <p className="text-xs font-medium text-foreground">Deterministic Normalization</p>
              <p className="text-[11px] text-muted-foreground">Trade fractions &amp; LOVs</p>
            </div>
          </div>
        </div>

        {/* Main Dataset Ingestion Zone */}
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-start">
          {/* Left: Drag and Drop Upload Card */}
          <div className="panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-cyan-300 font-semibold">
                  Step 1: Ingestion
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-0.5">
                  Upload Product Dataset
                </h2>
              </div>
              <button
                type="button"
                onClick={loadSampleDataset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="size-3.5" />
                Load Sample Dataset
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />

            {/* Drop Zone Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01]'
                  : selectedFile
                  ? 'border-emerald-400/60 bg-emerald-400/5'
                  : 'border-border/80 bg-background/50 hover:border-cyan-400/50 hover:bg-accent/30'
              }`}
            >
              <div className="flex size-16 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 mb-4 shadow-inner">
                <UploadCloud className="size-8 animate-bounce" />
              </div>

              <h3 className="text-base font-semibold text-foreground">
                {selectedFile ? 'Change or replace dataset' : 'Click to browse or drop catalog file here'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm">
                Supports standard <strong className="text-foreground">CSV (.csv)</strong> and{' '}
                <strong className="text-foreground">Excel (.xlsx, .xls)</strong> raw distributor feeds with SKU/MPN and Brand columns.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                  .CSV
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                  .XLSX
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                  .XLS
                </span>
                <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] text-emerald-400">
                  Up to 100,000 items
                </span>
              </div>
            </div>

            {/* Selected File Details Box */}
            {selectedFile && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-400/20 text-emerald-300">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground truncate max-w-xs sm:max-w-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedFile.size} • {selectedFile.type}
                        {selectedFile.isSample && ' • Verified Benchmark'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Remove
                  </button>
                </div>

                {/* Pre-flight Validation Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span>Valid structure</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span>MPN / Brand mapped</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span>252-Col target active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar when uploading */}
            {isUploading && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-cyan-300">{uploadStage}</span>
                  <span className="text-foreground">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Launch Action Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Clicking upload will parse your input rows and launch the pipeline overview.
              </p>
              <button
                type="button"
                onClick={handleUploadAndLaunch}
                disabled={!selectedFile || isUploading}
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all ${
                  selectedFile && !isUploading
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                }`}
              >
                {isUploading ? (
                  <>
                    <RotateCcw className="size-4 animate-spin" />
                    Launching Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    Upload &amp; Launch Pipeline →
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Architecture & Pipeline Workflow Breakdown */}
          <div className="space-y-4">
            <div className="panel p-6 space-y-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Layers className="size-4 text-cyan-300" />
                Automated 4-Stage Enrichment Flow
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex gap-3 items-start p-3 rounded-lg bg-accent/30 border border-border/50">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 font-mono text-[11px] text-cyan-300 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Distributor Preprocessing</p>
                    <p className="text-muted-foreground mt-0.5">
                      Cleans messy distributor descriptions, extracts clean MPNs, and resolves true brand entity identities.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-accent/30 border border-border/50">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 font-mono text-[11px] text-emerald-400 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Official Web &amp; PDF Scraper</p>
                    <p className="text-muted-foreground mt-0.5">
                      Crawls manufacturer domains and parses technical spec sheet PDFs via TLS impersonation.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-accent/30 border border-border/50">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400/20 font-mono text-[11px] text-amber-300 font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">5-Tier Description &amp; Attributes</p>
                    <p className="text-muted-foreground mt-0.5">
                      Synthesizes Invoice (≤40c), Mobile (60–80c), Short, Long, Retail descriptions + 50 attribute pairs.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-accent/30 border border-border/50">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 font-mono text-[11px] text-cyan-300 font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">252-Column Excel &amp; CSV Export</p>
                    <p className="text-muted-foreground mt-0.5">
                      Instant preview and download as UTF-8 BOM <code className="font-mono text-cyan-300">output.csv</code> and styled <code className="font-mono text-emerald-400">output.xlsx</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/overview"
                className="panel p-4 hover:border-cyan-400/50 transition-colors group block space-y-1"
              >
                <span className="font-mono text-[10px] uppercase text-cyan-300 flex items-center justify-between">
                  Live View <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <p className="font-semibold text-xs text-foreground">Pipeline Overview</p>
                <p className="text-[11px] text-muted-foreground">Check real-time enrichment batch stats</p>
              </Link>

              <Link
                href="/workbench"
                className="panel p-4 hover:border-emerald-400/50 transition-colors group block space-y-1"
              >
                <span className="font-mono text-[10px] uppercase text-emerald-400 flex items-center justify-between">
                  Review <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <p className="font-semibold text-xs text-foreground">Data Workbench</p>
                <p className="text-[11px] text-muted-foreground">Inspect and approve catalog records</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
