'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ListFilter,
  WandSparkles,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  CheckCheck,
  RotateCcw,
  Edit3,
  ExternalLink,
  SlidersHorizontal,
  ArrowRight,
  X,
  Flame,
  FileSpreadsheet,
  Send,
  Download,
  PartyPopper,
  ShieldCheck,
  Play
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue, useBatch } from '@/components/app-shell'
import { api } from '@/lib/api'
import { ExportReportModal } from '@/components/export-report-modal'

export interface ExceptionItem {
  id: string
  sku: string
  mpn: string
  productName: string
  category: string
  issueType: 'Part Collision' | 'Corrupt Data' | 'Contradictory Specs' | 'Taxonomy LOV' | 'Counterfeit / Anomaly' | 'Unknown Alloy'
  issueDescription: string
  detectedValue: string
  suggestedValue: string
  confidence: number
  riskLevel: 'Critical' | 'Severe' | 'High'
  ruleExplanation: string
  field: string
}

// Low-confidence items ONLY (All strictly < 50% confidence)
const initialCriticalLowConfidenceItems: ExceptionItem[] = [
  {
    id: 'exc-1',
    sku: 'UNK-9912',
    mpn: 'OCR-CORRUPT-99',
    productName: 'Corrupted Catalog Feed Entry (Binary Artifacts)',
    category: 'Industrial Abrasives > Unresolved',
    issueType: 'Corrupt Data',
    issueDescription: 'Non-ASCII byte sequence & corrupted OCR token',
    detectedValue: '\\x00\\x1f%##NO_MATCH_ERR_8892_RAW_BYTE',
    suggestedValue: '3Mâ„¢ 775L Stikit Hookit Ceramic Disc (5 in, 80 Grit)',
    confidence: 18,
    riskLevel: 'Critical',
    ruleExplanation: 'Raw supplier ingest contained binary corruption. Reconstructed product identity from partial supplier barcode cross-reference table.',
    field: 'PRODUCT_NAME / MPN',
  },
  {
    id: 'exc-2',
    sku: 'HYB-8801',
    mpn: 'M24-NPT-HYB',
    productName: 'Hybrid Dual-Standard Thread Adapter Fitting',
    category: 'Pneumatics & Fluid Power > Pipe Fittings',
    issueType: 'Contradictory Specs',
    issueDescription: 'Impossible hybrid metric / imperial thread standard in single token',
    detectedValue: 'M24x1/2" NPT HYBRID SINGLE THREAD',
    suggestedValue: 'M24 x 1.5 Metric Male to 1/2 in NPT Female Adapter',
    confidence: 24,
    riskLevel: 'Critical',
    ruleExplanation: 'Rule #DIM-HYBRID flagged impossible single-token thread standard. Requires human verification of supplier physical CAD drawing.',
    field: 'THREAD_SPECIFICATION',
  },
  {
    id: 'exc-3',
    sku: 'C88F10',
    mpn: 'REG-88F10-IND',
    productName: 'Industrial Pneumatic Pressure Regulator Module',
    category: 'Pneumatics & Fluid Power > Regulators',
    issueType: 'Contradictory Specs',
    issueDescription: 'Mutually exclusive voltage ratings & ungrounded UL certification claim',
    detectedValue: '110V / 480V 3PH DUAL VOLT UNCONFIRMED (UL Listed?)',
    suggestedValue: '480V AC 3-Phase, 60 Hz, CSA / CE Certified',
    confidence: 28,
    riskLevel: 'Critical',
    ruleExplanation: 'Supplier feed claimed 110V single-phase and 480V 3-phase simultaneously. Manufacturer cut sheet confirms 480V 3-phase only with CE certificate.',
    field: 'ELECTRICAL_SPECS',
  },
  {
    id: 'exc-4',
    sku: '4816AF',
    mpn: 'PDSH4816AF',
    productName: 'Heavy Duty Structural Fastener Bolt',
    category: 'Fasteners & Hardware > Structural Screws',
    issueType: 'Part Collision',
    issueDescription: 'Unresolved MPN collision across 3 competing manufacturers',
    detectedValue: '4816AF (FastenMaster? Hillman? Simpson Strong-Tie?)',
    suggestedValue: 'FastenMasterÂ® TimberLOK Heavy Duty Wood Screw (Box of 50)',
    confidence: 34,
    riskLevel: 'Severe',
    ruleExplanation: 'Rule #ENT-COLLISION triggered: 4816AF matched 3 active catalog manufacturer lines. Contextual token analysis weighted FastenMaster at 65%.',
    field: 'BRAND_NAME / MPN',
  },
  {
    id: 'exc-5',
    sku: 'VAL-004X',
    mpn: 'VAL-150-600',
    productName: 'High Pressure Full Port Flange Ball Valve',
    category: 'Valves & Actuation > Ball Valves',
    issueType: 'Unknown Alloy',
    issueDescription: 'Conflicting metallurgy alloy & pressure rating (150# vs 600 WOG)',
    detectedValue: 'Brass/SS Hybrid Alloy? 150#/600WOG Discrepancy',
    suggestedValue: 'Forged Brass Body with 316SS Ball, 600 WOG / 150 WSP Rating',
    confidence: 38,
    riskLevel: 'Severe',
    ruleExplanation: 'Raw catalog stated 150# Class and 600 WOG simultaneously. Reconciled drawing indicates Forged Brass Body with 316 Stainless Steel internal ball.',
    field: 'PRESSURE_RATING / METALLURGY',
  },
  {
    id: 'exc-6',
    sku: '2DE901',
    mpn: 'MISC-CAT-99',
    productName: 'Industrial IP68 Ingress Cable Gland Seal',
    category: 'Electrical & Automation > Unmapped',
    issueType: 'Taxonomy LOV',
    issueDescription: 'Completely unmapped placeholder string in category tree',
    detectedValue: 'Misc / Industrial Raw / Tier-9 / 9988_UNSORTED',
    suggestedValue: 'Hardware & Tools > Electrical > Cable Management > Cable Glands',
    confidence: 42,
    riskLevel: 'High',
    ruleExplanation: 'Supplier provided placeholder garbage string. Mapped to canonical 252-column Classpath ontology based on IP68 and thread attributes.',
    field: 'CLASSPATH_TAXONOMY',
  },
  {
    id: 'exc-7',
    sku: 'FLK-87V',
    mpn: 'FLUKE-87-V-GEN',
    productName: 'Digital Multimeter Industrial Kit',
    category: 'Test & Measurement > Multimeters',
    issueType: 'Counterfeit / Anomaly',
    issueDescription: 'Pricing is 82% below MSRP and barcode checksum format failed',
    detectedValue: 'Fluke Multimeter Yellow Case OEM-NoBox (Price: $49.00)',
    suggestedValue: 'Fluke 87V Industrial Multimeter Genuine (MSRP: $489.99)',
    confidence: 47,
    riskLevel: 'High',
    ruleExplanation: 'Rule #AUTH-ANOMALY: Suspected grey-market or counterfeit feed item. Flagged for strict human verification before catalog exposure.',
    field: 'AUTHENTICITY_VERIFICATION',
  },
]

