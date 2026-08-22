import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Points to backend/output/output.csv (new FastAPI output location)
function getOutputPaths() {
  const csvPath = path.join(process.cwd(), '..', 'backend', 'output', 'output.csv')
  const xlsxPath = csvPath.replace(/\.csv$/, '.xlsx')
  return { csvPath, xlsxPath }
}

function parseCSV(content: string): string[][] {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]
    if (char === '"') {
      if (inQuotes && nextChar === '"') { currentVal += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal); currentVal = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++
      currentRow.push(currentVal)
      if (!(currentRow.length === 1 && currentRow[0] === '')) rows.push(currentRow)
      currentRow = []; currentVal = ''
    } else { currentVal += char }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal)
    if (!(currentRow.length === 1 && currentRow[0] === '')) rows.push(currentRow)
  }
  return rows
}

const COLUMN_GROUPS = {
  overview: ['MFR URL','Ref URL 1','PART_NUMBER','SKU - MY_PART_NUMBER','Mfg_Part_Num','Part_Desc','MANUFACTURER_NAME','BRAND_NAME','TRADE_NAME','Classpath','Product Name'],
  descriptions: ['INVOICE_DESC','MOBILE_DESC','SHORT_DESC','LONG_DESC1','RETAIL_DESC','MARKETING_DESCRIPTION'],
  features: ['With','Standard/Approvals','Prop 65','Application','Includes','ITEM_FEATURES_1','ITEM_FEATURES_2','ITEM_FEATURES_3','ITEM_FEATURES_4','ITEM_FEATURES_5'],
  attributes: ['ATTRIBUTE_LABEL 1','ATTRIBUTE_VALUE 1','ATTRIBUTE_UOM 1','ATTRIBUTE_LABEL 2','ATTRIBUTE_VALUE 2','ATTRIBUTE_UOM 2','ATTRIBUTE_LABEL 3','ATTRIBUTE_VALUE 3','ATTRIBUTE_UOM 3','ATTRIBUTE_LABEL 4','ATTRIBUTE_VALUE 4','ATTRIBUTE_UOM 4','ATTRIBUTE_LABEL 5','ATTRIBUTE_VALUE 5','ATTRIBUTE_UOM 5'],
  logistics: ['UPC','EAN','GTIN','UNSPSC','Warranty','List Price','Selling Qty','Selling UOM','LENGTH','LENGTH_UOM','HEIGHT','HEIGHT_UOM','WIDTH','WIDTH_UOM','WEIGHT','WEIGHT_UOM'],
  assets: ['Product Image','Alternate Image 1','Alternate Image 2','Specification Sheet','SDS','Instruction/Installation Manual','Owners/User Manual','Actual Image (Yes/No)'],
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  const { csvPath, xlsxPath } = getOutputPaths()

  if (format === 'xlsx') {
    if (!fs.existsSync(/*turbopackIgnore: true*/ xlsxPath)) return new NextResponse('XLSX not found. Run the pipeline first.', { status: 404 })
    const buf = fs.readFileSync(/*turbopackIgnore: true*/ xlsxPath)
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="output.xlsx"', 'Cache-Control': 'no-store' } })
  }

  if (format === 'csv') {
    if (!fs.existsSync(/*turbopackIgnore: true*/ csvPath)) return new NextResponse('CSV not found. Run the pipeline first.', { status: 404 })
    const buf = fs.readFileSync(/*turbopackIgnore: true*/ csvPath)
    return new NextResponse(buf, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="output.csv"', 'Cache-Control': 'no-store' } })
  }

  if (!fs.existsSync(/*turbopackIgnore: true*/ csvPath) || fs.statSync(csvPath).size === 0) {
    return NextResponse.json({ success: false, message: 'No output data yet. Run the pipeline first.', count: 0, headers: [], records: [], columnGroups: COLUMN_GROUPS, hasExcel: false })
  }

  try {
    const raw = fs.readFileSync(/*turbopackIgnore: true*/ csvPath, 'utf8')
    const parsed = parseCSV(raw)
    if (parsed.length === 0) return NextResponse.json({ success: false, message: 'output.csv is empty', count: 0, headers: [], records: [], columnGroups: COLUMN_GROUPS, hasExcel: false })
    const headers = parsed[0]
    const records = parsed.slice(1).map((row, idx) => {
      const obj: Record<string, string> = { _rowIndex: String(idx + 1) }
      headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
      return obj
    })
    const stats = fs.statSync(/*turbopackIgnore: true*/ csvPath)
    return NextResponse.json({ success: true, count: records.length, totalColumns: headers.length, headers, columnGroups: COLUMN_GROUPS, records, hasExcel: fs.existsSync(/*turbopackIgnore: true*/ xlsxPath), fileInfo: { csvSize: stats.size, modifiedAt: stats.mtime.toISOString() } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Failed to read output.csv' }, { status: 500 })
  }
}


