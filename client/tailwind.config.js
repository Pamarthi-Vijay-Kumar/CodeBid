/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#080B12',
          900: '#0A0E17',
          800: '#121826',
          700: '#1A2233',
          600: '#232C40',
          500: '#323D57',
        },
        gold: {
          400: '#FFC94D',
          500: '#F5B300',
          600: '#D69600',
        },
        teal: {
          300: '#6FE9D8',
          400: '#33D6C0',
          500: '#1FB8A4',
        },
        coral: {
          400: '#FF7A7A',
          500: '#FF5C5C',
          600: '#E23F3F',
        },
        mist: {
          100: '#EDEFF4',
          300: '#B7BECC',
          500: '#8A93A6',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(245,179,0,0.25), 0 0 24px rgba(245,179,0,0.18)',
        'glow-teal': '0 0 0 1px rgba(51,214,192,0.25), 0 0 24px rgba(51,214,192,0.18)',
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '28px 28px',
      },
      keyframes: {
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        pulseRing: { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      },
      animation: {
        ticker: 'ticker 22s linear infinite',
        pulseRing: 'pulseRing 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
