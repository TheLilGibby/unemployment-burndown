import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { deleteUser, getUser } from '../lib/users.mjs'
import { getPlaidItemsByUser, deletePlaidItem } from '../lib/dynamo.mjs'
import { getPlaidClient } from '../lib/plaid.mjs'
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

const S3_BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const S3_REGION = process.env.S3_REGION || 'us-west-1'

/**
 * POST /api/auth/delete-account
 *
 * Permanently deletes the authenticated user's account and all associated data:
 *   1. Revokes all Plaid access tokens
 *   2. Deletes all Plaid items from DynamoDB
 *   3. Deletes org data from S3 (data.json, statements)
 *   4. Deletes the user record from DynamoDB
 */
export async function handler(event) {
  const log = createRequestLogger('deleteAccount', event)

  try {
    const { user, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const userId = user.sub
    const orgId = user.orgId

    const audit = createAuditLogger('deleteAccount', event)
    audit.info({ userId, orgId }, 'account deletion initiated')

    // 1. Revoke all Plaid access tokens and delete items from DynamoDB
    const plaidUserId = orgId || userId
    try {
      const items = await getPlaidItemsByUser(plaidUserId)
      const client = getPlaidClient()
      for (const item of items) {
        try {
          await client.itemRemove({ access_token: item.accessToken })
        } catch (plaidErr) {
          log.warn({ err: plaidErr, itemId: item.itemId }, 'Plaid itemRemove failed during account deletion')
        }
        await deletePlaidItem(plaidUserId, item.itemId)
      }
    } catch (plaidErr) {
      log.warn({ err: plaidErr }, 'Error cleaning up Plaid items during account deletion')
    }

    // 2. Delete org data from S3
    if (orgId) {
      try {
        const s3 = new S3Client({ region: S3_REGION })
        const prefix = `orgs/${orgId}/`

        // List and delete all objects under the org prefix
        let continuationToken
        do {
          const listRes = await s3.send(new ListObjectsV2Command({
            Bucket: S3_BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }))

          if (listRes.Contents) {
            for (const obj of listRes.Contents) {
              await s3.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: obj.Key,
              }))
            }
          }

          continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
        } while (continuationToken)
      } catch (s3Err) {
        log.warn({ err: s3Err, orgId }, 'Error cleaning up S3 data during account deletion')
      }
    }

    // 3. Delete the user record from DynamoDB
    await deleteUser(userId)

    audit.info({ userId, orgId }, 'account deletion completed')

    return ok({ deleted: true })
  } catch (error) {
    log.error({ err: error }, 'account deletion failed')
    return err(500, 'Account deletion failed. Please contact privacy@rag-consulting.com for assistance.')
  }
}
