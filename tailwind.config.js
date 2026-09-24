/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f1ff',
          100: '#e9e2ff',
          200: '#d5c7ff',
          300: '#b79eff',
          400: '#966bff',
          500: '#7c42ff',
          600: '#6d28f5',
          700: '#5b1fd1',
          800: '#4c1da8',
          900: '#3f1c87',
          950: '#260e5c'
        },
        ink: {
          900: '#0c0a1a',
          800: '#141128',
          700: '#1c1836',
          600: '#251f47',
          500: '#322a5c'
        }
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 24px rgba(124, 66, 255, 0.35)',
        card: '0 8px 30px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
}
