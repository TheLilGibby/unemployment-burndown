import { render, screen } from '../test/test-utils'
import NotFoundPage from './NotFoundPage'

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
  })

  it('renders the Page Not Found subheading', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument()
  })

  it('renders a link back to the dashboard', () => {
    render(<NotFoundPage />)
    const link = screen.getByRole('link', { name: /go to dashboard/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders a Go Back button', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })
})
