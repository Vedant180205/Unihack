'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  Check,
  ChevronRight,
  Maximize2,
  Table as TableIcon,
  ShieldCheck,
  Database,
  ArrowUpDown
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface ExportReportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ExportDataResponse {
  success: boolean
  count: number
  totalColumns: number
  headers: string[]
  columnGroups: Record<string, string[]>
  records: Record<string, string>[]
  hasExcel: boolean
  fileInfo?: {
    csvSize: number
    modifiedAt: string
  }
  message?: string
}

type TabCategory = 'overview' | 'descriptions' | 'features' | 'attributes' | 'logistics' | 'assets' | 'all'

export function ExportReportModal({ isOpen, onClose }: ExportReportModalProps) {
  const [data, setData] = useState<ExportDataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabCategory>('overview')
  const [selectedRecord, setSelectedRecord] = useState<Record<string, string> | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/export')
      const json: ExportDataResponse = await res.json()
      setData(json)
      if (json.records && json.records.length > 0 && !selectedRecord) {
        setSelectedRecord(json.records[0])
      }
    } catch (err: any) {
      toast.error('Failed to load output.csv preview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Filter columns based on active tab
  const displayedColumns = useMemo(() => {
    if (!data?.headers) return []
    if (activeTab === 'all') return data.headers
    const groupCols = data.columnGroups?.[activeTab] || []
    return data.headers.filter((h) => groupCols.includes(h))
  }, [data, activeTab])

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!data?.records) return []
    if (!searchQuery.trim()) return data.records

    const q = searchQuery.toLowerCase()
    return data.records.filter((rec) => {
      return (
        (rec.Mfg_Part_Num || '').toLowerCase().includes(q) ||
        (rec.PART_NUMBER || '').toLowerCase().includes(q) ||
        (rec.MANUFACTURER_NAME || '').toLowerCase().includes(q) ||
        (rec.BRAND_NAME || '').toLowerCase().includes(q) ||
        (rec.Part_Desc || '').toLowerCase().includes(q) ||
        (rec.SHORT_DESC || '').toLowerCase().includes(q) ||
        (rec.INVOICE_DESC || '').toLowerCase().includes(q) ||
        (rec['Product Name'] || '').toLowerCase().includes(q)
      )
    })
  }, [data, searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-background/80 animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-7xl h-[92vh] max-h-[920px] rounded-2xl border border-border/80 bg-card/95 shadow-2xl overflow-hidden"
        style={{
          boxShadow: '0 20px 60px -15px oklch(0.05 0.02 255 / 0.5), 0 0 0 1px oklch(0.3 0.04 255 / 0.4)'
        }}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-6 py-4 bg-accent/20">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 shadow-inner">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Catalog Delivery Report Preview
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  252 Columns Compliant
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preview live enriched records from <code className="font-mono text-cyan-300/90 font-medium">output.csv</code> and download in Excel or CSV format.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh from output.csv"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-cyan-300' : ''}`} />
              Refresh
            </button>

            <a
              href="/api/export?format=xlsx&download=true"
              download="output.xlsx"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 text-xs font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileSpreadsheet className="size-4" />
              Download output.xlsx
            </a>

            <a
              href="/api/export?format=csv&download=true"
              download="output.csv"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 px-4 py-2 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="size-4" />
              Download output.csv
            </a>

            <button
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Telemetry Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-border/50 bg-background/50 text-xs">
          <div className="flex items-center gap-2.5">
            <Database className="size-4 text-cyan-300" />
            <div>
              <span className="text-muted-foreground text-[11px]">Total Records:</span>{' '}
              <span className="font-mono font-semibold text-foreground">{data?.count ?? 0} items</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="size-4 text-emerald-400" />
            <div>
              <span className="text-muted-foreground text-[11px]">Schema Breadth:</span>{' '}
              <span className="font-mono font-semibold text-foreground">252 Attributes</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-amber-300" />
            <div>
              <span className="text-muted-foreground text-[11px]">Encoding:</span>{' '}
              <span className="font-mono font-semibold text-foreground">UTF-8 BOM (Excel Ready)</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-cyan-300" />
            <div>
              <span className="text-muted-foreground text-[11px]">File Formats:</span>{' '}
              <span className="font-mono font-semibold text-foreground">CSV &amp; XLSX</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-border/50 bg-card/40">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'overview', label: 'Overview & IDs' },
              { id: 'descriptions', label: '5 Descriptions' },
              { id: 'features', label: 'Item Features' },
              { id: 'attributes', label: 'Attribute Matrix' },
              { id: 'logistics', label: 'Packaging & Dimensions' },
              { id: 'assets', label: 'Digital Assets' },
              { id: 'all', label: 'All 252 Columns' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabCategory)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 min-w-64 max-w-sm flex-1">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-1.5 shadow-inner">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search SKU, MPN, Brand, or attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </label>
          </div>
        </div>

        {/* Main Content Area (Split between Table & Inspector) */}
        <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-hidden">
          {/* Left / Top: Interactive Table */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-b xl:border-b-0 xl:border-r border-border/60">
            <div className="flex-1 overflow-auto bg-background/30">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <RefreshCw className="size-6 animate-spin text-cyan-300" />
                  <p className="text-xs">Reading delivery records from output.csv...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground text-center p-6">
                  <AlertCircle className="size-8 text-amber-300/80" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No matching delivery records found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      {searchQuery
                        ? 'Try adjusting your search terms.'
                        : 'Run pipeline.py in the backend to populate enriched catalog records.'}
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-card border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground shadow-sm">
                    <tr>
                      <th className="px-4 py-2.5 w-12 bg-card text-center">#</th>
                      <th className="px-4 py-2.5 bg-card">MPN / Part #</th>
                      <th className="px-4 py-2.5 bg-card">Brand / Manuf</th>
                      <th className="px-4 py-2.5 bg-card min-w-48">Product / Title</th>
                      {displayedColumns
                        .filter(
                          (c) =>
                            ![
                              'Mfg_Part_Num',
                              'PART_NUMBER',
                              'BRAND_NAME',
                              'MANUFACTURER_NAME',
                              'Part_Desc',
                              'SHORT_DESC',
                            ].includes(c)
                        )
                        .slice(0, 10)
                        .map((col) => (
                          <th key={col} className="px-4 py-2.5 bg-card whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      <th className="px-4 py-2.5 bg-card text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredRecords.map((record, index) => {
                      const isSelected =
                        selectedRecord?.Mfg_Part_Num === record.Mfg_Part_Num ||
                        selectedRecord?._rowIndex === record._rowIndex

                      return (
                        <tr
                          key={record._rowIndex || index}
                          onClick={() => setSelectedRecord(record)}
                          className={`cursor-pointer transition-colors group ${
                            isSelected
                              ? 'bg-cyan-400/10 hover:bg-cyan-400/15'
                              : 'hover:bg-accent/40'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground text-center">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-cyan-300 whitespace-nowrap">
                            {record.Mfg_Part_Num || record.PART_NUMBER || 'â€”'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-foreground">
                              {record.BRAND_NAME || record.MANUFACTURER_NAME || 'â€”'}
                            </span>
                            {record.MANUFACTURER_NAME && record.BRAND_NAME && record.MANUFACTURER_NAME !== record.BRAND_NAME && (
                              <span className="block text-[10px] text-muted-foreground">
                                {record.MANUFACTURER_NAME}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground line-clamp-1">
                              {record.SHORT_DESC || record.Part_Desc || record['Product Name'] || 'â€”'}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground line-clamp-1">
                              {record.Classpath || 'â€”'}
                            </p>
                          </td>
                          {displayedColumns
                            .filter(
                              (c) =>
                                ![
                                  'Mfg_Part_Num',
                                  'PART_NUMBER',
                                  'BRAND_NAME',
                                  'MANUFACTURER_NAME',
                                  'Part_Desc',
                                  'SHORT_DESC',
                                ].includes(c)
                            )
                            .slice(0, 10)
                            .map((col) => (
                              <td
                                key={col}
                                className="px-4 py-3 text-muted-foreground whitespace-nowrap max-w-xs truncate"
                              >
                                {record[col] ? (
                                  col === 'MFR URL' || col.startsWith('Ref URL') ? (
                                    <a
                                      href={record[col]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                                    >
                                      Link <ExternalLink className="size-2.5" />
                                    </a>
                                  ) : (
                                    record[col]
                                  )
                                ) : (
                                  <span className="text-muted-foreground/40">â€”</span>
                                )}
                              </td>
                            ))}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className={`rounded p-1.5 transition-colors ${
                                isSelected
                                  ? 'bg-cyan-400/20 text-cyan-300'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                              }`}
                            >
                              <ChevronRight className="size-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer with column count status */}
            <div className="flex items-center justify-between border-t border-border px-5 py-2.5 bg-card/60 text-xs text-muted-foreground">
              <span>
                Showing {filteredRecords.length} of {data?.count ?? 0} records
              </span>
              <span className="font-mono text-[11px]">
                Active view: <strong className="text-foreground">{displayedColumns.length}</strong> of{' '}
                <strong className="text-foreground">{data?.totalColumns ?? 252}</strong> columns
              </span>
            </div>
          </div>

          {/* Right / Bottom: Detailed 252-Column Record Inspector */}
          {selectedRecord && (
            <div className="w-full xl:w-[460px] flex flex-col bg-card/90 overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-accent/30">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                    252-Column Record Inspector
                  </p>
                  <h3 className="font-semibold text-sm text-foreground truncate max-w-xs">
                    {selectedRecord.BRAND_NAME || selectedRecord.MANUFACTURER_NAME} {selectedRecord.Mfg_Part_Num}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  {selectedRecord['MFR URL'] && (
                    <a
                      href={selectedRecord['MFR URL']}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-cyan-300 hover:bg-accent"
                    >
                      MFR URL <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* 5 Synthesized Descriptions Card */}
                <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5" /> 5 Synthesized Descriptions
                    </span>
                  </div>

                  {/* Short Title */}
                  {selectedRecord.SHORT_DESC && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Short Product Title</span>
                        <button
                          onClick={() => copyToClipboard(selectedRecord.SHORT_DESC, 'short')}
                          className="hover:text-foreground"
                          title="Copy"
                        >
                          {copiedKey === 'short' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        </button>
                      </div>
                      <p className="font-medium text-foreground bg-card p-2 rounded-md border border-border/50 text-[11px]">
                        {selectedRecord.SHORT_DESC}
                      </p>
                    </div>
                  )}

                  {/* Invoice Description */}
                  {selectedRecord.INVOICE_DESC && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Invoice Desc (â‰¤40 chars)</span>
                        <span className="font-mono text-[10px] text-cyan-300">{selectedRecord.INVOICE_DESC.length}c</span>
                      </div>
                      <p className="font-mono font-medium text-cyan-300 bg-card p-2 rounded-md border border-border/50 text-[11px]">
                        {selectedRecord.INVOICE_DESC}
                      </p>
                    </div>
                  )}

                  {/* Mobile Description */}
                  {selectedRecord.MOBILE_DESC && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Mobile App Desc (60â€“80 chars)</span>
                        <span className="font-mono text-[10px] text-cyan-300">{selectedRecord.MOBILE_DESC.length}c</span>
                      </div>
                      <p className="text-foreground bg-card p-2 rounded-md border border-border/50 text-[11px]">
                        {selectedRecord.MOBILE_DESC}
                      </p>
                    </div>
                  )}

                  {/* Long Description */}
                  {selectedRecord.LONG_DESC1 && (
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Long Description</span>
                      <p className="text-muted-foreground bg-card p-2 rounded-md border border-border/50 text-[11px] leading-relaxed">
                        {selectedRecord.LONG_DESC1}
                      </p>
                    </div>
                  )}

                  {/* Retail Description */}
                  {selectedRecord.RETAIL_DESC && (
                    <div>
                      <span className="block text-[11px] text-muted-foreground mb-1">Retail Description</span>
                      <p className="text-muted-foreground bg-card p-2 rounded-md border border-border/50 text-[11px] leading-relaxed">
                        {selectedRecord.RETAIL_DESC}
                      </p>
                    </div>
                  )}
                </div>

                {/* Key Attributes & Features Matrix */}
                <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3 shadow-inner">
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-emerald-400 block">
                    Enriched Specification Matrix
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {Array.from({ length: 15 }).map((_, i) => {
                      const idx = i + 1
                      const label = selectedRecord[`ATTRIBUTE_LABEL ${idx}`]
                      const val = selectedRecord[`ATTRIBUTE_VALUE ${idx}`]
                      const uom = selectedRecord[`ATTRIBUTE_UOM ${idx}`]

                      if (!label || !val) return null

                      return (
                        <div key={idx} className="bg-card p-2 rounded-md border border-border/40">
                          <span className="block text-[10px] font-mono text-muted-foreground truncate">
                            {label}
                          </span>
                          <span className="font-semibold text-foreground truncate block">
                            {val} {uom}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Features list */}
                  {selectedRecord.ITEM_FEATURES_1 && (
                    <div className="pt-2 border-t border-border/50 space-y-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                        Bullet Features
                      </span>
                      <ul className="space-y-1 text-[11px] text-muted-foreground list-disc list-inside">
                        {Array.from({ length: 8 }).map((_, i) => {
                          const feat = selectedRecord[`ITEM_FEATURES_${i + 1}`]
                          if (!feat) return null
                          return <li key={i} className="line-clamp-2">{feat}</li>
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Digital Assets & Documents */}
                <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 shadow-inner text-[11px]">
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-amber-300 block">
                    Digital Assets &amp; Documentation
                  </span>
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {selectedRecord['Product Image'] && (
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground">Main Image:</span>
                        <span className="text-cyan-300">{selectedRecord['Product Image']}</span>
                      </div>
                    )}
                    {selectedRecord['Specification Sheet'] && (
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground">Spec PDF:</span>
                        <span className="text-emerald-400">{selectedRecord['Specification Sheet']}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Actual Image:</span>
                      <span className="text-foreground">{selectedRecord['Actual Image (Yes/No)'] || 'Yes'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

