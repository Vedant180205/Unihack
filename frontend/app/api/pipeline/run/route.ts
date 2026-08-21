import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

let activeProcess: any = null;

export async function POST(req: NextRequest) {
  try {
    if (activeProcess) {
      return NextResponse.json({ success: false, error: 'Pipeline is already running' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const limit = body.limit || '1'
    const skip = body.skip || '0'

    const projectRoot = path.join(process.cwd(), '..')
    const pythonExecutable = path.join(projectRoot, 'venv', 'Scripts', 'python.exe')
    const scriptPath = path.join(projectRoot, 'backend', 'pipeline_ved.py')
    
    const pythonCmd = fs.existsSync(pythonExecutable) ? pythonExecutable : 'python'

    activeProcess = spawn(pythonCmd, [scriptPath, String(limit), String(skip)], {
      cwd: path.join(projectRoot, 'backend'),
      detached: true,
      stdio: 'ignore'
    })

    const pid = activeProcess.pid;

    if (activeProcess.unref) {
      activeProcess.unref()
    }

    setTimeout(() => { activeProcess = null; }, 1000);

    return NextResponse.json({ 
      success: true, 
      message: `Started pipeline with limit=${limit}, skip=${skip}`,
      pid: pid
    })
  } catch (error: any) {
    activeProcess = null;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
