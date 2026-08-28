/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          DEFAULT: 'var(--lime)',
          glow: 'var(--lime-glow)',
        },
        mint: 'var(--mint)',
        orange: 'var(--orange)',
        red: 'var(--red)',
      },
      fontFamily: {
        sans: ['Outfit', 'DM Sans', '-apple-system', 'sans-serif'],
        title: ['Space Grotesk', 'Outfit', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
