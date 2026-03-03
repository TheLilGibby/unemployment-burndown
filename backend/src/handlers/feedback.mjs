import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const REPO = 'RAG-Consulting-LLC/unemployment-burndown'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

const LABEL_MAP = {
  bug: 'bug',
  feature: 'feature request',
  task: 'question',
}

/**
 * Upload a screenshot to the repo and return a markdown image reference.
 * Returns '' on failure so the issue can still be created without it.
 */
async function uploadScreenshot(base64DataUrl, log) {
  try {
    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '')
    const ext = base64DataUrl.startsWith('data:image/png') ? 'png' : 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `.github/feedback-screenshots/${filename}`

    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: `feedback screenshot: ${filename}`,
        content: base64,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      log.warn({ status: res.status, body: text }, 'screenshot upload failed')
      return ''
    }

    const data = await res.json()
    return `\n\n![Screenshot](${data.content.download_url})`
  } catch (error) {
    log.warn({ err: error }, 'screenshot upload error')
    return ''
  }
}

/** Build the GitHub issue markdown body with metadata table */
function formatIssueBody(description, screenshotMd, metadata) {
  const parts = [description]

  if (screenshotMd) parts.push(screenshotMd)

  if (metadata) {
    parts.push('')
    parts.push('<details><summary>Environment</summary>')
    parts.push('')
    parts.push('| Field | Value |')
    parts.push('|-------|-------|')
    if (metadata.url) parts.push(`| Page URL | ${metadata.url} |`)
    if (metadata.timestamp) parts.push(`| Timestamp | ${metadata.timestamp} |`)
    if (metadata.browser) parts.push(`| Browser | ${metadata.browser} |`)
    if (metadata.os) parts.push(`| OS | ${metadata.os} |`)
    if (metadata.viewport) parts.push(`| Viewport | ${metadata.viewport} |`)
    if (metadata.screenResolution) parts.push(`| Screen | ${metadata.screenResolution} |`)
    if (metadata.devicePixelRatio) parts.push(`| DPR | ${metadata.devicePixelRatio} |`)
    if (metadata.language) parts.push(`| Language | ${metadata.language} |`)
    parts.push('')
    parts.push('</details>')
  }

  parts.push('')
  parts.push('---')
  parts.push('*Submitted via in-app feedback widget*')
  return parts.join('\n')
}

/**
 * POST /api/feedback
 * Body: { category?, description, screenshot?, metadata? }
 *
 * Creates a GitHub issue in the project repo.
 * If a screenshot (base64 data-URL) is provided, uploads it to the repo first.
 * Metadata (URL, browser, OS, viewport, etc.) is embedded in the issue body.
 */
export async function handler(event) {
  const log = createRequestLogger('feedback', event)
  try {
    if (!GITHUB_TOKEN) {
      log.error('GITHUB_TOKEN not configured')
      return err(503, 'Feedback service is not configured')
    }

    const body = JSON.parse(event.body || '{}')
    const { category, description, screenshot, metadata } = body

    if (!description || !description.trim()) {
      return err(400, 'Description is required')
    }

    // Upload screenshot (best-effort)
    let screenshotMd = ''
    if (screenshot) {
      screenshotMd = await uploadScreenshot(screenshot, log)
    }

    // Always tag as external; add category-specific label
    const labels = ['external']
    if (category && LABEL_MAP[category]) labels.push(LABEL_MAP[category])

    const title = description.trim().slice(0, 100)
    const issueBody = formatIssueBody(description.trim(), screenshotMd, metadata)

    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body: issueBody, labels }),
    })

    if (!res.ok) {
      const text = await res.text()
      log.error({ status: res.status, body: text }, 'GitHub API error')
      return err(502, 'Failed to create issue')
    }

    const issue = await res.json()
    log.info({ issueNumber: issue.number }, 'feedback issue created')

    return ok({ created: true, issueNumber: issue.number, url: issue.html_url })
  } catch (error) {
    log.error({ err: error }, 'feedback submission failed')
    return err(500, 'Failed to submit feedback')
  }
}
