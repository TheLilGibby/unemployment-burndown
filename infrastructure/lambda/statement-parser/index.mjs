import pino from 'pino'
import { getS3Object, putS3Object } from './s3Helpers.mjs'
import { parseEmail, extractTextFromAttachments } from './emailParser.mjs'
import { parseStatementWithBedrock, matchToCard } from './parser.mjs'

const BUCKET = process.env.BUCKET_NAME || 'rag-consulting-burndown'

const logger = pino({
  name: 'statement-parser',
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label }
    },
  },
})

export async function handler(event) {
  const log = logger.child({ recordCount: event.Records?.length })
  log.info('statement parser invoked')

  for (const record of event.Records) {
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
    const recordLog = log.child({ s3Key })
    recordLog.info('processing email')

    try {
      // 1. Fetch raw email from S3
      const emailBuffer = await getS3Object(BUCKET, s3Key)

      // 2. Parse MIME email
      const parsed = await parseEmail(emailBuffer)
      recordLog.info({ from: parsed.from?.text, subject: parsed.subject }, 'email parsed')

      // 3. Extract text content (from body + PDF attachments)
      const textContent = await extractTextFromAttachments(parsed)
      if (!textContent || textContent.trim().length < 50) {
        recordLog.warn({ contentLength: textContent?.trim().length || 0 }, 'insufficient text content extracted, skipping')
        return { statusCode: 200, body: 'Skipped: insufficient content' }
      }

      // 4. Call Bedrock Claude to parse the statement
      const statementData = await parseStatementWithBedrock(
        textContent,
        parsed.from?.text || 'unknown'
      )

      // 5. Match to existing credit card
      const cardId = await matchToCard(BUCKET, statementData.issuer, statementData)
      statementData.cardId = cardId

      // 6. Assign metadata
      const stmtId = `stmt_${Date.now()}`
      statementData.id = stmtId
      statementData.sourceEmailId = s3Key
      statementData.parsedAt = new Date().toISOString()

      // Give each transaction an ID
      if (statementData.transactions) {
        statementData.transactions = statementData.transactions.map((txn, i) => ({
          ...txn,
          id: `${stmtId}_txn_${String(i).padStart(3, '0')}`,
        }))
      }

      // 7. Write parsed statement to S3
      await putS3Object(
        BUCKET,
        `statements/${stmtId}.json`,
        JSON.stringify(statementData, null, 2)
      )
      recordLog.info({ statementId: stmtId, transactionCount: statementData.transactions?.length || 0 }, 'statement written to S3')

      // 8. Update index.json
      await updateIndex(BUCKET, statementData)
      recordLog.info('statements index updated')

    } catch (err) {
      recordLog.error({ err }, 'failed to process email')
      throw err
    }
  }

  return { statusCode: 200, body: 'OK' }
}

async function updateIndex(bucket, statementData) {
  let index
  try {
    const raw = await getS3Object(bucket, 'statements/index.json')
    index = JSON.parse(raw.toString('utf-8'))
  } catch {
    index = { version: 1, lastUpdated: null, statements: [] }
  }

  // Add new statement summary to index
  index.statements.push({
    id: statementData.id,
    cardId: statementData.cardId,
    issuer: statementData.issuer || null,
    closingDate: statementData.closingDate || null,
    statementBalance: statementData.statementBalance || 0,
    transactionCount: statementData.transactions?.length || 0,
    parsedAt: statementData.parsedAt,
  })

  index.lastUpdated = new Date().toISOString()

  await putS3Object(
    bucket,
    'statements/index.json',
    JSON.stringify(index, null, 2)
  )
}
