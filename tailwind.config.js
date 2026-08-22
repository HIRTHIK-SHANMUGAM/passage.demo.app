/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        parchment: 'var(--parchment)',
        orange: 'var(--orange)',
        'orange-dim': 'var(--orange-dim)',
        green: 'var(--green)',
        amber: 'var(--amber)',
        red: 'var(--red)',
        slate: 'var(--slate)',
        'slate-2': 'var(--slate-2)',
      },
      borderColor: {
        hairline: 'rgba(246,241,227,0.10)',
        'hairline-strong': 'rgba(246,241,227,0.18)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '18px',
        btn: '10px',
      },
    },
  },
  plugins: [],
};
