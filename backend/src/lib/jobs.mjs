import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import crypto from 'node:crypto'

const TABLE = process.env.JOBS_TABLE || 'Jobs'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

function generateJobId() {
  return `job_${crypto.randomBytes(8).toString('hex')}`
}

export async function createJob({ orgId, userId, title, employer, monthlySalary, startDate, endDate, status, statusDate, assignedTo }) {
  const jobId = generateJobId()
  const now = new Date().toISOString()
  const item = {
    orgId,
    jobId,
    userId,
    title: title || '',
    employer: employer || '',
    monthlySalary: monthlySalary || 0,
    startDate: startDate || '',
    endDate: endDate || '',
    status: status || 'active',
    statusDate: statusDate || '',
    assignedTo: assignedTo || null,
    createdAt: now,
    updatedAt: now,
  }
  await doc().send(new PutCommand({ TableName: TABLE, Item: item }))
  return item
}

export async function getJob(orgId, jobId) {
  const res = await doc().send(new GetCommand({
    TableName: TABLE,
    Key: { orgId, jobId },
  }))
  return res.Item || null
}

export async function getJobsByOrg(orgId, { limit, exclusiveStartKey } = {}) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'orgId = :oid',
    ExpressionAttributeValues: { ':oid': orgId },
  }
  if (limit) params.Limit = limit
  if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey

  const res = await doc().send(new QueryCommand(params))
  return { items: res.Items || [], lastEvaluatedKey: res.LastEvaluatedKey }
}

export async function updateJob(orgId, jobId, updates) {
  const allowedFields = ['title', 'employer', 'monthlySalary', 'startDate', 'endDate', 'status', 'statusDate', 'assignedTo']
  const expressions = []
  const values = { ':u': new Date().toISOString() }
  const names = {}

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const placeholder = `:${field}`
      const nameKey = `#${field}`
      expressions.push(`${nameKey} = ${placeholder}`)
      values[placeholder] = updates[field]
      names[nameKey] = field
    }
  }

  if (expressions.length === 0) return null

  const res = await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { orgId, jobId },
    UpdateExpression: `SET ${expressions.join(', ')}, updatedAt = :u`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: names,
    ReturnValues: 'ALL_NEW',
  }))
  return res.Attributes
}

export async function deleteJob(orgId, jobId) {
  await doc().send(new DeleteCommand({
    TableName: TABLE,
    Key: { orgId, jobId },
  }))
}
