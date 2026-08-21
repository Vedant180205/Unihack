import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function getOutputPaths() {
  const possibleCsvPaths = [
    path.join(process.cwd(), '..', 'backend', 'output.csv'),
    path.join(process.cwd(), 'backend', 'output.csv'),
    path.resolve('c:/Users/gaurang/OneDrive/Desktop/projects/unihackmain/backend/output.csv'),
  ]

  let csvPath = possibleCsvPaths[0]
  for (const p of possibleCsvPaths) {
    if (fs.existsSync(p)) {
      csvPath = p
      break
    }
  }

  const xlsxPath = csvPath.replace(/\.csv$/, '.xlsx')
  return { csvPath, xlsxPath }
}

function parseCSV(content: string): string[][] {
  // Strip UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal)
      currentVal = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++ // Skip CRLF
      }
      currentRow.push(currentVal)
      if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow)
      }
      currentRow = []
      currentVal = ''
    } else {
      currentVal += char
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal)
    if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

const COLUMN_GROUPS = {
  overview: [
    'MFR URL', 'Ref URL 1', 'PART_NUMBER', 'SKU - MY_PART_NUMBER', 'Mfg_Part_Num',
    'Part_Desc', 'MANUFACTURER_NAME', 'BRAND_NAME', 'TRADE_NAME',
    'Classpath', 'Product Name'
  ],
  descriptions: [
    'INVOICE_DESC', 'MOBILE_DESC', 'SHORT_DESC', 'LONG_DESC1',
    'RETAIL_DESC', 'MARKETING_DESCRIPTION'
  ],
  features: [
    'With', 'Standard/Approvals', 'Prop 65', 'Application', 'Includes',
    'ITEM_FEATURES_1', 'ITEM_FEATURES_2', 'ITEM_FEATURES_3', 'ITEM_FEATURES_4',
    'ITEM_FEATURES_5', 'ITEM_FEATURES_6', 'ITEM_FEATURES_7', 'ITEM_FEATURES_8',
    'ITEM_FEATURES_9', 'ITEM_FEATURES_10'
  ],
  attributes: [
    'ATTRIBUTE_LABEL 1', 'ATTRIBUTE_VALUE 1', 'ATTRIBUTE_UOM 1',
    'ATTRIBUTE_LABEL 2', 'ATTRIBUTE_VALUE 2', 'ATTRIBUTE_UOM 2',
    'ATTRIBUTE_LABEL 3', 'ATTRIBUTE_VALUE 3', 'ATTRIBUTE_UOM 3',
    'ATTRIBUTE_LABEL 4', 'ATTRIBUTE_VALUE 4', 'ATTRIBUTE_UOM 4',
    'ATTRIBUTE_LABEL 5', 'ATTRIBUTE_VALUE 5', 'ATTRIBUTE_UOM 5',
    'ATTRIBUTE_LABEL 6', 'ATTRIBUTE_VALUE 6', 'ATTRIBUTE_UOM 6',
    'ATTRIBUTE_LABEL 7', 'ATTRIBUTE_VALUE 7', 'ATTRIBUTE_UOM 7',
    'ATTRIBUTE_LABEL 8', 'ATTRIBUTE_VALUE 8', 'ATTRIBUTE_UOM 8',
    'ATTRIBUTE_LABEL 9', 'ATTRIBUTE_VALUE 9', 'ATTRIBUTE_UOM 9',
    'ATTRIBUTE_LABEL 10', 'ATTRIBUTE_VALUE 10', 'ATTRIBUTE_UOM 10'
  ],
  logistics: [
    'UPC', 'EAN', 'GTIN', 'UNSPSC', 'Warranty', 'List Price', 'Selling Qty',
    'Selling UOM', 'Standard Packaging Information', 'LENGTH', 'LENGTH_UOM',
    'HEIGHT', 'HEIGHT_UOM', 'WIDTH', 'WIDTH_UOM', 'WEIGHT', 'WEIGHT_UOM'
  ],
  assets: [
    'Product Image', 'Alternate Image 1', 'Alternate Image 2', 'Alternate Image 3',
    'Alternate Image 4', 'Specification Sheet', 'SDS', 'Instruction/Installation Manual',
    'Owners/User Manual', 'Actual Image (Yes/No)'
  ]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  const download = searchParams.get('download') === 'true'

  const { csvPath, xlsxPath } = getOutputPaths()

  // Handle direct file downloads
  if (download || format === 'csv' || format === 'xlsx') {
    if (format === 'xlsx') {
      if (!fs.existsSync(xlsxPath)) {
        return new NextResponse('Excel file not found. Please run the pipeline first.', { status: 404 })
      }
      const fileBuffer = fs.readFileSync(xlsxPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="output.xlsx"',
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'csv') {
      if (!fs.existsSync(csvPath)) {
        return new NextResponse('CSV file not found. Please run the pipeline first.', { status: 404 })
      }
      const fileBuffer = fs.readFileSync(csvPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="output.csv"',
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  // Handle JSON preview request
  if (!fs.existsSync(csvPath) || fs.statSync(csvPath).size === 0) {
    return NextResponse.json({
      success: false,
      message: 'No output data available yet. Run pipeline.py to generate records.',
      count: 0,
      headers: [],
      records: [],
      columnGroups: COLUMN_GROUPS,
      hasExcel: false,
    })
  }

  try {
    const rawContent = fs.readFileSync(csvPath, 'utf8')
    const parsedRows = parseCSV(rawContent)

    if (parsedRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'output.csv is empty',
        count: 0,
        headers: [],
        records: [],
        columnGroups: COLUMN_GROUPS,
        hasExcel: false,
      })
    }

    const headers = parsedRows[0]
    const dataRows = parsedRows.slice(1)

    const records = dataRows.map((row, idx) => {
      const recordObj: Record<string, string> = { _rowIndex: String(idx + 1) }
      headers.forEach((header, hIdx) => {
        recordObj[header] = row[hIdx] !== undefined ? row[hIdx] : ''
      })
      return recordObj
    })

    const stats = fs.statSync(csvPath)
    const hasExcel = fs.existsSync(xlsxPath)

    return NextResponse.json({
      success: true,
      count: records.length,
      totalColumns: headers.length,
      headers,
      columnGroups: COLUMN_GROUPS,
      records,
      hasExcel,
      fileInfo: {
        csvSize: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to read output.csv',
      },
      { status: 500 }
    )
  }
}
