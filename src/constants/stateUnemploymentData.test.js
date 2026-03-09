import { STATE_UNEMPLOYMENT_DATA, getStateByCode, getStateOptions, getDefaultUnemploymentConfig } from './stateUnemploymentData'

describe('stateUnemploymentData', () => {
  it('contains all 50 states plus DC', () => {
    expect(STATE_UNEMPLOYMENT_DATA).toHaveLength(51)
  })

  it('each entry has required fields', () => {
    for (const state of STATE_UNEMPLOYMENT_DATA) {
      expect(state.stateCode).toMatch(/^[A-Z]{2}$/)
      expect(state.stateName).toBeTruthy()
      expect(state.maxWeeklyBenefit).toBeGreaterThan(0)
      expect(state.maxWeeks).toBeGreaterThan(0)
      expect(state.waitingPeriod).toHaveProperty('weeks')
      expect(state.waitingPeriod).toHaveProperty('description')
      expect(state.calculationMethod).toBeTruthy()
      expect(state.filingUrl).toMatch(/^https?:\/\//)
    }
  })

  it('has no duplicate state codes', () => {
    const codes = STATE_UNEMPLOYMENT_DATA.map(s => s.stateCode)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('getStateByCode', () => {
  it('returns state data for valid code', () => {
    const ca = getStateByCode('CA')
    expect(ca).toBeDefined()
    expect(ca.stateName).toBe('California')
    expect(ca.maxWeeklyBenefit).toBe(450)
  })

  it('is case-insensitive', () => {
    expect(getStateByCode('ca')).toEqual(getStateByCode('CA'))
  })

  it('returns undefined for invalid code', () => {
    expect(getStateByCode('XX')).toBeUndefined()
  })

  it('returns undefined for empty/null input', () => {
    expect(getStateByCode('')).toBeUndefined()
    expect(getStateByCode(null)).toBeUndefined()
    expect(getStateByCode(undefined)).toBeUndefined()
  })
})

describe('getStateOptions', () => {
  it('returns array of { value, label } objects', () => {
    const options = getStateOptions()
    expect(options).toHaveLength(51)
    expect(options[0]).toHaveProperty('value')
    expect(options[0]).toHaveProperty('label')
  })

  it('label includes state name and code', () => {
    const options = getStateOptions()
    const al = options.find(o => o.value === 'AL')
    expect(al.label).toContain('Alabama')
    expect(al.label).toContain('AL')
  })
})

describe('getDefaultUnemploymentConfig', () => {
  it('returns config for valid state', () => {
    const config = getDefaultUnemploymentConfig('WA')
    expect(config).toEqual({
      weeklyAmount: 1152,
      durationWeeks: 26,
      waitingWeeks: 1,
      stateName: 'Washington',
      stateCode: 'WA',
    })
  })

  it('returns null for invalid state', () => {
    expect(getDefaultUnemploymentConfig('XX')).toBeNull()
  })
})
