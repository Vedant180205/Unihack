import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  // 1. Try FastAPI
  try {
    const res = await fetch('http://localhost:8000/api/pipeline/records', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // FastAPI offline, fallback to reading output.csv
  }

  // 2. Read directly from local-ai-researcher/backend/output.csv
  const pipelineDir = path.resolve(process.cwd(), '..', '..', 'local-ai-researcher', 'backend');
  const outputCsvPath = path.join(pipelineDir, 'output.csv');

  if (fs.existsSync(outputCsvPath) && fs.statSync(outputCsvPath).size > 0) {
    try {
      const csvText = fs.readFileSync(outputCsvPath, 'utf-8');
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const skuIdx = headers.indexOf('Mfg_Part_Num');
        const descIdx = headers.indexOf('Part_Desc');
        const mfrIdx = headers.indexOf('Part_Manuf') !== -1 ? headers.indexOf('Part_Manuf') : headers.indexOf('MANUFACTURER_NAME');
        const invIdx = headers.indexOf('INVOICE_DESC');
        const mobIdx = headers.indexOf('MOBILE_DESC');
        const urlIdx = headers.indexOf('MFR URL');

        const records = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const sku = cols[skuIdx] || 'UNKNOWN';
          const name = cols[descIdx] || `Part ${sku}`;
          const brand = cols[mfrIdx] || '';
          const invoice = cols[invIdx] || `${sku} ${brand}`.trim().slice(0, 40).toUpperCase();
          const mobile = cols[mobIdx] || `${name} ${brand} ${sku}`.trim().slice(0, 80);
          const mfr_url = cols[urlIdx] || '';

          return {
            sku,
            name,
            category: 'Industrial',
            confidence: invoice ? 94 : 75,
            invoice,
            mobile,
            brand,
            mfr_url,
            image: '',
            status: invoice ? 'Approved' : 'Review',
            attributes: []
          };
        });

        return NextResponse.json({ records });
      }
    } catch (e) {
      console.warn('Failed parsing output.csv in route handler:', e);
    }
  }

  // 3. Default fallback records
  return NextResponse.json({
    records: [
      {
        sku: '4816AF',
        name: 'Hex Bolt M8 x 40mm Zinc',
        category: 'Fasteners',
        confidence: 88,
        invoice: 'HEX BOLT M8X40 ZP',
        mobile: 'Hexagonal head machine bolt, zinc plated steel, M8 thread x 40mm length',
        brand: 'Fastenal',
        mfr_url: 'https://www.fastenal.com',
        image: '',
        status: 'Review',
        attributes: [{ label: 'Thread Size', value: 'M8', uom: 'mm' }]
      },
      {
        sku: '77BC21',
        name: 'Pressure Gauge 0–10 bar',
        category: 'Instrumentation',
        confidence: 97,
        invoice: 'PRESS GAUGE 0-10 BAR',
        mobile: 'Industrial pressure gauge with 0 to 10 bar range and bottom connection',
        brand: 'WIKA',
        mfr_url: 'https://www.wika.com',
        image: '',
        status: 'Approved',
        attributes: [{ label: 'Pressure Range', value: '0-10', uom: 'bar' }]
      }
    ]
  });
}
