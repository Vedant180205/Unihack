import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function getOutputPaths() {
  const outputDir = path.join(process.cwd(), '..', 'backend', 'output')
  return { outputDir }
}

const EXPECTED_HEADERS = ['MFR URL', 'Ref URL 1', 'Ref URL 2', 'Ref URL 3', 'Ref URL 4', 'Ref URL 5', 'PART_NUMBER', 'Dept', 'Class', 'Fine', 'SKU - MY_PART_NUMBER', 'Mfg_Part_Num', 'Part_Desc', 'E1_Brand', 'Unilog_Brand', 'DIB_Brand', 'Part_Manuf', 'MANUFACTURER_NAME', 'BRAND_NAME', 'TRADE_NAME', 'MANUFACTURER_PART_NUMBER', 'ALTERNATE_PART_NUMBER', 'Classpath', 'MOBILE_DESC', 'INVOICE_DESC', 'SHORT_DESC', 'LONG_DESC1', 'RETAIL_DESC', 'MARKETING_DESCRIPTION', 'ITEM_FEATURES_1', 'ITEM_FEATURES_2', 'ITEM_FEATURES_3', 'ITEM_FEATURES_4', 'ITEM_FEATURES_5', 'ITEM_FEATURES_6', 'ITEM_FEATURES_7', 'ITEM_FEATURES_8', 'ITEM_FEATURES_9', 'ITEM_FEATURES_10', 'ITEM_FEATURES_11', 'ITEM_FEATURES_12', 'ITEM_FEATURES_13', 'ITEM_FEATURES_14', 'ITEM_FEATURES_15', 'ITEM_FEATURES_16', 'ITEM_FEATURES_17', 'ITEM_FEATURES_18', 'ITEM_FEATURES_19', 'ITEM_FEATURES_20', 'With', 'Standard/Approvals', 'Prop 65', 'Application', 'Includes', 'Product Name', 'ATTRIBUTE_LABEL 1', 'ATTRIBUTE_VALUE 1', 'ATTRIBUTE_UOM 1', 'ATTRIBUTE_LABEL 2', 'ATTRIBUTE_VALUE 2', 'ATTRIBUTE_UOM 2', 'ATTRIBUTE_LABEL 3', 'ATTRIBUTE_VALUE 3', 'ATTRIBUTE_UOM 3', 'ATTRIBUTE_LABEL 4', 'ATTRIBUTE_VALUE 4', 'ATTRIBUTE_UOM 4', 'ATTRIBUTE_LABEL 5', 'ATTRIBUTE_VALUE 5', 'ATTRIBUTE_UOM 5', 'ATTRIBUTE_LABEL 6', 'ATTRIBUTE_VALUE 6', 'ATTRIBUTE_UOM 6', 'ATTRIBUTE_LABEL 7', 'ATTRIBUTE_VALUE 7', 'ATTRIBUTE_UOM 7', 'ATTRIBUTE_LABEL 8', 'ATTRIBUTE_VALUE 8', 'ATTRIBUTE_UOM 8', 'ATTRIBUTE_LABEL 9', 'ATTRIBUTE_VALUE 9', 'ATTRIBUTE_UOM 9', 'ATTRIBUTE_LABEL 10', 'ATTRIBUTE_VALUE 10', 'ATTRIBUTE_UOM 10', 'ATTRIBUTE_LABEL 11', 'ATTRIBUTE_VALUE 11', 'ATTRIBUTE_UOM 11', 'ATTRIBUTE_LABEL 12', 'ATTRIBUTE_VALUE 12', 'ATTRIBUTE_UOM 12', 'ATTRIBUTE_LABEL 13', 'ATTRIBUTE_VALUE 13', 'ATTRIBUTE_UOM 13', 'ATTRIBUTE_LABEL 14', 'ATTRIBUTE_VALUE 14', 'ATTRIBUTE_UOM 14', 'ATTRIBUTE_LABEL 15', 'ATTRIBUTE_VALUE 15', 'ATTRIBUTE_UOM 15', 'ATTRIBUTE_LABEL 16', 'ATTRIBUTE_VALUE 16', 'ATTRIBUTE_UOM 16', 'ATTRIBUTE_LABEL 17', 'ATTRIBUTE_VALUE 17', 'ATTRIBUTE_UOM 17', 'ATTRIBUTE_LABEL 18', 'ATTRIBUTE_VALUE 18', 'ATTRIBUTE_UOM 18', 'ATTRIBUTE_LABEL 19', 'ATTRIBUTE_VALUE 19', 'ATTRIBUTE_UOM 19', 'ATTRIBUTE_LABEL 20', 'ATTRIBUTE_VALUE 20', 'ATTRIBUTE_UOM 20', 'ATTRIBUTE_LABEL 21', 'ATTRIBUTE_VALUE 21', 'ATTRIBUTE_UOM 21', 'ATTRIBUTE_LABEL 22', 'ATTRIBUTE_VALUE 22', 'ATTRIBUTE_UOM 22', 'ATTRIBUTE_LABEL 23', 'ATTRIBUTE_VALUE 23', 'ATTRIBUTE_UOM 23', 'ATTRIBUTE_LABEL 24', 'ATTRIBUTE_VALUE 24', 'ATTRIBUTE_UOM 24', 'ATTRIBUTE_LABEL 25', 'ATTRIBUTE_VALUE 25', 'ATTRIBUTE_UOM 25', 'ATTRIBUTE_LABEL 26', 'ATTRIBUTE_VALUE 26', 'ATTRIBUTE_UOM 26', 'ATTRIBUTE_LABEL 27', 'ATTRIBUTE_VALUE 27', 'ATTRIBUTE_UOM 27', 'ATTRIBUTE_LABEL 28', 'ATTRIBUTE_VALUE 28', 'ATTRIBUTE_UOM 28', 'ATTRIBUTE_LABEL 29', 'ATTRIBUTE_VALUE 29', 'ATTRIBUTE_UOM 29', 'ATTRIBUTE_LABEL 30', 'ATTRIBUTE_VALUE 30', 'ATTRIBUTE_UOM 30', 'ATTRIBUTE_LABEL 31', 'ATTRIBUTE_VALUE 31', 'ATTRIBUTE_UOM 31', 'ATTRIBUTE_LABEL 32', 'ATTRIBUTE_VALUE 32', 'ATTRIBUTE_UOM 32', 'ATTRIBUTE_LABEL 33', 'ATTRIBUTE_VALUE 33', 'ATTRIBUTE_UOM 33', 'ATTRIBUTE_LABEL 34', 'ATTRIBUTE_VALUE 34', 'ATTRIBUTE_UOM 34', 'ATTRIBUTE_LABEL 35', 'ATTRIBUTE_VALUE 35', 'ATTRIBUTE_UOM 35', 'ATTRIBUTE_LABEL 36', 'ATTRIBUTE_VALUE 36', 'ATTRIBUTE_UOM 36', 'ATTRIBUTE_LABEL 37', 'ATTRIBUTE_VALUE 37', 'ATTRIBUTE_UOM 37', 'ATTRIBUTE_LABEL 38', 'ATTRIBUTE_VALUE 38', 'ATTRIBUTE_UOM 38', 'ATTRIBUTE_LABEL 39', 'ATTRIBUTE_VALUE 39', 'ATTRIBUTE_UOM 39', 'ATTRIBUTE_LABEL 40', 'ATTRIBUTE_VALUE 40', 'ATTRIBUTE_UOM 40', 'ATTRIBUTE_LABEL 41', 'ATTRIBUTE_VALUE 41', 'ATTRIBUTE_UOM 41', 'ATTRIBUTE_LABEL 42', 'ATTRIBUTE_VALUE 42', 'ATTRIBUTE_UOM 42', 'ATTRIBUTE_LABEL 43', 'ATTRIBUTE_VALUE 43', 'ATTRIBUTE_UOM 43', 'ATTRIBUTE_LABEL 44', 'ATTRIBUTE_VALUE 44', 'ATTRIBUTE_UOM 44', 'ATTRIBUTE_LABEL 45', 'ATTRIBUTE_VALUE 45', 'ATTRIBUTE_UOM 45', 'ATTRIBUTE_LABEL 46', 'ATTRIBUTE_VALUE 46', 'ATTRIBUTE_UOM 46', 'ATTRIBUTE_LABEL 47', 'ATTRIBUTE_VALUE 47', 'ATTRIBUTE_UOM 47', 'ATTRIBUTE_LABEL 48', 'ATTRIBUTE_VALUE 48', 'ATTRIBUTE_UOM 48', 'ATTRIBUTE_LABEL 49', 'ATTRIBUTE_VALUE 49', 'ATTRIBUTE_UOM 49', 'ATTRIBUTE_LABEL 50', 'ATTRIBUTE_VALUE 50', 'ATTRIBUTE_UOM 50', 'UPC', 'EAN', 'GTIN', 'UNSPSC', 'Warranty', 'List Price', 'Selling Qty', 'Selling UOM', 'Standard Packaging Information', 'LENGTH', 'LENGTH_UOM', 'HEIGHT', 'HEIGHT_UOM', 'WIDTH', 'WIDTH_UOM', 'WEIGHT', 'WEIGHT_UOM', 'VOLUME', 'VOLUME_UOM', 'Product Image', 'Alternate Image 1', 'Alternate Image 2', 'Alternate Image 3', 'Alternate Image 4', 'SDS', 'SDS_1', 'Warranty Information', 'Catalog', 'Specification Sheet', 'Instruction/Installation Manual', 'Service Manual', 'Owners/User Manual', 'Line Drawing', 'MTR', 'RoHS', 'Full Engineering Drawing', 'Energy Star Guide', 'Technical Bulletin', 'Submittal', 'Compatibility Chart', 'Size Chart', 'Product Label/Insert', 'Video Link', 'Video Link 1', 'Country Of Origin', 'Discontinued', 'Actual Image (Yes/No)'];

