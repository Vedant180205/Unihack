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
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, usePendingQueue, useBatch } from '@/components/app-shell'

export interface ExceptionItem {
  id: string
  sku: string
  mpn: string
  productName: string
  category: string
  issueType: 'UOM / Fraction' | 'Description Length' | 'Taxonomy LOV' | 'Brand Resolution' | 'Missing Attribute'
  issueDescription: string
  detectedValue: string
  suggestedValue: string
  confidence: number
  riskLevel: 'High' | 'Medium' | 'Low'
  ruleExplanation: string
  field: string
}

// Low-confidence items ONLY (All < 90% confidence)
const initialLowConfidenceItems: ExceptionItem[] = [
  {
    id: 'exc-1',
    sku: '4816AF',
    mpn: 'PDSH4816AF',
    productName: 'Hex Head Machine Bolt M8 x 40mm',
    category: 'Fasteners & Hardware > Bolts',
    issueType: 'UOM / Fraction',
    issueDescription: 'Decimal trade fraction not normalized',
    detectedValue: '0.375 in diameter x 1.5 in length',
    suggestedValue: '3/8 in x 1-1/2 in',
    confidence: 72,
    riskLevel: 'High',
    ruleExplanation: 'Rule #FRACT-04 requires standardizing industrial decimal inches to fractional trade representations (0.375 in → 3/8 in).',
    field: 'Dimensions / Size',
  },
  {
    id: 'exc-2',
    sku: '2DE901',
    mpn: 'LAPP-53112000',
    productName: 'Skintop Nylon Cable Gland M20 IP68',
    category: 'Electrical & Automation > Cable Management',
    issueType: 'Taxonomy LOV',
    issueDescription: 'Unmapped supplier category string',
    detectedValue: 'Electrical / Wiring / Misc / Other',
    suggestedValue: 'Hardware & Tools > Electrical > Cable Glands',
    confidence: 81,
    riskLevel: 'Medium',
    ruleExplanation: 'Raw category is ambiguous and does not match the canonical 252-column Classpath ontology.',
    field: 'Classpath',
  },
  {
    id: 'exc-3',
    sku: 'C88F10',
    mpn: 'REG-88F10-IND',
    productName: 'Modular High Pressure Air Regulator Assembly',
    category: 'Pneumatics & Fluid Power > Regulators',
    issueType: 'Description Length',
    issueDescription: 'Invoice description exceeds 40 characters (48 chars)',
    detectedValue: 'INDUSTRIAL HIGH PRESSURE AIR REGULATOR ASSEMBLY WITH GAUGE',
    suggestedValue: 'IND HIGH PRESS AIR REGULATOR ASM',
    confidence: 86,
    riskLevel: 'Medium',
    ruleExplanation: 'Rule #DESC-INV mandates invoice descriptions must be strict uppercase and ≤40 characters (current: 48 chars).',
    field: 'INVOICE_DESC',
  },
  {
    id: 'exc-4',
    sku: '556012-B',
    mpn: 'APO-70-100-01',
    productName: 'Stainless Steel Flange Ball Valve 2 in 150#',
    category: 'Valves & Actuation > Ball Valves',
    issueType: 'Missing Attribute',
    issueDescription: 'Unspecified stainless steel metallurgy grade',
    detectedValue: 'Stainless Steel Body',
    suggestedValue: '316 Stainless Steel (CF8M)',
    confidence: 84,
    riskLevel: 'Medium',
    ruleExplanation: 'Spec sheet references CF8M / 316 metallurgy. Standardized material LOV requires precise grade annotation.',
    field: 'Material Grade',
  },
  {
    id: 'exc-5',
    sku: '445100-M',
    mpn: 'TMK-SET-45',
    productName: 'Single Row Tapered Roller Bearing Set',
    category: 'Bearings & Power Transmission > Roller Bearings',
    issueType: 'UOM / Fraction',
    issueDescription: 'Missing unit of measure on inside diameter',
    detectedValue: '45 inside bore',
    suggestedValue: '45 mm',
    confidence: 78,
    riskLevel: 'High',
    ruleExplanation: 'Raw supplier attribute provided a naked integer without UOM. Matched manufacturer catalog drawing to metric millimeters.',
    field: 'ATTRIBUTE_UOM 1 (Bore)',
  },
  {
    id: 'exc-6',
    sku: 'FLK-87V',
    mpn: 'FLUKE-87-V/E2',
    productName: 'Industrial Electrician Combo Multimeter Kit',
    category: 'Test & Measurement > Multimeters',
    issueType: 'Brand Resolution',
    issueDescription: 'Ambiguous distributor brand representation',
    detectedValue: 'Fluke Corp / Industrial Test Div (9901)',
    suggestedValue: 'Fluke®',
    confidence: 76,
    riskLevel: 'High',
    ruleExplanation: 'Rule #BRAND-SYN mandates registered trademark symbol for canonical manufacturer entities.',
    field: 'BRAND_NAME',
  },
  {
    id: 'exc-7',
    sku: 'DW-4501',
    mpn: 'DCD996B',
    productName: '20V MAX XR Brushless 3-Speed Hammerdrill',
    category: 'Power Tools > Drills & Drivers',
    issueType: 'Description Length',
    issueDescription: 'Mobile description outside 60–80 char boundary (94 chars)',
    detectedValue: 'DEWALT 20V MAX XR brushless high-power hammer drill tool only with LED worklight and belt clip',
    suggestedValue: 'DEWALT 20V MAX XR brushless 3-speed hammer drill bare tool with worklight',
    confidence: 68,
    riskLevel: 'High',
    ruleExplanation: 'Rule #DESC-MOB mandates mobile app descriptions strictly within 60 to 80 characters (suggested is 73 characters).',
    field: 'MOBILE_DESC',
  },
]

