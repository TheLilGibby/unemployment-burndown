import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '../test/test-utils'
import UserProfilePage from './UserProfilePage'
import * as useAuthModule from '../hooks/useAuth'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

// Mock the ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
  ThemeProvider: ({ children }) => children,
}))

// Mock the HiddenModeContext
vi.mock('../context/HiddenModeContext', () => ({
  useHiddenMode: () => ({ hidden: false, setHidden: vi.fn(), toggleHidden: vi.fn() }),
  HiddenModeProvider: ({ children }) => children,
}))

// Mock the NotificationsContext
vi.mock('../context/NotificationsContext', () => ({
  useNotificationsContext: () => ({
    preferences: {
      enabled: true,
      mutedUntil: null,
      thresholds: { runwayCritical: 3, runwayWarning: 6, benefitEndDays: 30 },
    },
    onPreferencesChange: vi.fn(),
    updatePreferences: vi.fn(),
    updateThreshold: vi.fn(),
    snooze: vi.fn(),
    unsnooze: vi.fn(),
  }),
}))

// Mock heavy child components to simplify the rendered DOM
vi.mock('../components/notifications/AlertSettings', () => ({
  default: () => null,
}))

vi.mock('../components/auth/MfaSetup', () => ({
  default: () => null,
}))

describe('UserProfilePage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state when user is null', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      logout: vi.fn(),
      deleteAccount: vi.fn(),
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
      deleteAccount: vi.fn(),
    })

    render(<UserProfilePage />)

    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0)
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0)
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('shows MFA not enabled when mfaEnabled is false', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        email: 'test@example.com',
        mfaEnabled: false,
      },
      logout: vi.fn(),
      deleteAccount: vi.fn(),
    })

    render(<UserProfilePage />)

    expect(screen.getByText('Not enabled')).toBeInTheDocument()
  })

  it('has Sign Out button', () => {
    const mockLogout = vi.fn()
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: {
        email: 'test@example.com',
      },
      logout: mockLogout,
      deleteAccount: vi.fn(),
    })

    render(<UserProfilePage />)

    expect(screen.getByText('Sign out', { selector: 'button' })).toBeInTheDocument()
  })
})