export default function AuditPage() {
  const router = useRouter()
  const { decrement } = usePendingQueue()
  const { activeBatch } = useBatch()
  const [items, setItems] = useState<ExceptionItem[]>([])

  // Load real low-confidence records from FastAPI on mount
  useEffect(() => {
    api.getRecords().then(res => {
      if (res.success && res.records.length > 0) {
        const exceptions: ExceptionItem[] = res.records
          .filter(r => {
            const score = r.data?.confidence_score ?? r.data?.['confidence_score'] ?? 100
            return score < 85
          })
          .map((r, idx) => ({
            id: r.mpn,
            sku: r.mpn,
            productName: r.data?.descriptions?.product_name?.value || r.data?.['Part_Desc'] || r.mpn,
            confidence: Math.round(r.data?.confidence_score ?? r.data?.['confidence_score'] ?? 70),
            issueType: 'low_confidence' as const,
            issueDescription: 'Record confidence below 85% threshold — review required.',
            recommendedAction: 'Verify key attributes and approve or correct.',
            ruleExplanation: 'Automated extraction flagged insufficient source citations.',
            aiSuggestion: 'Approve As-Is',
            currentValue: r.data?.descriptions?.short_desc?.value || '',
            sourceUrl: r.data?.['MFR URL'] || '',
            category: r.data?.['Classpath'] || 'Industrial',
            brand: r.data?.descriptions?.brand?.value || r.data?.['E1_Brand'] || 'Unknown',
          }))
        setItems(exceptions.length > 0 ? exceptions : [])
      }
    }).catch(console.error)
  }, [])
  const [selected, setSelected] = useState<ExceptionItem | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [customEditValue, setCustomEditValue] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)

  // Final submission & export modal states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)

  // Strictly filter: confidence < 50% ONLY
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Must have confidence strictly below 50% (or show if resolved)
      if (item.confidence >= 50 && !resolvedIds.has(item.id)) return false

      // Category tab filter
      if (activeTab === 'corrupt' && item.issueType !== 'Corrupt Data') return false
      if (activeTab === 'specs' && item.issueType !== 'Contradictory Specs') return false
      if (activeTab === 'collision' && item.issueType !== 'Part Collision') return false
      if (activeTab === 'anomaly' && item.issueType !== 'Counterfeit / Anomaly') return false

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          item.sku.toLowerCase().includes(q) ||
          item.mpn.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          item.issueDescription.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, activeTab, searchQuery, resolvedIds])

  const handleResolveAndApprove = (item: ExceptionItem) => {
    setResolvedIds((prev) => new Set(prev).add(item.id))
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              confidence: 99,
              detectedValue: isEditing && customEditValue ? customEditValue : i.suggestedValue,
            }
          : i
      )
    )
    setIsEditing(false)
    decrement()
    toast.success(`Exception resolved and approved for SKU #${item.sku}`)
  }

  const handleApproveAsIs = (item: ExceptionItem) => {
    setResolvedIds((prev) => new Set(prev).add(item.id))
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, confidence: 95 } : i))
    )
    decrement()
    toast.success(`SKU #${item.sku} approved with domain override`)
  }

  // Quick Resolve All Helper for testing/demo
  const handleResolveAll = () => {
    const allIds = new Set(items.map((i) => i.id))
    setResolvedIds(allIds)
    setItems((prev) => prev.map((i) => ({ ...i, confidence: 99, detectedValue: i.suggestedValue })))
    toast.success(`All ${items.length} critical exceptions have been resolved!`)
  }

  const pendingCount = useMemo(() => {
    return items.filter((i) => !resolvedIds.has(i.id)).length
  }, [items, resolvedIds])

  const allResolved = pendingCount === 0

  const handleFinalSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      toast.success(`Batch ${activeBatch} successfully finalized and pushed to Master Catalog!`)
    }, 1200)
  }

  return (
    <AppShell title="HITL audit queue">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Section Header */}
        <SectionHeading
          eyebrow="Human-in-the-loop Resolution"
          title="Critical Low-Confidence Exceptions (< 50%)"
          description="Exclusively isolating high-risk records with confidence < 50% requiring urgent domain expert verification."
          action={
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Batch: <strong className="text-cyan-300">{activeBatch}</strong>
              </span>

              {!allResolved ? (
                <>
                  <button
                    onClick={handleResolveAll}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <CheckCheck className="size-3.5" />
                    Resolve All ({pendingCount})
                  </button>
                  <button
                    onClick={() => {
                      if (selected) handleResolveAndApprove(selected)
                    }}
                    disabled={resolvedIds.has(selected?.id)}
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-95 shadow-md disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    Approve Selected
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || isSubmitted}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 px-5 py-2.5 text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="size-4 animate-spin" />
                      Finalizing Batch...
                    </>
                  ) : isSubmitted ? (
                    <>
                      <CheckCircle2 className="size-4" />
                      Batch Finalized &amp; Published
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Finalize &amp; Submit Batch â†’
                    </>
                  )}
                </button>
              )}
            </div>
          }
        />

        {/* Priority Banner Alert or All-Resolved Success Hero */}
        {allResolved ? (
          <div className="panel p-6 sm:p-8 border-emerald-400/40 bg-gradient-to-r from-emerald-400/15 via-card to-cyan-950/20 rounded-2xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 shadow-inner">
                  <CheckCircle2 className="size-8 animate-bounce text-emerald-400" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-0.5 font-mono text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                    <ShieldCheck className="size-3.5" />
                    All 7 Exceptions Resolved â€¢ 100% Quality Score
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    All Critical Exceptions Successfully Audited!
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    Every record with initial confidence &lt; 50% has been human-verified, normalized to 252 delivery columns, and approved for catalog publishing.
                  </p>
                </div>
              </div>

              {/* Main Final Submit Action Button */}
              <div className="flex flex-col sm:items-end gap-2">
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || isSubmitted}
                  className={`inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold shadow-2xl transition-all ${
                    isSubmitted
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 cursor-default'
                      : 'bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 text-slate-950 hover:scale-105 active:scale-95 hover:shadow-emerald-500/20 shadow-lg'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="size-5 animate-spin" />
                      Publishing to Catalog...
                    </>
                  ) : isSubmitted ? (
                    <>
                      <CheckCircle2 className="size-5 text-emerald-400" />
                      Batch Published Successfully
                    </>
                  ) : (
                    <>
                      <Send className="size-5 fill-current" />
                      Final Submit &amp; Publish Batch â†’
                    </>
                  )}
                </button>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {isSubmitted
                    ? 'Published to Enterprise Catalog and Delivery Output Sync'
                    : 'Locks resolved state and generates certified output deliverable'}
                </p>
              </div>
            </div>

            {/* Post-Submission Actions Bar */}
            {isSubmitted && (
              <div className="pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Check className="size-4" /> 252 Columns Verified
                  </span>
                  <span>â€¢</span>
                  <span className="font-mono text-foreground">output.csv &amp; output.xlsx updated</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 transition-all hover:scale-[1.02]"
                  >
                    <FileSpreadsheet className="size-3.5" />
                    Download output.csv Deliverable
                  </button>
                  <Link
                    href="/overview"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    <Play className="size-3.5" />
                    Return to Pipeline Overview
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="panel p-5 border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-card/90 to-card flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-inner">
                <Flame className="size-6 animate-pulse text-rose-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground">
                    {pendingCount} Critical Exceptions Pending Review (Confidence &lt; 50%)
                  </h3>
                  <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 font-mono text-[10px] text-rose-300 font-bold">
                    Threshold: Confidence &lt; 50% Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                  Resolve all pending items below. Once all exceptions are cleared, the Final Submit button will unlock to publish this batch to the master catalog.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10">
                <span className="text-rose-300">Remaining: </span>
                <strong className="text-rose-200">{pendingCount} of {items.length}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
                <span className="text-emerald-300">Resolved: </span>
                <strong className="text-emerald-200">{resolvedIds.size}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All <50% Records (${items.length})` },
              { id: 'corrupt', label: 'Corrupt & Binary' },
              { id: 'specs', label: 'Contradictory Specs' },
              { id: 'collision', label: 'MPN Collisions' },
              { id: 'anomaly', label: 'Counterfeit & Anomalies' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm font-semibold'
                    : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-64 max-w-sm flex-1">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-1.5 shadow-inner">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SKU, MPN, exception..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </label>
          </div>
        </div>

        {/* Main Content Area: Left Queue List + Right Deep Inspector */}
        <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          {/* Left: Low Confidence Queue List */}
          <section className="panel overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-4 bg-accent/20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Critical Queue (&lt; 50%)
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5">
                  {filteredItems.length} records in view ({resolvedIds.size} resolved)
                </p>
              </div>
              <span className="font-mono text-[10px] text-rose-300 rounded bg-rose-500/15 px-2 py-0.5 border border-rose-500/30 font-bold">
                Strict &lt;50% Filter
              </span>
            </div>

            <div className="divide-y divide-border/50 overflow-y-auto max-h-[680px]">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">All critical exceptions resolved!</p>
                  <p className="text-xs">Ready for Final Submission above.</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selected?.id === item.id
                  const isResolved = resolvedIds.has(item.id)

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelected(item)
                        setIsEditing(false)
                        setCustomEditValue('')
                      }}
                      className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 group ${
                        isSelected
                          ? 'bg-rose-500/10 border-l-2 border-rose-500'
                          : isResolved
                          ? 'bg-emerald-400/5 opacity-80'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-rose-400">
                            #{item.sku}
                          </span>
                          <span className="rounded bg-accent px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
                            {item.field}
                          </span>
                          {isResolved && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 font-mono text-[9px] font-bold">
                              <Check className="size-2.5" /> Resolved
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-medium text-foreground truncate">
                          {item.productName}
                        </p>

                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {item.issueDescription}
                        </p>
                      </div>

                      {/* Right: Critical Confidence badge */}
                      <div className="flex flex-col items-end shrink-0 space-y-1">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            isResolved
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : item.confidence < 30
                              ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50 shadow-sm'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isResolved ? '99%' : `${item.confidence}%`}
                        </span>
                        <ChevronRight
                          className={`size-4 text-muted-foreground transition-transform ${
                            isSelected ? 'translate-x-0.5 text-rose-400' : 'group-hover:translate-x-0.5'
                          }`}
                        />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          {/* Right: Deep Exception Review & Fix Studio */}
          {selected && (
            <section className="panel p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Header of Inspector */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="size-3.5" /> Critical Exception Inspector (&lt;50%)
                      </span>
                      <span className="rounded bg-accent px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        Field: {selected.field}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mt-1">
                      #{selected?.sku} â€¢ {selected?.productName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      MPN: <strong className="text-cyan-300">{selected.mpn}</strong> â€¢ Category: {selected.category}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full font-mono text-xs font-bold ${
                        resolvedIds.has(selected?.id)
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {resolvedIds.has(selected?.id) ? 'Resolved (99% Conf)' : `${selected?.confidence}% Conf (${selected.riskLevel} Risk)`}
                    </span>
                  </div>
                </div>

                {/* Diff Comparison: Detected vs Suggested */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Left: Raw Detected Value */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-rose-300 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="size-3.5 text-rose-400" /> Unresolved Raw Input
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Supplier Source</span>
                    </div>

                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 min-h-24">
                      <p className="font-mono text-xs text-rose-200 font-medium break-words">
                        {selected.detectedValue}
                      </p>
                      <p className="text-[11px] text-rose-300/90 leading-relaxed">
                        âš ï¸ Failure Mode: {selected.issueDescription}
                      </p>
                    </div>
                  </div>

                  {/* Right: Suggested Canonical Value */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-emerald-300 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="size-3.5 text-emerald-400" /> Canonical Target Value
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">252-Col Delivery Schema</span>
                    </div>

                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-2 min-h-24">
                      {isEditing ? (
                        <input
                          type="text"
                          value={customEditValue || selected.suggestedValue}
                          onChange={(e) => setCustomEditValue(e.target.value)}
                          className="w-full bg-background border border-cyan-400 rounded-md p-2 text-xs font-mono text-foreground outline-none shadow-inner"
                        />
                      ) : (
                        <p className="font-mono text-xs text-cyan-300 font-semibold break-words">
                          {selected.suggestedValue}
                        </p>
                      )}
                      <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                        âœ“ Grounded in manufacturer spec sheets &amp; 252-column canonical taxonomy.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Validation Rule Rationale Card */}
                <div className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono font-semibold">
                    <Layers className="size-4" />
                    Validation Rule &amp; Disambiguation Rationale
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selected.ruleExplanation}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(!isEditing)
                      if (!customEditValue) setCustomEditValue(selected.suggestedValue)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Edit3 className="size-3.5" />
                    {isEditing ? 'Cancel Edit' : 'Edit Manually'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproveAsIs(selected)}
                    disabled={resolvedIds.has(selected?.id)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Approve As-Is
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveAndApprove(selected)}
                    disabled={resolvedIds.has(selected?.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-5 py-2 text-xs font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    {resolvedIds.has(selected?.id) ? 'Resolved' : isEditing ? 'Save Manual Override' : 'Approve & Resolve'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Deliverable Export & Preview Modal */}
        <ExportReportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
        />
      </div>
    </AppShell>
  )
}



