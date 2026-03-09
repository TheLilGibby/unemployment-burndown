#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { DEFAULTS } from './src/constants/defaults.js'
import { STATEMENT_CATEGORIES, categorySchema } from './src/constants/categories.js'
import { computeBurndown } from './src/utils/computeBurndown.js'
import { computeRetirementProjection } from './src/utils/retirementProjection.js'
import { US_STATES, getStateTaxRate, computeMonthlyTakeHome, computeMinimumGrossSalary } from './src/utils/stateTaxRates.js'
import { computeGoalProgress } from './src/utils/goalProgress.js'
import { getEffectivePayment } from './src/utils/ccPayment.js'
import { validateSyncState } from './src/utils/validateSyncState.js'

const server = new McpServer({
  name: 'burndown-finance',
  version: '1.0.0',
  description: 'Financial utilities for the Unemployment Burndown app — burndown projections, tax rates, data validation, and more.',
})

// ---------------------------------------------------------------------------
// 1. get_data_schema
// ---------------------------------------------------------------------------
server.tool(
  'get_data_schema',
  'Return the DEFAULTS data shape with field documentation. Optionally filter to a specific top-level section.',
  { section: z.string().optional().describe('Optional top-level key to return (e.g. "unemployment", "expenses", "whatIf"). Omit for full schema.') },
  async ({ section }) => {
    const fieldDocs = {
      people: 'Household members. Each has id, name, color.',
      savingsAccounts: 'Bank accounts with id, name, amount, active, assignedTo, description, balanceDate.',
      furloughDate: 'ISO date when employment ended.',
      unemployment: 'Benefit config: startDate, weeklyAmount, durationWeeks, assignedTo.',
      expenses: 'Monthly recurring expenses: id, category, monthlyAmount, essential (bool), assignedTo, description.',
      whatIf: 'What-if scenario toggles: expenseReductionPct, sideIncomeMonthly, emergencyFloor, benefitDelayWeeks, benefitCutWeeks, expenseRaisePct, freezeDate, jobOfferSalary, jobOfferStartDate, freelanceRamp, partnerIncomeMonthly, partnerStartDate.',
      oneTimeExpenses: 'Future one-time expenses: [{ id, name, amount, date }].',
      oneTimePurchases: 'Planned purchases (treated as expenses): [{ id, name, amount, date }].',
      oneTimeIncome: 'Future one-time income events: [{ id, name, amount, date }].',
      monthlyIncome: 'Recurring income sources: [{ id, name, monthlyAmount, startDate, endDate }].',
      jobs: 'Job records: [{ id, title, monthlySalary, startDate, endDate, status }].',
      assets: 'Asset records (non-liquid).',
      investments: 'Monthly investment contributions: [{ id, name, monthlyAmount, active }].',
      child1Investments: 'Child 1 investment accounts.',
      child2Investments: 'Child 2 investment accounts.',
      subscriptions: 'Tracked subscriptions: [{ id, name, monthlyAmount, active }].',
      creditCards: 'Credit cards: [{ id, name, balance, minimumPayment, apr, creditLimit, paymentStrategy, paymentAmount }].',
      properties: 'Real estate properties.',
      homeImprovements: 'Home improvement projects.',
      goals: 'Financial goals with target amounts, dates, and data sources.',
      advertisingRevenue: 'Ad revenue tracking: { costs, revenue }.',
      notificationPreferences: 'Alert thresholds and push notification config.',
      transactionLinks: 'Links between transactions and budget items.',
      transactionOverrides: 'Manual category overrides for transactions.',
      accountCustomizations: 'Display customizations per linked account.',
      plaidMeta: 'Plaid connection metadata.',
      categoryBudgets: 'Per-category monthly budget targets.',
      jobScenarios: 'Saved job offer comparison scenarios.',
      retirement: 'Retirement planning: currentAge, targetRetirementAge, currentBalance, monthlyContribution, annualReturnPct, inflationPct, targetNestEgg, etc.',
    }

    let data, docs
    if (section && section in DEFAULTS) {
      data = { [section]: DEFAULTS[section] }
      docs = { [section]: fieldDocs[section] || 'No additional docs.' }
    } else {
      data = DEFAULTS
      docs = fieldDocs
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ defaults: data, fieldDocs: docs }, null, 2) }],
    }
  }
)

