/**
 * api.ts — Typed API client for FastAPI backend (http://localhost:8000)
 * All backend calls go through here. Change BASE_URL for deployment.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResponse {
  filename: string
  saved_path: string
  row_count: number
}

export interface PipelineRunRequest {
  input_path?: string  // path returned by upload; uses default CSV if omitted
  limit?: number
  skip?: number
}

export interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  processed: number
  total: number
  error?: string | null
}

export interface ProductRecord {
  mpn: string
  last_modified: number
  data: {
    raw_attributes?: Record<string, { value: string; source: string }>
    identifiers?: Record<string, { value: string; source: string }>
    dimensions?: Record<string, { value: string; uom: string; source: string }>
    descriptions?: {
      product_name?: { value: string; source: string }
      short_desc?: { value: string; source: string }
      long_desc?: { value: string; source: string }
      brand?: { value: string; source: string }
      product_type?: { value: string; source: string }
      key_features?: { value: string[]; source: string }
      warranty?: { value: string; source: string }
    }
    pricing?: {
      list_price?: { value: string; source: string }
      currency?: { value: string; source: string }
    }
    documents?: Record<string, { value: string; source: string }>
    images?: Record<string, { value: string; source: string }>
    // delivery dict (from older JSON outputs)
    confidence_score?: number
    INVOICE_DESC?: string
    MOBILE_DESC?: string
    [key: string]: any
  }
}

export interface RecordsResponse {
  success: boolean
  count: number
  records: ProductRecord[]
}

export interface CsvPreviewResponse {
  success: boolean
  page: number
  limit: number
  total_rows: number
  total_pages: number
  rows: Record<string, string>[]
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const api = {

  /** Fetch paginated raw CSV rows. */
  async getCsvPreview(path: string | null = null, page: number = 1, limit: number = 50): Promise<CsvPreviewResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (path) params.append('path', path)
    const res = await fetch(`${BASE_URL}/api/csv/preview?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch CSV preview')
    return res.json()
  },

  /** Upload a CSV file. Returns saved server path and row count. */
  async upload(file: File): Promise<UploadResponse> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/api/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Upload failed (${res.status})`)
    }
    return res.json()
  },

  /** Launch the enrichment pipeline as a background job. */
  async runPipeline(req: PipelineRunRequest = {}): Promise<JobStatus> {
    const res = await fetch(`${BASE_URL}/api/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: req.limit ?? 1, skip: req.skip ?? 0, input_path: req.input_path }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Pipeline start failed (${res.status})`)
    }
    return res.json()
  },

  /** Poll a specific job's status. */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await fetch(`${BASE_URL}/api/pipeline/status/${jobId}`)
    if (!res.ok) throw new Error(`Job ${jobId} not found`)
    return res.json()
  },

  /** Fetch all extracted product records from backend/output/. */
  async getRecords(): Promise<RecordsResponse> {
    const res = await fetch(`${BASE_URL}/api/records`)
    if (!res.ok) throw new Error('Failed to fetch records')
    return res.json()
  },

  /** Open CSV download in new tab. */
  downloadCsv() {
    window.open(`${BASE_URL}/api/export/csv`, '_blank')
  },

  /** Open XLSX download in new tab. */
  downloadXlsx() {
    window.open(`${BASE_URL}/api/export/xlsx`, '_blank')
  },

  /** Health check. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/health`)
      return res.ok
    } catch {
      return false
    }
  },
}

