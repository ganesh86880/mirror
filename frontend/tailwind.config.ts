import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: "#11141A",
          surface: "#161B22",
          panel: "#1C2128",
          border: "#30363D",
          text: "#F0F6FC",
          muted: "#8B949E",
          crimson: "#C53030",
          amber: "#D97706",
          green: "#2E856E",
          flood: "#1D4E89",
        },
      },
      fontFamily: {
        mono: ["Consolas", "Monaco", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
