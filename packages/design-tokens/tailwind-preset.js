/**
 * AirFare Tailwind preset — maps tokens.css custom properties onto Tailwind's
 * theme so components consume `bg-page`, `text-primary`, `border-border`, etc.
 * instead of raw hex values. Placeholder until apps/web's Tailwind config is wired up.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
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
