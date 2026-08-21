import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET() {
  try {
    const projectRoot = path.join(process.cwd(), '..')
    const backendDir = path.join(projectRoot, 'backend')
    
    if (!fs.existsSync(backendDir)) {
      return NextResponse.json({ success: false, error: 'Backend directory not found' }, { status: 404 })
    }

    const files = fs.readdirSync(backendDir)
    const jsonFiles = files.filter(f => f.startsWith('extracted_output_') && f.endsWith('.json'))
    
    const records = []
    
    for (const file of jsonFiles) {
      const filePath = path.join(backendDir, file)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        
        // Extract MPN from filename: extracted_output_MPN.json
        const mpn = file.replace('extracted_output_', '').replace('.json', '')
        
        records.push({
          mpn,
          data,
          lastModified: fs.statSync(filePath).mtimeMs
        })
      } catch (e) {
        // Skip invalid JSON files
        console.error(`Error reading ${file}:`, e)
      }
    }
    
    // Sort by most recently generated
    records.sort((a, b) => b.lastModified - a.lastModified)

    return NextResponse.json({ 
      success: true, 
      count: records.length,
      records 
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
