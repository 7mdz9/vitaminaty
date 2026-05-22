import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        action: "var(--color-action)",
        "action-hover": "var(--color-action-hover)",
        "cod-gray": "var(--color-cod-gray)",
        "deep-maroon": "var(--color-deep-maroon)",
        "apple-blossom": "var(--color-apple-blossom)",
        fantasy: "var(--color-fantasy)",
        "dawn-pink": "var(--color-dawn-pink)",
        "faded-red": "var(--color-faded-red)",
        scorpion: "var(--color-scorpion)",
        white: "var(--color-white)",
        success: "var(--color-success)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
        },
        surface: {
          page: "var(--color-surface-page)",
          card: "var(--color-surface-card)",
          alt: "var(--color-surface-alt)",
          dark: "var(--color-surface-dark)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          subtle: "var(--color-border-subtle)",
        },
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
      },
      fontSize: {
        micro: "var(--fs-micro)",
        caption: "var(--fs-caption)",
        "body-sm": "var(--fs-body-sm)",
        body: "var(--fs-body)",
        "body-lg": "var(--fs-body-lg)",
        h4: "var(--fs-h4)",
        h3: "var(--fs-h3)",
        h2: "var(--fs-h2)",
        h1: "var(--fs-h1)",
      },
      fontWeight: {
        regular: "var(--fw-regular)",
        medium: "var(--fw-medium)",
        semibold: "var(--fw-semibold)",
        bold: "var(--fw-bold)",
        extrabold: "var(--fw-extrabold)",
      },
      lineHeight: {
        tight: "var(--lh-tight)",
        normal: "var(--lh-normal)",
        relaxed: "var(--lh-relaxed)",
      },
      letterSpacing: {
        tight: "var(--ls-tight)",
        wide: "var(--ls-wide)",
        wider: "var(--ls-wider)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        9: "var(--space-9)",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        overlay: "var(--shadow-overlay)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
      },
      zIndex: {
        header: "var(--z-header)",
        drawer: "var(--z-drawer)",
        chat: "var(--z-chat)",
      },
      maxWidth: {
        container: "var(--container-max)",
      },
    },
  },
  plugins: [],
};

export default config;
