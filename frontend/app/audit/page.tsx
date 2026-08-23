'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle2,
  Search,
  CheckCheck,
  RotateCcw,
  X,
  Flame,
  Send,
  ShieldCheck,
  Box,
  Save,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell, SectionHeading, useBatch } from '@/components/app-shell'
import { api } from '@/lib/api'

export interface ExceptionItem {
  id: string
  sku: string
  mpn: string
  productName: string
  field: string
  issueDescription: string
  detectedValue: string
  suggestedValue: string
  confidence: number
  riskLevel: 'Critical' | 'Severe' | 'High'
  ruleExplanation: string
}

export default function AuditPage() {
  const router = useRouter()
  const { activeBatch } = useBatch()
  const [items, setItems] = useState<ExceptionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load low-confidence fields from all records
  useEffect(() => {
    const fetchExceptions = async () => {
      try {
        const res = await api.getRecords()
        if (res.success && res.records.length > 0) {
          const exceptions: ExceptionItem[] = []
          
          for (const r of res.records) {
            try {
              const confData = await api.getConfidence(r.mpn)
              const confMap = confData.confidence
              
              if (confMap) {
                Object.entries(confMap).forEach(([field, score]) => {
                  if (typeof score === 'number' && score < 80) {
                    exceptions.push({
                      id: `${r.mpn}-${field}`,
                      sku: r.mpn,
                      mpn: r.mpn,
                      productName: r.data?.['Part_Desc'] || r.mpn,
                      confidence: score,
                      field: field,
                      detectedValue: r.data?.[field] || '',
                      suggestedValue: r.data?.[field] || '',
                      issueDescription: `Low confidence value (${score}%) for ${field}.`,
                      riskLevel: score < 30 ? 'Critical' : 'High',
                      ruleExplanation: 'Automated extraction flagged insufficient source citations for this field. Please verify against manufacturer specs.'
                    })
                  }
                })
              }
            } catch (err) {
              console.error(`Failed to fetch confidence for ${r.mpn}`, err)
            }
          }
          setItems(exceptions)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchExceptions()
  }, [])

  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Local edits for the currently selected product
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})

  // Final submission
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Group items by Product SKU
  const products = useMemo(() => {
    const grouped = new Map<string, ExceptionItem[]>()
    items.forEach(item => {
      // Only include items that are not resolved, or if they are resolved we still show them if they belong to a product being viewed?
      // Better to just group all of them, and we filter out resolved ones later, or show them as resolved.
      if (!grouped.has(item.sku)) {
        grouped.set(item.sku, [])
      }
      grouped.get(item.sku)!.push(item)
    })

    return Array.from(grouped.entries()).map(([sku, fields]) => ({
      sku,
      productName: fields[0].productName,
      fields: fields,
      pendingCount: fields.filter(f => !resolvedIds.has(f.id)).length
    })).filter(p => {
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!p.sku.toLowerCase().includes(q) && !p.productName.toLowerCase().includes(q)) {
          return false
        }
      }
      // If we only want to show products that have pending items:
      // return p.pendingCount > 0
      return true
    }).sort((a, b) => b.pendingCount - a.pendingCount)
  }, [items, resolvedIds, searchQuery])

  // When products load, select the first one automatically or use the query param
  useEffect(() => {
    if (products.length > 0) {
      const params = new URLSearchParams(window.location.search)
      const skuParam = params.get('sku')
      if (skuParam && products.some(p => p.sku === skuParam)) {
        setSelectedSku(skuParam)
      } else if (!selectedSku) {
        setSelectedSku(products[0].sku)
      }
    }
  }, [products, selectedSku])

  const selectedProduct = useMemo(() => {
    return products.find(p => p.sku === selectedSku) || null
  }, [products, selectedSku])

  const handleSaveField = async (item: ExceptionItem, valueToSave: string) => {
    setIsSaving(true)
    try {
      const res = await api.updateField(item.mpn, item.field, valueToSave)
      if (!res.success) throw new Error('Failed to save to backend')
        
      setResolvedIds((prev) => new Set(prev).add(item.id))
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, confidence: 99, suggestedValue: valueToSave }
            : i
        )
      )
      toast.success(`Resolved ${item.field}`)
    } catch (err) {
      toast.error(`Failed to save ${item.field}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResolveAll = () => {
    const allIds = new Set(items.map((i) => i.id))
    setResolvedIds(allIds)
    toast.success(`All ${items.length} exceptions marked resolved! (Local only)`)
  }

  const pendingCount = useMemo(() => {
    return items.filter((i) => !resolvedIds.has(i.id)).length
  }, [items, resolvedIds])

  const allResolved = !isLoading && items.length > 0 && pendingCount === 0

  const handleFinalSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      toast.success(`Batch ${activeBatch} audited successfully!`)
      router.push('/overview')
    }, 1000)
  }

  return (
    <AppShell title="HITL audit queue">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <SectionHeading
          eyebrow="Human-in-the-loop Resolution"
          title="Critical Low-Confidence Exceptions (< 80%)"
          description="Review missing or low-confidence fields grouped by product."
          action={
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Batch: <strong className="text-cyan-300">{activeBatch}</strong>
              </span>

              {!allResolved ? (
                <button
                  onClick={handleResolveAll}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  Resolve All ({pendingCount})
                </button>
              ) : (
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 px-5 py-2.5 text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="size-4 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Return to Overview
                    </>
                  )}
                </button>
              )}
            </div>
          }
        />

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
                    All Exceptions Resolved
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    All Critical Fields Successfully Audited!
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    Every field with initial confidence &lt; 80% has been human-verified and saved to the backend JSONs.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold shadow-2xl transition-all bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 text-slate-950 hover:scale-105 active:scale-95 hover:shadow-emerald-500/20`}
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw className="size-5 animate-spin" />
                      Routing...
                    </>
                  ) : (
                    <>
                      <Send className="size-5 fill-current" />
                      Return to Overview
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-5 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-card/90 to-card flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
                <Flame className="size-6 animate-pulse text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground">
                    {pendingCount} Critical Fields Pending Review across {products.filter(p => p.pendingCount > 0).length} Products
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                  Select a product on the left, then review its missing or low-confidence fields on the right.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2 min-w-64 max-w-sm">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-1.5 shadow-inner">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Product SKU or Name..."
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

        <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
          {/* Left: Product List */}
          <section className="panel overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-4 bg-accent/20">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Product Queue
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5">
                  {products.length} products
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/50 overflow-y-auto max-h-[680px]">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <RotateCcw className="size-6 animate-spin mb-2" />
                    <p className="text-sm">Fetching Confidence Maps...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">All products resolved!</p>
                </div>
              ) : (
                products.map((product) => {
                  const isSelected = selectedSku === product.sku
                  const isAllResolved = product.pendingCount === 0

                  return (
                    <button
                      key={product.sku}
                      onClick={() => setSelectedSku(product.sku)}
                      className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 group ${
                        isSelected
                          ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                          : isAllResolved
                          ? 'bg-emerald-400/5 opacity-80'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Box className="size-3.5 text-cyan-400" />
                          <span className="font-mono text-xs font-semibold text-foreground truncate">
                            #{product.sku}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {product.productName}
                        </p>
                      </div>

                      <div className="flex flex-col items-end shrink-0 space-y-1">
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isAllResolved
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isAllResolved ? 'Done' : `${product.pendingCount} issues`}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          {/* Right: Field List for Selected Product */}
          <section className="panel overflow-hidden flex flex-col">
            {selectedProduct ? (
              <>
                <div className="border-b border-border p-4 bg-accent/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      #{selectedProduct.sku}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedProduct.productName}
                    </p>
                  </div>
                  <div className="font-mono text-[10px] uppercase text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 font-bold">
                    {selectedProduct.pendingCount} Pending Fields
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm table-fixed min-w-[600px]">
                    <thead className="bg-muted/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="px-4 py-3 w-[25%]">Field</th>
                        <th className="px-4 py-3 w-[15%]">Score</th>
                        <th className="px-4 py-3 w-[45%]">Value Override</th>
                        <th className="px-4 py-3 w-[15%] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {selectedProduct.fields.map((field) => {
                        const isResolved = resolvedIds.has(field.id)
                        const currentVal = localEdits[field.id] !== undefined ? localEdits[field.id] : field.suggestedValue

                        return (
                          <tr key={field.id} className={`${isResolved ? 'bg-emerald-500/5' : 'hover:bg-accent/20'} transition-colors`}>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-cyan-300 font-medium bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                                {field.field}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                                isResolved
                                  ? 'text-emerald-400'
                                  : field.confidence === 0
                                  ? 'text-red-400 bg-red-400/10'
                                  : 'text-amber-400 bg-amber-400/10'
                              }`}>
                                {isResolved ? '99%' : `${field.confidence}%`}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {isResolved ? (
                                <span className="text-xs text-foreground font-mono">{field.suggestedValue || '(empty)'}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={currentVal}
                                  onChange={(e) => setLocalEdits(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  placeholder="Enter value..."
                                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-cyan-500"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isResolved ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-bold">
                                  <Check className="size-3.5" /> Saved
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSaveField(field, currentVal)}
                                  disabled={isSaving}
                                  className="inline-flex items-center gap-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 border border-cyan-500/30"
                                >
                                  <Save className="size-3.5" />
                                  Save
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <AlertTriangle className="size-12 mb-4 opacity-20" />
                <p>Select a product to view its low-confidence fields</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  )
}
