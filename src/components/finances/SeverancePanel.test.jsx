import { render, screen, fireEvent } from '../../test/test-utils'
import SeverancePanel from './SeverancePanel'
import { DEFAULTS } from '../../constants/defaults'

const defaultSeverance = { ...DEFAULTS.severance }

describe('SeverancePanel', () => {
  it('renders toggle in disabled state by default', () => {
    render(<SeverancePanel value={defaultSeverance} onChange={() => {}} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('does not show payment structure select when disabled', () => {
    render(<SeverancePanel value={defaultSeverance} onChange={() => {}} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('calls onChange with enabled=true when toggle is clicked', () => {
    const onChange = vi.fn()
    render(<SeverancePanel value={defaultSeverance} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })

  it('shows detail fields when enabled', () => {
    render(<SeverancePanel value={{ ...defaultSeverance, enabled: true }} onChange={() => {}} />)
    // Payment structure select should appear
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // Text labels should appear
    expect(screen.getByText(/Gross Severance Amount/i)).toBeInTheDocument()
    expect(screen.getByText(/Federal Withholding Rate/i)).toBeInTheDocument()
  })

  it('shows continuationMonths field only for salary_continuation', () => {
    const { rerender } = render(
      <SeverancePanel
        value={{ ...defaultSeverance, enabled: true, paymentStructure: 'lump_sum' }}
        onChange={() => {}}
      />
    )
    // Continuation months label only shows for salary_continuation
    expect(screen.queryByText(/\bContinuation Months\b/i)).not.toBeInTheDocument()

    rerender(
      <SeverancePanel
        value={{ ...defaultSeverance, enabled: true, paymentStructure: 'salary_continuation' }}
        onChange={() => {}}
      />
    )
    expect(screen.getAllByText(/Continuation Months/i).length).toBeGreaterThan(0)
  })

  it('displays computed net severance in summary', () => {
    render(
      <SeverancePanel
        value={{
          ...defaultSeverance,
          enabled: true,
          grossAmount: 10000,
          taxWithholdingPct: 22,
          stateTaxPct: 5,
        }}
        onChange={() => {}}
      />
    )
    // Net = 10000 * (1 - 0.27) = 7300
    expect(screen.getByText(/Net severance:/)).toBeInTheDocument()
    // Multiple elements may show the same dollar amount (net + total)
    expect(screen.getAllByText(/\$7,300\.00/).length).toBeGreaterThan(0)
  })

  it('shows runway extension when withRunwayMonths > baseRunwayMonths', () => {
    render(
      <SeverancePanel
        value={{ ...defaultSeverance, enabled: true, grossAmount: 50000, taxWithholdingPct: 22, stateTaxPct: 0 }}
        onChange={() => {}}
        baseRunwayMonths={6}
        withRunwayMonths={9}
      />
    )
    expect(screen.getByText(/Severance extends your runway by/i)).toBeInTheDocument()
    expect(screen.getByText(/~3\.0 months/i)).toBeInTheDocument()
  })

  it('does not show runway extension when disabled', () => {
    render(
      <SeverancePanel
        value={defaultSeverance}
        onChange={() => {}}
        baseRunwayMonths={6}
        withRunwayMonths={9}
      />
    )
    expect(screen.queryByText(/Severance extends your runway by/i)).not.toBeInTheDocument()
  })

  it('calls onChange when payment structure changes', () => {
    const onChange = vi.fn()
    render(
      <SeverancePanel
        value={{ ...defaultSeverance, enabled: true }}
        onChange={onChange}
      />
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'salary_continuation' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ paymentStructure: 'salary_continuation' }))
  })

  it('shows delaysUnemployment checkbox', () => {
    render(
      <SeverancePanel value={{ ...defaultSeverance, enabled: true }} onChange={() => {}} />
    )
    expect(screen.getByText(/Severance delays unemployment eligibility/i)).toBeInTheDocument()
  })
})
