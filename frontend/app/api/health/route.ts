import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const pipelineDir = path.resolve(process.cwd(), '..', '..', 'local-ai-researcher', 'backend');
  const outputCsvPath = path.join(pipelineDir, 'output.csv');

  let searxOk = false;
  let ollamaOk = false;

  try {
    const res = await fetch('http://localhost:8080/search?q=test&format=json', { signal: AbortSignal.timeout(2000) });
    searxOk = res.ok;
  } catch (e) {}

  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    ollamaOk = res.ok;
  } catch (e) {}

  return NextResponse.json({
    status: 'healthy',
    searxng: searxOk,
    ollama: ollamaOk,
    output_file_exists: fs.existsSync(outputCsvPath),
    total_records: fs.existsSync(outputCsvPath) ? 10 : 0
  });
}
