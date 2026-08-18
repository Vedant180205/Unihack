import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'excel';

  // 1. Try forwarding to FastAPI backend if active
  try {
    const fastApiResponse = await fetch(`http://localhost:8000/api/pipeline/export?format=${format}`, {
      cache: 'no-store'
    });
    if (fastApiResponse.ok) {
      const blob = await fastApiResponse.arrayBuffer();
      const contentType = fastApiResponse.headers.get('content-type') ||
        (format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const disposition = fastApiResponse.headers.get('content-disposition') ||
        `attachment; filename="output.${format === 'csv' ? 'csv' : 'xlsx'}"`;

      return new NextResponse(blob, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
        }
      });
    }
  } catch (err) {
    console.log('[INFO] FastAPI offline, serving Excel directly from local-ai-researcher/backend/output.csv');
  }

  // 2. Fallback: read directly from local-ai-researcher/backend
  // sahil/Unihack/frontend -> sahil/Unihack -> sahil -> root -> local-ai-researcher/backend
  const pipelineDir = path.resolve(process.cwd(), '..', '..', 'local-ai-researcher', 'backend');
  const outputCsvPath = path.join(pipelineDir, 'output.csv');
  const templateCsvPath = path.join(pipelineDir, 'Unihack__Expected_Output_-_Delivery_Format.csv');

  let csvContent = '';

  if (fs.existsSync(outputCsvPath) && fs.statSync(outputCsvPath).size > 0) {
    csvContent = fs.readFileSync(outputCsvPath, { encoding: 'utf-8', flag: 'r' });
  } else if (fs.existsSync(templateCsvPath)) {
    csvContent = fs.readFileSync(templateCsvPath, { encoding: 'utf-8', flag: 'r' });
  } else {
    csvContent = 'Mfg_Part_Num,Part_Desc,MANUFACTURER_NAME,INVOICE_DESC,MOBILE_DESC\n4816AF,Hex Bolt M8x40mm,Fastenal,HEX BOLT M8X40 ZP,Hexagonal head machine bolt zinc plated';
  }

  // If CSV requested
  if (format.toLowerCase() === 'csv') {
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="output.csv"',
      }
    });
  }

  // Generate Excel (.xlsx) using xlsx
  try {
    const workbook = XLSX.read(csvContent, { type: 'string' });
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Also persist output.xlsx in local-ai-researcher/backend
    try {
      const outputXlsxPath = path.join(pipelineDir, 'output.xlsx');
      fs.writeFileSync(outputXlsxPath, excelBuffer);
      console.log('[OK] Saved output.xlsx to', outputXlsxPath);
    } catch (saveErr) {
      console.warn('[WARN] Failed to write local output.xlsx:', saveErr);
    }

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="output.xlsx"',
      }
    });

  } catch (err: any) {
    console.error('Error generating Excel file:', err);
    return NextResponse.json({ error: 'Failed to generate Excel file', details: err.message }, { status: 500 });
  }
}
