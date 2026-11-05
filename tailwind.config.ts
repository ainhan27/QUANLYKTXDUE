import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        due: {
          blue: '#125FA9',
          'blue-dark': '#0B4378',
          'blue-deep': '#072E54',
          orange: '#F26422',
          'orange-hover': '#D94F12',
          gold: '#F26422',
          light: '#F4F7FB',
        },
      },
    },
  },
  plugins: [],
};
export default config;
