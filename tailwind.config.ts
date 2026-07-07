import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#121212', // base app background
          elevated: '#1A1A1A', // cards, panels one level up
          surface: '#1E1E1E', // inputs, message bubbles (incoming)
          overlay: '#242424', // modals, dropdowns
        },
        primary: {
          DEFAULT: '#BB86FC',
          hover: '#CBA0FD',
          muted: '#3B2E52', // low-opacity tint for backgrounds/borders
        },
        secondary: {
          DEFAULT: '#03DAC6',
          hover: '#33E4D4',
          muted: '#0B3D38',
        },
        border: {
          DEFAULT: '#2A2A2A',
          strong: '#3A3A3A',
        },
        content: {
          primary: '#EDEDED',
          secondary: '#A0A0A0',
          disabled: '#5C5C5C',
        },
        danger: '#CF6679',
        success: '#03DAC6',
        status: {
          online: '#22C55E', // green-500
          away: '#EAB308', // yellow-500
          dnd: '#EF4444', // red-500
          offline: '#9CA3AF', // gray-400
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        panel: '0 4px 24px rgba(0, 0, 0, 0.45)',
        glow: '0 0 0 1px rgba(187, 134, 252, 0.15), 0 0 24px rgba(187, 134, 252, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
