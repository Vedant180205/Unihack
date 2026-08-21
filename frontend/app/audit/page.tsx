'use client'

import React, { useState, useMemo } from 'react'
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
  Flame
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue, useBatch } from '@/components/app-shell'

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
    suggestedValue: '3M™ 775L Stikit Hookit Ceramic Disc (5 in, 80 Grit)',
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
    suggestedValue: 'FastenMaster® TimberLOK Heavy Duty Wood Screw (Box of 50)',
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
  const { decrement } = usePendingQueue()
  const { activeBatch } = useBatch()
  const [items, setItems] = useState<ExceptionItem[]>(initialCriticalLowConfidenceItems)
  const [selected, setSelected] = useState<ExceptionItem>(initialCriticalLowConfidenceItems[0])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [customEditValue, setCustomEditValue] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)

  // Strictly filter: confidence < 50% ONLY
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Must have confidence strictly below 50%
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

  const handleApplyCorrection = (item: ExceptionItem) => {
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
    toast.success(`Critical exception resolved for SKU #${item.sku} (Confidence boosted to 99%)`)
  }

  const handleApproveAsIs = (item: ExceptionItem) => {
    setResolvedIds((prev) => new Set(prev).add(item.id))
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, confidence: 95 } : i))
    )
    decrement()
    toast.success(`SKU #${item.sku} manually approved with domain override`)
  }

  const pendingCount = useMemo(() => {
    return items.filter((i) => i.confidence < 50 && !resolvedIds.has(i.id)).length
  }, [items, resolvedIds])

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
              <button
                onClick={() => {
                  if (selected) handleApproveAsIs(selected)
                }}
                disabled={resolvedIds.has(selected.id)}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-95 shadow-md disabled:opacity-50"
              >
                <Check className="size-4" />
                Approve Item
              </button>
            </div>
          }
        />

        {/* Priority Banner Alert */}
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
                Records with confidence ≥ 50% are bypassed or auto-approved. Only severe anomalies (binary corruption, MPN collisions, hybrid threads, counterfeit flags) are surfaced in this queue.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10">
              <span className="text-rose-300">Critical (&lt;30%): </span>
              <strong className="text-rose-200">
                {items.filter((i) => i.confidence < 30 && !resolvedIds.has(i.id)).length}
              </strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10">
              <span className="text-amber-300">Severe (30–49%): </span>
              <strong className="text-amber-200">
                {items.filter((i) => i.confidence >= 30 && i.confidence < 50 && !resolvedIds.has(i.id)).length}
              </strong>
            </div>
          </div>
        </div>

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
                  {filteredItems.length} records flagged below 50% confidence
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
                  <p className="text-xs">No records with confidence &lt; 50% remaining.</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selected.id === item.id
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
                          {item.confidence}%
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
                      #{selected.sku} • {selected.productName}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      MPN: <strong className="text-cyan-300">{selected.mpn}</strong> • Category: {selected.category}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full font-mono text-xs font-bold ${
                        resolvedIds.has(selected.id)
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {selected.confidence}% Confidence ({selected.riskLevel} Risk)
                    </span>
                  </div>
                </div>

                {/* Diff Comparison: Detected vs AI Recommendation */}
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
                        ⚠️ Failure Mode: {selected.issueDescription}
                      </p>
                    </div>
                  </div>

                  {/* Right: Suggested Canonical Value */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-emerald-300 flex items-center gap-1.5 font-semibold">
                        <WandSparkles className="size-3.5 text-emerald-400" /> AI Grounded Resolution
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">99% Confidence Target</span>
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
                        ✓ Grounded in manufacturer spec sheets &amp; 252-column canonical taxonomy.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Rule Rationale Card */}
                <div className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono font-semibold">
                    <WandSparkles className="size-4" />
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
                    disabled={resolvedIds.has(selected.id)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    Approve As-Is
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyCorrection(selected)}
                    disabled={resolvedIds.has(selected.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-5 py-2 text-xs font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    {resolvedIds.has(selected.id) ? 'Resolved' : isEditing ? 'Save Manual Override' : 'Approve & Resolve'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}
