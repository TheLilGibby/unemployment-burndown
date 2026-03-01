import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.ORG_MEMBERS_TABLE || 'OrgMembers'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

export async function addMember({ orgId, userId, role, personId }) {
  const now = new Date().toISOString()
  await doc().send(new PutCommand({
    TableName: TABLE,
    Item: { orgId, userId, role, personId: personId || null, joinedAt: now },
  }))
}

export async function getMember(orgId, userId) {
  const res = await doc().send(new GetCommand({
    TableName: TABLE,
    Key: { orgId, userId },
  }))
  return res.Item || null
}

export async function getMembersByOrg(orgId) {
  const res = await doc().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'orgId = :oid',
    ExpressionAttributeValues: { ':oid': orgId },
  }))
  return res.Items || []
}

export async function getOrgForUser(userId) {
  const res = await doc().send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }))
  return (res.Items && res.Items[0]) || null
}

export async function removeMember(orgId, userId) {
  await doc().send(new DeleteCommand({
    TableName: TABLE,
    Key: { orgId, userId },
  }))
}
