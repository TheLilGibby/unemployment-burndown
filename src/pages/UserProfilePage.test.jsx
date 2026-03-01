import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import UserProfilePage from './UserProfilePage'
import * as useAuthModule from '../hooks/useAuth'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

describe('UserProfilePage', () => {
  it('shows loading state when user is null', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      logout: vi.fn(),
    })

    render(<UserProfilePage />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders user profile when user is loaded', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        email: 'test@example.com',
        name: 'Test User',
        mfaEnabled: true,
        organizationId: 'org-123',
        organizationName: 'Test Org',
      },
      logout: vi.fn(),
    })

    render(<UserProfilePage />)
    
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
    expect(screen.getByText('MFA Enabled')).toBeInTheDocument()
  })

  it('shows MFA not enabled when mfaEnabled is false', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        email: 'test@example.com',
        mfaEnabled: false,
      },
      logout: vi.fn(),
    })

    render(<UserProfilePage />)
    
    expect(screen.getByText('MFA Not Enabled')).toBeInTheDocument()
  })

  it('has Sign Out button', () => {
    const mockLogout = vi.fn()
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        email: 'test@example.com',
      },
      logout: mockLogout,
    })

    render(<UserProfilePage />)
    
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
