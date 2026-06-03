import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Trigger endpoint for the LoadPlus → MySQL replica sync.
 *
 * Designed to be called by fastcron.com (or any cron service) once per day
 * after 5 PM UTC. Spawns the sync script as a detached background process
 * and returns immediately, so the cron caller doesn't time out.
 *
 * Auth: requires ?token=<SYNC_TOKEN> matching env var LOADPLUS_SYNC_TOKEN.
 *
 * Usage:
 *   GET /api/sync-loadplus?token=YOUR_TOKEN
 *   GET /api/sync-loadplus?token=YOUR_TOKEN&status=1   // check last run
 */

const LOG_DIR = path.join(process.cwd(), 'logs')
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'sync-loadplus.js')

function getLatestLogFile(): string | null {
  if (!fs.existsSync(LOG_DIR)) return null
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith('sync-loadplus-') && f.endsWith('.log'))
    .sort()
    .reverse()
  return files[0] ? path.join(LOG_DIR, files[0]) : null
}

function tailFile(filePath: string, lines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n').slice(-lines).join('\n')
  } catch {
    return ''
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const expectedToken = process.env.LOADPLUS_SYNC_TOKEN

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'LOADPLUS_SYNC_TOKEN is not configured on the server' },
      { status: 500 }
    )
  }
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Status check mode — return tail of latest log
  if (searchParams.get('status')) {
    const latestLog = getLatestLogFile()
    if (!latestLog) {
      return NextResponse.json({ message: 'No sync log found yet' })
    }
    return NextResponse.json({
      logFile: path.basename(latestLog),
      tail: tailFile(latestLog, 50),
    })
  }

  // Trigger mode — spawn the sync as a detached background process
  if (!fs.existsSync(SCRIPT_PATH)) {
    return NextResponse.json(
      { error: `Sync script not found at ${SCRIPT_PATH}` },
      { status: 500 }
    )
  }

  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
  const triggerLog = path.join(LOG_DIR, `sync-loadplus-trigger.log`)
  const out = fs.openSync(triggerLog, 'a')
  const err = fs.openSync(triggerLog, 'a')

  const child = spawn('node', [SCRIPT_PATH], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', out, err],
    env: process.env,
  })
  child.unref()

  return NextResponse.json({
    success: true,
    message: 'LoadPlus sync started in background',
    pid: child.pid,
    triggeredAt: new Date().toISOString(),
    note: 'Check progress with ?token=<token>&status=1',
  })
}
