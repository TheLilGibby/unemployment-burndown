import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Append hex alpha to a resolved color value.
 * Accepts 0-1 float or a two-char hex string (e.g. 'bb', '80').
 */
function withAlpha(color, alpha) {
  if (typeof alpha === 'number') {
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0')
  }
  return color + alpha
}

/**
 * Returns resolved chart color values from CSS custom properties.
 * Re-computes when the theme changes so Recharts gets the correct values.
 */
export function useChartColors() {
  const { resolved } = useTheme()

  return useMemo(() => {
    const colors = {
      // Accent palette
      blue:       css('--accent-blue'),
      emerald:    css('--accent-emerald'),
      teal:       css('--accent-teal'),
      red:        css('--accent-red'),
      amber:      css('--accent-amber'),
      purple:     css('--accent-purple'),
      orange:     css('--accent-orange'),
      cyan:       css('--accent-cyan'),

      // Chart infrastructure
      grid:           css('--chart-grid'),
      tick:           css('--chart-tick'),
      tooltipBg:      css('--chart-tooltip-bg'),
      tooltipBorder:  css('--chart-tooltip-border'),

      // Surfaces & text
      bgPage:         css('--bg-page'),
      bgCard:         css('--bg-card'),
      bgHover:        css('--bg-hover'),
      borderDefault:  css('--border-default'),
      borderSubtle:   css('--border-subtle'),
      textPrimary:    css('--text-primary'),
      textSecondary:  css('--text-secondary'),
      textMuted:      css('--text-muted'),
      textFaint:      css('--text-faint'),

      // Helper to create alpha variants
      withAlpha,
    }
    return colors
  }, [resolved])
}
