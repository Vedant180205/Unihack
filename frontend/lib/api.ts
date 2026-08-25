export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface AttributeItem {
  label: string;
  value: string;
  uom?: string;
}

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  confidence: number;
  invoice: string;
  mobile: string;
  brand?: string;
  mfr_url?: string;
  image?: string;
  status: string;
  doc_links?: Record<string, string>;
  attributes?: AttributeItem[];
  raw?: Record<string, any>;
}

export interface PipelineStatus {
  is_running: boolean;
  total_rows: number;
  processed_rows: number;
  current_part?: string | null;
  last_error?: string | null;
}

export interface HealthStatus {
  status: string;
  searxng: boolean;
  ollama: boolean;
  output_file_exists: boolean;
  total_records: number;
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    return {
      status: 'offline',
      searxng: false,
      ollama: false,
      output_file_exists: false,
      total_records: 0
    };
  }
}

export async function fetchRecords(): Promise<CatalogItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/pipeline/records`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch records from backend');
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error('Error in fetchRecords:', err);
    throw err;
  }
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/pipeline/status`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pipeline status');
    return await res.json();
  } catch (err) {
    return {
      is_running: false,
      total_rows: 0,
      processed_rows: 0
    };
  }
}

export async function runSingleSKU(sku: string, desc: string, brand: string = ''): Promise<{ status: string; data: CatalogItem }> {
  const res = await fetch(`${API_BASE}/api/pipeline/run-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Mfg_Part_Num: sku,
      Part_Desc: desc,
      Part_Manuf: brand
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || 'Pipeline execution failed');
  }
  return await res.json();
}

export async function uploadBatchCSV(file: File): Promise<{ status: string; message: string; total_rows: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/pipeline/run-batch`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || 'Failed to start batch upload');
  }
  return await res.json();
}

export async function updateCatalogRecord(sku: string, updates: Partial<CatalogItem>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/pipeline/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku,
      name: updates.name,
      category: updates.category,
      invoice: updates.invoice,
      mobile: updates.mobile,
      brand: updates.brand,
      status: updates.status,
      confidence: updates.confidence
    }),
  });
  if (!res.ok) throw new Error('Failed to update record');
  return await res.json();
}

export function getExportUrl(format: 'excel' | 'csv' = 'excel'): string {
  return `${API_BASE}/api/pipeline/export?format=${format}`;
}