const COLUMN_GROUPS = {
  overview: ['MFR URL','Ref URL 1','SKU - MY_PART_NUMBER','SHORT_DESC','BRAND_NAME'],
  descriptions: ['LONG_DESC1'],
  features: ['ITEM_FEATURES_1','ITEM_FEATURES_2','ITEM_FEATURES_3','ITEM_FEATURES_4','ITEM_FEATURES_5'],
  attributes: ['ATTRIBUTE_LABEL 1','ATTRIBUTE_VALUE 1','ATTRIBUTE_UOM 1','ATTRIBUTE_LABEL 2','ATTRIBUTE_VALUE 2','ATTRIBUTE_UOM 2'],
  logistics: [],
  assets: [],
}

function convertToCSV(headers: string[], records: Record<string, string>[]): string {
  const escapeCsv = (val: string) => {
    if (val == null) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  
  const headerRow = headers.map(escapeCsv).join(',')
  const rows = records.map(record => {
    return headers.map(header => escapeCsv(record[header] || '')).join(',')
  })
  
  return [headerRow, ...rows].join('\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  const { outputDir } = getOutputPaths()
  
  if (!fs.existsSync(outputDir)) {
    if (format === 'csv') return new NextResponse('No data found.', { status: 404 })
    return NextResponse.json({ success: false, message: 'No output data yet.', count: 0, headers: EXPECTED_HEADERS, records: [], columnGroups: COLUMN_GROUPS, hasExcel: false })
  }

  try {
    const files = fs.readdirSync(outputDir).filter(f => f.startsWith('extracted_output_') && f.endsWith('.json'))
    
    if (files.length === 0) {
      if (format === 'csv') return new NextResponse('No output data yet.', { status: 404 })
      return NextResponse.json({ success: false, message: 'No output data yet.', count: 0, headers: EXPECTED_HEADERS, records: [], columnGroups: COLUMN_GROUPS, hasExcel: false })
    }

    const records = []

    for (const file of files) {
      const p = path.join(outputDir, file)
      try {
        const json = JSON.parse(fs.readFileSync(p, 'utf8'))
        records.push(json)
      } catch (err) {
        console.error(`Failed to read ${p}`, err)
      }
    }

    const headers = EXPECTED_HEADERS;

    if (format === 'csv') {
      const csvStr = convertToCSV(headers, records)
      // prepend BOM
      const BOM = "\uFEFF";
      return new NextResponse(BOM + csvStr, { 
        headers: { 
          'Content-Type': 'text/csv; charset=utf-8', 
          'Content-Disposition': 'attachment; filename="output.csv"', 
          'Cache-Control': 'no-store' 
        } 
      })
    }
    
    if (format === 'xlsx') {
        return new NextResponse('XLSX dynamic generation not implemented in frontend yet. Please use CSV.', { status: 404 })
    }

    // JSON format
    const processedRecords = records.map((rec, idx) => {
      const obj: any = { _rowIndex: String(idx + 1) };
      headers.forEach(h => {
        obj[h] = rec[h] || '';
      });
      return obj;
    });
    
    return NextResponse.json({ 
      success: true, 
      count: processedRecords.length, 
      totalColumns: headers.length, 
      headers: headers, 
      columnGroups: COLUMN_GROUPS, 
      records: processedRecords, 
      hasExcel: false, 
      fileInfo: { csvSize: 0, modifiedAt: new Date().toISOString() } 
    })
    
  } catch (e: any) {
    if (format === 'csv') return new NextResponse('Failed to generate export', { status: 500 })
    return NextResponse.json({ success: false, error: e?.message || 'Failed to read output' }, { status: 500 })
  }
}