export default function AuditPage() {
  const { decrement } = usePendingQueue()
  const { activeBatch } = useBatch()
  const [items, setItems] = useState<ExceptionItem[]>(initialLowConfidenceItems)
  const [selected, setSelected] = useState<ExceptionItem>(initialLowConfidenceItems[0])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [customEditValue, setCustomEditValue] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)

  // Filter items: only low confidence (<90%) matching search and tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Must be low confidence (<90%)
      if (item.confidence >= 90 && !resolvedIds.has(item.id)) return false

      // Category tab filter
      if (activeTab === 'uom' && item.issueType !== 'UOM / Fraction') return false
      if (activeTab === 'desc' && item.issueType !== 'Description Length') return false
      if (activeTab === 'taxonomy' && item.issueType !== 'Taxonomy LOV') return false
      if (activeTab === 'brand' && item.issueType !== 'Brand Resolution') return false

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
              confidence: 98,
              detectedValue: isEditing && customEditValue ? customEditValue : i.suggestedValue,
            }
          : i
      )
    )
    setIsEditing(false)
    decrement()
    toast.success(`Correction applied for SKU #${item.sku} (Confidence boosted to 98%)`)
  }

  const handleApproveAsIs = (item: ExceptionItem) => {
    setResolvedIds((prev) => new Set(prev).add(item.id))
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, confidence: 95 } : i))
    )
    decrement()
    toast.success(`SKU #${item.sku} approved manually as exception`)
  }

  const pendingCount = useMemo(() => {
    return items.filter((i) => !resolvedIds.has(i.id)).length
  }, [items, resolvedIds])

  return (
    <AppShell title="HITL audit queue">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Section Header */}
        <SectionHeading
          eyebrow="Human-in-the-loop Resolution"
          title="Low-Confidence Exception Audit"
          description="Exclusively displaying records with confidence < 90% that require domain expert review before publication."
          action={
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Batch: <strong className="text-cyan-300">{activeBatch}</strong>
              </span>
              <button
                onClick={() => {
                  if (selected) handleApplyCorrection(selected)
                }}
                disabled={resolvedIds.has(selected.id)}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 px-4 py-2.5 text-sm font-semibold hover:opacity-95 shadow-md disabled:opacity-50"
              >
                <WandSparkles className="size-4" />
                Apply AI Fix to Selected
              </button>
            </div>
          }
        />

        {/* Priority Banner Alert */}
        <div className="panel p-5 border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-card/90 to-card flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-inner">
              <ShieldAlert className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">
                  {pendingCount} Low-Confidence Exceptions Pending Review
                </h3>
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-mono text-[10px] text-amber-300 font-bold">
                  Score &lt; 90% Filter Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                High-confidence items (90%+) have been automatically approved. Only borderline items with ambiguous trade fractions, length overages, or unmapped taxonomy are routed here.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg border border-border/80 bg-background/80">
              <span className="text-muted-foreground">High Risk (&lt;75%): </span>
              <strong className="text-rose-400">
                {items.filter((i) => i.confidence < 75 && !resolvedIds.has(i.id)).length}
              </strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-border/80 bg-background/80">
              <span className="text-muted-foreground">Medium Risk (75–89%): </span>
              <strong className="text-amber-300">
                {items.filter((i) => i.confidence >= 75 && i.confidence < 90 && !resolvedIds.has(i.id)).length}
              </strong>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `All Low Confidence (${items.length})` },
              { id: 'uom', label: 'Trade Fractions & UOM' },
              { id: 'desc', label: 'Description Limits' },
              { id: 'taxonomy', label: 'Taxonomy LOV' },
              { id: 'brand', label: 'Brand Resolution' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 shadow-sm font-semibold'
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
                placeholder="Search SKU, MPN, issue..."
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
                  Exception Queue
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5">
                  {filteredItems.length} items flagged for human verification
                </p>
              </div>
              <span className="font-mono text-[10px] text-cyan-300 rounded bg-cyan-400/10 px-2 py-0.5 border border-cyan-400/30">
                Sorted by Risk
              </span>
            </div>

            <div className="divide-y divide-border/50 overflow-y-auto max-h-[680px]">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">All exceptions in this category resolved!</p>
                  <p className="text-xs">No pending items requiring review.</p>
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
                          ? 'bg-cyan-400/10 border-l-2 border-cyan-400'
                          : isResolved
                          ? 'bg-emerald-400/5 opacity-80'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-cyan-300">
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

                      {/* Right: Confidence badge */}
                      <div className="flex flex-col items-end shrink-0 space-y-1">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            isResolved
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : item.confidence < 75
                              ? 'bg-rose-400/20 text-rose-300 border border-rose-400/30'
                              : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          {item.confidence}%
                        </span>
                        <ChevronRight
                          className={`size-4 text-muted-foreground transition-transform ${
                            isSelected ? 'translate-x-0.5 text-cyan-300' : 'group-hover:translate-x-0.5'
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
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300 font-semibold">
                        Field Exception Inspector
                      </span>
                      <span className="rounded bg-accent px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        Target Field: {selected.field}
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
                          : selected.confidence < 75
                          ? 'bg-rose-400/20 text-rose-300 border border-rose-400/30'
                          : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
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
                      <span className="font-mono text-[11px] text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5" /> Raw Unnormalized Value
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Supplier Raw Feed</span>
                    </div>

                    <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 space-y-2 min-h-24">
                      <p className="font-mono text-xs text-foreground font-medium break-words">
                        {selected.detectedValue}
                      </p>
                      <p className="text-[11px] text-rose-300/90 leading-relaxed">
                        ⚠️ {selected.issueDescription}
                      </p>
                    </div>
                  </div>

                  {/* Right: Suggested Canonical Value */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-emerald-300 flex items-center gap-1.5">
                        <WandSparkles className="size-3.5" /> AI Recommended Fix
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">98% Target Precision</span>
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
                        ✓ Normalized to 252-column canonical delivery standard.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Rule Rationale Card */}
                <div className="rounded-xl border border-cyan-400/30 bg-accent/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono font-semibold">
                    <WandSparkles className="size-4" />
                    Validation Rule &amp; Grounding Evidence
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
                    className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Approve As-Is
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyCorrection(selected)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-5 py-2 text-xs font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Check className="size-4" />
                    {resolvedIds.has(selected.id) ? 'Saved' : 'Apply AI Correction (98% Conf)'}
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