// ---------------------------------------------------------------------------
// 2. compute_burndown
// ---------------------------------------------------------------------------
server.tool(
  'compute_burndown',
  'Run a month-by-month burndown simulation. Pass financial data (merged over DEFAULTS). Returns runway projection with runout date, net burn, and data points.',
  {
    savings: z.number().optional().describe('Total current savings (sum of all accounts)'),
    unemployment: z.object({
      startDate: z.string().optional(),
      weeklyAmount: z.number().optional(),
      durationWeeks: z.number().optional(),
    }).optional().describe('Unemployment benefit config'),
    expenses: z.array(z.object({
      id: z.number().optional(),
      category: z.string().optional(),
      monthlyAmount: z.number(),
      essential: z.boolean().optional(),
    })).optional().describe('Monthly expenses'),
    whatIf: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.record(z.union([z.string(), z.number()])))])).optional().describe('What-if scenario overrides (see get_data_schema for keys)'),
    oneTimeExpenses: z.array(z.object({ date: z.string(), amount: z.number() })).optional(),
    extraCash: z.number().optional(),
    investments: z.array(z.object({ monthlyAmount: z.number(), active: z.boolean().optional() })).optional(),
    oneTimeIncome: z.array(z.object({ date: z.string(), amount: z.number() })).optional(),
    monthlyIncome: z.array(z.object({ monthlyAmount: z.number(), startDate: z.string().optional(), endDate: z.string().optional() })).optional(),
    startDate: z.string().optional().describe('Simulation start date (ISO string). Defaults to today.'),
    jobs: z.array(z.object({ monthlySalary: z.number().optional(), startDate: z.string().optional(), endDate: z.string().optional(), status: z.string().optional() })).optional(),
    oneTimePurchases: z.array(z.object({ date: z.string(), amount: z.number() })).optional(),
    creditCards: z.array(z.object({ id: z.union([z.string(), z.number()]).optional(), balance: z.number().optional(), apr: z.number().optional(), minimumPayment: z.number().optional(), paymentStrategy: z.string().optional(), paymentAmount: z.number().optional() })).optional(),
    includeDataPoints: z.boolean().optional().describe('If true, return full dataPoints array. Default false returns summary only.'),
  },
  async (params) => {
    const { includeDataPoints, ...input } = params
    const merged = {
      savings: input.savings ?? 0,
      unemployment: { ...DEFAULTS.unemployment, ...input.unemployment },
      expenses: input.expenses ?? DEFAULTS.expenses,
      whatIf: { ...DEFAULTS.whatIf, ...input.whatIf },
      oneTimeExpenses: input.oneTimeExpenses ?? [],
      extraCash: input.extraCash ?? 0,
      investments: input.investments ?? [],
      oneTimeIncome: input.oneTimeIncome ?? [],
      monthlyIncome: input.monthlyIncome ?? [],
      startDate: input.startDate ?? null,
      jobs: input.jobs ?? [],
      oneTimePurchases: input.oneTimePurchases ?? [],
      creditCards: input.creditCards ?? [],
    }

    const result = computeBurndown(merged)

    // Summarize dataPoints unless full array requested
    let dataPointsOutput
    if (includeDataPoints) {
      dataPointsOutput = result.dataPoints.map(dp => ({
        ...dp,
        date: dp.date instanceof Date ? dp.date.toISOString() : dp.date,
      }))
    } else {
      const first = result.dataPoints[0]
      const last = result.dataPoints[result.dataPoints.length - 1]
      const runoutPt = result.totalRunwayMonths != null
        ? result.dataPoints.find(dp => dp.month >= Math.floor(result.totalRunwayMonths))
        : null
      dataPointsOutput = {
        summary: true,
        totalPoints: result.dataPoints.length,
        first: first ? { ...first, date: first.date instanceof Date ? first.date.toISOString() : first.date } : null,
        last: last ? { ...last, date: last.date instanceof Date ? last.date.toISOString() : last.date } : null,
        runoutMonth: runoutPt ? { ...runoutPt, date: runoutPt.date instanceof Date ? runoutPt.date.toISOString() : runoutPt.date } : null,
      }
    }

    const output = {
      runoutDate: result.runoutDate instanceof Date ? result.runoutDate.toISOString() : result.runoutDate,
      totalRunwayMonths: result.totalRunwayMonths,
      currentNetBurn: result.currentNetBurn,
      effectiveExpenses: result.effectiveExpenses,
      monthlyBenefits: result.monthlyBenefits,
      monthlyInvestments: result.monthlyInvestments,
      totalMonthlyIncome: result.totalMonthlyIncome,
      totalJobIncome: result.totalJobIncome,
      benefitStart: result.benefitStart instanceof Date ? result.benefitStart.toISOString() : result.benefitStart,
      benefitEnd: result.benefitEnd instanceof Date ? result.benefitEnd.toISOString() : result.benefitEnd,
      emergencyFloor: result.emergencyFloor,
      dataPoints: dataPointsOutput,
    }

    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// 3. get_expense_categories
// ---------------------------------------------------------------------------
server.tool(
  'get_expense_categories',
  'Return the full two-tier expense/transaction category taxonomy with keys, labels, colors, and descriptions.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(categorySchema, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// 4. compute_retirement_projection
// ---------------------------------------------------------------------------
server.tool(
  'compute_retirement_projection',
  'Compute a month-by-month retirement projection with goal tracking.',
  {
    currentAge: z.number().describe('Current age in years'),
    targetRetirementAge: z.number().describe('Target retirement age'),
    currentBalance: z.number().describe('Current retirement balance'),
    monthlyContribution: z.number().describe('Monthly contribution amount'),
    annualReturnPct: z.number().describe('Expected annual return %'),
    inflationPct: z.number().describe('Expected annual inflation %'),
    targetNestEgg: z.number().describe('Target retirement nest egg (today\'s dollars)'),
    includeDataPoints: z.boolean().optional().describe('If true, return full dataPoints array. Default false returns summary only.'),
  },
  async (params) => {
    const { includeDataPoints, ...input } = params
    const result = computeRetirementProjection(input)

    let dataPointsOutput
    if (includeDataPoints) {
      dataPointsOutput = result.dataPoints
    } else {
      const first = result.dataPoints[0]
      const retirementIdx = Math.min(
        Math.max(0, (input.targetRetirementAge - input.currentAge) * 12),
        result.dataPoints.length - 1
      )
      const atRetirement = result.dataPoints[retirementIdx]
      const last = result.dataPoints[result.dataPoints.length - 1]
      dataPointsOutput = {
        summary: true,
        totalPoints: result.dataPoints.length,
        first,
        atRetirement,
        last,
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          projectedAtRetirement: result.projectedAtRetirement,
          hitsGoal: result.hitsGoal,
          surplus: result.surplus,
          shortfall: result.shortfall,
          monthlyToReachGoal: result.monthlyToReachGoal,
          dataPoints: dataPointsOutput,
        }, null, 2),
      }],
    }
  }
)

