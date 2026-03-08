import { describe, it, expect } from 'vitest'

process.env.ALLOWED_ORIGIN = 'https://test-app.amplifyapp.com'

const { ok, err } = await import('./response.mjs')

describe('response.mjs CORS origin', () => {
  it('sets Access-Control-Allow-Origin to ALLOWED_ORIGIN', () => {
    const res = ok({ hello: 'world' })
    expect(res.headers['Access-Control-Allow-Origin']).toBe(
      'https://test-app.amplifyapp.com',
    )
  })

  it('does not use wildcard origin', () => {
    const res = ok({})
    expect(res.headers['Access-Control-Allow-Origin']).not.toBe('*')
  })

  it('includes standard CORS headers', () => {
    const res = ok({})
    expect(res.headers['Access-Control-Allow-Headers']).toBe(
      'Content-Type,Authorization',
    )
    expect(res.headers['Access-Control-Allow-Methods']).toBe(
      'GET,POST,PUT,DELETE,OPTIONS',
    )
  })
})

describe('ok()', () => {
  it('returns 200 with JSON body', () => {
    const res = ok({ foo: 1 })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ foo: 1 })
    expect(res.headers['Content-Type']).toBe('application/json')
  })
})

describe('err()', () => {
  it('returns given status code with error message', () => {
    const res = err(400, 'bad request')
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'bad request' })
  })

  it('includes CORS headers on error responses', () => {
    const res = err(500, 'server error')
    expect(res.headers['Access-Control-Allow-Origin']).toBe(
      'https://test-app.amplifyapp.com',
    )
  })
})
