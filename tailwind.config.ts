import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e1edff',
          200: '#bcd4ff',
          300: '#8bb3ff',
          400: '#5e91ff',
          500: '#2f70ff',
          600: '#1f58d6',
          700: '#1743a3',
          800: '#102e70',
          900: '#091b40'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