// ---------------------------------------------------------------------------
// 5. get_state_tax_rates
// ---------------------------------------------------------------------------
server.tool(
  'get_state_tax_rates',
  'Look up suggested effective tax rate for a US state. Optionally compute monthly take-home and minimum gross salary for given expenses.',
  {
    stateCode: z.string().describe('Two-letter US state code (e.g. "CA", "TX")'),
    grossAnnualSalary: z.number().optional().describe('Gross annual salary for take-home calculation'),
    monthlyExpenses: z.number().optional().describe('Monthly expenses for minimum salary calculation'),
  },
  async ({ stateCode, grossAnnualSalary, monthlyExpenses }) => {
    const code = stateCode.toUpperCase()
    const state = US_STATES.find(s => s.code === code)
    if (!state) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown state code: ${code}`, validCodes: US_STATES.map(s => s.code) }) }] }
    }

    const result = {
      state: state.name,
      code: state.code,
      suggestedEffectiveRate: state.suggestedEffectiveRate,
    }

    if (grossAnnualSalary != null) {
      result.monthlyTakeHome = computeMonthlyTakeHome(grossAnnualSalary, state.suggestedEffectiveRate)
      result.annualTakeHome = result.monthlyTakeHome * 12
    }

    if (monthlyExpenses != null) {
      result.minimumGrossSalary = computeMinimumGrossSalary(monthlyExpenses, state.suggestedEffectiveRate)
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// 6. validate_financial_data
// ---------------------------------------------------------------------------
server.tool(
  'validate_financial_data',
  'Validate and sanitize financial data (savingsAccounts, creditCards, investments). Returns cleaned data or null if invalid.',
  {
    data: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.record(z.union([z.string(), z.number(), z.boolean()])))])).describe('Object with savingsAccounts, creditCards, and/or investments arrays to validate'),
  },
  async ({ data }) => {
    const result = validateSyncState(data)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          valid: result !== null,
          sanitized: result,
        }, null, 2),
      }],
    }
  }
)

// ---------------------------------------------------------------------------
// 7. compute_goal_progress
// ---------------------------------------------------------------------------
server.tool(
  'compute_goal_progress',
  'Compute progress metrics for a financial goal given the current app state.',
  {
    goal: z.object({
      targetAmount: z.number().describe('Goal target amount'),
      currentAmount: z.number().optional().describe('Manual current value (for manual data source)'),
      targetDate: z.string().optional().describe('Target completion date (ISO string)'),
      monthlyContribution: z.number().optional().describe('Monthly contribution toward this goal'),
      dataSource: z.object({
        type: z.enum(['manual', 'savingsAccount', 'savingsAccounts', 'investmentTotal', 'debtPayoff']).optional(),
        accountIds: z.array(z.union([z.string(), z.number()])).optional(),
      }).optional().describe('Where to pull current value from'),
    }).describe('Goal configuration'),
    appState: z.object({
      savingsAccounts: z.array(z.object({ id: z.union([z.string(), z.number()]), amount: z.number().optional(), active: z.boolean().optional() })).optional(),
      investments: z.array(z.object({ monthlyAmount: z.number().optional(), active: z.boolean().optional() })).optional(),
      creditCards: z.array(z.object({ id: z.union([z.string(), z.number()]), balance: z.number().optional() })).optional(),
    }).optional().describe('Current app state for data source resolution'),
  },
  async ({ goal, appState }) => {
    const result = computeGoalProgress(goal, appState || {})
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// 8. compute_cc_payoff
// ---------------------------------------------------------------------------
server.tool(
  'compute_cc_payoff',
  'Simulate credit card payoff trajectory. Returns months to payoff, total interest paid, and monthly balance snapshots.',
  {
    balance: z.number().describe('Current card balance'),
    apr: z.number().describe('Annual percentage rate'),
    minimumPayment: z.number().optional().describe('Minimum monthly payment'),
    paymentStrategy: z.enum(['minimum', 'fixed', 'full']).optional().describe('Payment strategy'),
    paymentAmount: z.number().optional().describe('Fixed payment amount (for "fixed" strategy)'),
  },
  async (params) => {
    const card = {
      balance: params.balance,
      apr: params.apr,
      minimumPayment: params.minimumPayment || 0,
      paymentStrategy: params.paymentStrategy || 'minimum',
      paymentAmount: params.paymentAmount,
    }
    const payment = getEffectivePayment(card)

    if (card.paymentStrategy === 'full') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            strategy: 'full',
            monthsToPayoff: 1,
            totalInterest: 0,
            totalPaid: card.balance,
            message: 'Balance paid in full each month — no interest accrues.',
          }, null, 2),
        }],
      }
    }

    if (payment <= 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Payment amount must be greater than 0.' }, null, 2),
        }],
      }
    }

    const monthlyRate = card.apr / 100 / 12
    let bal = card.balance
    let totalInterest = 0
    let months = 0
    const snapshots = []
    const MAX = 600 // 50 years cap

    while (bal > 0.01 && months < MAX) {
      const interest = bal * monthlyRate
      totalInterest += interest
      bal = Math.max(0, bal + interest - payment)
      months++
      if (months <= 60 || months % 12 === 0 || bal <= 0.01) {
        snapshots.push({ month: months, balance: Math.round(bal * 100) / 100, interestThisMonth: Math.round(interest * 100) / 100 })
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          strategy: card.paymentStrategy,
          monthlyPayment: payment,
          monthsToPayoff: months,
          yearsToPayoff: Math.round(months / 12 * 10) / 10,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalPaid: Math.round((card.balance + totalInterest) * 100) / 100,
          paidOff: bal <= 0.01,
          snapshots,
        }, null, 2),
      }],
    }
  }
)

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport()
await server.connect(transport)
