/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 深色基底
        base: {
          900: "#0a0a0b",
          800: "#0f0f11",
          700: "#141416",
          600: "#1a1a1e",
          500: "#232328",
          400: "#2e2e35",
          300: "#3a3a42",
        },
        // 品牌琥珀金
        amber: {
          DEFAULT: "#f5a623",
          glow: "#f5a62333",
        },
        // 青绿（数据流）
        teal: {
          DEFAULT: "#2dd4bf",
          glow: "#2dd4bf33",
        },
        // 日志级别
        level: {
          trace: "#64748b",
          debug: "#818cf8",
          info: "#60a5fa",
          warn: "#fbbf24",
          error: "#f87171",
          fatal: "#e879f9",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "count-up": "countUp 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245,166,35,0.3)" },
          "50%": { boxShadow: "0 0 0 6px rgba(245,166,35,0)" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
