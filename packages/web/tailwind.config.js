/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-elevated": "var(--color-bg-elevated)",
        "card-bg": "var(--color-card-bg)",
        accent: "var(--color-accent)",
        "accent-soft": "var(--color-accent-soft)",
        "text-primary": "var(--color-text-primary)",
        "text-muted": "var(--color-text-muted)",
        "border-subtle": "var(--color-border-subtle)",
        "composer-outer": "var(--color-composer-outer)",
        "composer-send": "var(--color-composer-send)",
        "composer-icon": "var(--color-composer-icon)",
        "sidebar-bg": "var(--color-sidebar-bg)",
        "sidebar-hover": "var(--color-sidebar-item-hover)",
        "sidebar-sender": "var(--color-sidebar-sender)",
        "sidebar-unread": "var(--color-sidebar-unread)"
      },
      spacing: {
        sidebar: "299px",
        header: "123px",
        "panel-right": "299px"
      },
      borderRadius: {
        lg: "16px"
      }
    }
  },
  plugins: [
    require("tailwind-scrollbar")({ nocompatible: true })
  ]
};

