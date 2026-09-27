/**
 * AeroFareX Tailwind preset — maps tokens.css custom properties onto Tailwind's
 * theme so components consume `bg-page`, `text-primary`, `border-border`, etc.
 * instead of raw hex values. Placeholder until apps/web's Tailwind config is wired up.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        /* Brand palette (brand.css) */
        sky: {
          100: "var(--sky-100)",
          200: "var(--sky-200)",
          300: "var(--sky-300)",
          400: "var(--sky-400)",
          500: "var(--sky-500)",
          600: "var(--sky-600)",
          800: "var(--sky-800)",
          900: "var(--sky-900)",
        },
        ink: "var(--ink)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "on-accent": "var(--on-accent)",
        "surface-alt": "var(--surface-alt)",
        "surface-tint": "var(--surface-tint)",
        "surface-band": "var(--surface-band)",
        "text-1": "var(--text-1)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        "text-deep": "var(--text-deep)",
        line: "var(--line)",
        "line-sky": "var(--line-sky)",
        "line-strong": "var(--line-strong)",
        "line-deep": "var(--line-deep)",
        /* UI + data-viz roles (tokens.css) */
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        brand: "var(--brand)",
        "brand-accent": "var(--brand-accent)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        grid: "var(--grid)",
        axis: "var(--axis)",
        border: "var(--border)",
        "slot-1": "var(--slot-1)",
        "slot-2": "var(--slot-2)",
        "slot-3": "var(--slot-3)",
        "slot-4": "var(--slot-4)",
        "slot-5": "var(--slot-5)",
        "diverge-up": "var(--diverge-up)",
        "diverge-down": "var(--diverge-down)",
        "status-good": "var(--status-good)",
        "status-warning": "var(--status-warning)",
        "status-serious": "var(--status-serious)",
        "status-critical": "var(--status-critical)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        pill: "var(--r-pill)",
      },
      boxShadow: {
        e1: "var(--e-1)",
        e2: "var(--e-2)",
        e3: "var(--e-3)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
      },
    },
  },
};
