/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'media',
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Inter',
  				'sans-serif'
  			]
  		},
  		colors: {
  			'light-bg': '#ffffff',
  			'light-sidebar': '#f7f7f7',
  			'light-bg-light': '#f7f7f7',
			'light-bg-lighter': '#EDEDED',
  			'light-text': '#1a1a1a',
  			'light-border': '#e5e5e5',
			'light-border-2': 'rgba(208, 209, 238, 0.16)',
  			'light-hover': '#f0f0f0',
  			'light-accent': '#007AFF',
  			primary: '#FF661F',
  			'primary-highlight': 'rgba(255, 102, 31, 0.04)',
  			'dark-bg': '#0F0F10',
  			'dark-sidebar': '#09090C',
  			'dark-bg-light': '#111112',
  			'dark-bg-lighter': '#161617',
  			'dark-text': '#ffffff',
  			'dark-border': 'rgba(208, 209, 238, 0.06)',
  			'dark-hover': '#333333',
  			'dark-accent': '#0A84FF',
  			background: 'var(--light-bg)',
  			foreground: 'var(--light-text)',
  			'dark:background': 'var(--dark-bg)',
  			'dark:foreground': 'var(--dark-text)'
  		},
  		spacing: {
  			sidebar: '280px'
  		},
  		gridTemplateColumns: {
  			calendar: 'repeat(7, minmax(0, 1fr))'
  		},
  		height: {
  			'calendar-cell': '6rem'
  		},
  		borderRadius: {
			default: '9px',
			lg: '12px',
			md: '6px',
			sm: '4px',
			full: '9999px'
  		}
  	}
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    },
      require("tailwindcss-animate")
],
}
