import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.USERS_TABLE || 'BurndownUsers'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

/**
 * POST /api/privacy/consent
 * Body: { consentType, consentVersion }
 *
 * Records that the authenticated user has given consent for a specific purpose.
 * consentType: "plaid_data_access" | "privacy_policy" | "account_registration"
 * consentVersion: version string of the policy (e.g. "1.1")
 *
 * Consent records are stored on the user's DynamoDB record for audit purposes.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { consentType, consentVersion } = body

    const validTypes = ['plaid_data_access', 'privacy_policy', 'account_registration']
    if (!consentType || !validTypes.includes(consentType)) {
      return err(400, `consentType must be one of: ${validTypes.join(', ')}`)
    }

    const consentRecord = {
      consentType,
      consentVersion: consentVersion || '1.0',
      grantedAt: new Date().toISOString(),
      ipAddress: event.requestContext?.identity?.sourceIp || null,
      userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'] || null,
    }

    // Append consent to user record
    const userId = user.sub
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb')
    await doc().send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId },
      UpdateExpression: 'SET #consents = list_append(if_not_exists(#consents, :empty), :record), updatedAt = :u',
      ExpressionAttributeNames: { '#consents': 'consentRecords' },
      ExpressionAttributeValues: {
        ':record': [consentRecord],
        ':empty': [],
        ':u': new Date().toISOString(),
      },
    }))

    const audit = createAuditLogger('recordConsent', event)
    audit.info({ userId, consentType, consentVersion }, 'consent recorded')

    return ok({ recorded: true, consent: consentRecord })
  } catch (error) {
    const log = createRequestLogger('recordConsent', event)
    log.error({ err: error }, 'consent recording failed')
    return err(500, 'Failed to record consent')
  }
}
