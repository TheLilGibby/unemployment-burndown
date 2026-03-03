import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const REPO = 'RAG-Consulting-LLC/unemployment-burndown'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

const LABEL_MAP = {
  bug_report: 'bug',
  feature_request: 'enhancement',
  question: 'question',
}

/**
 * POST /api/feedback
 * Body: { category?, description }
 *
 * Creates a GitHub issue in the project repo.
 * No user auth required — feedback should be easy.
 */
export async function handler(event) {
  const log = createRequestLogger('feedback', event)
  try {
    if (!GITHUB_TOKEN) {
      log.error('GITHUB_TOKEN not configured')
      return err(503, 'Feedback service is not configured')
    }

    const body = JSON.parse(event.body || '{}')
    const { category, description } = body

    if (!description || !description.trim()) {
      return err(400, 'Description is required')
    }

    const labels = []
    if (category && LABEL_MAP[category]) labels.push(LABEL_MAP[category])

    const title = description.trim().slice(0, 100)
    const issueBody = [
      description.trim(),
      '',
      '---',
      `*Submitted via in-app feedback widget*`,
    ].join('\n')

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
