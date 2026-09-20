---
name: Subsumran Design System (Rose Gold Edition)
description: Premium Rose Gold & Metallic Gold financial excellence and customer service system for LINE LIFF
colors:
  primary: "#d83a78"
  secondary: "#8b6f20"
  secondary-container: "#fed65b"
  secondary-fixed: "#f7e7b4"
  surface: "#fff0f4"
  on-surface: "#3a1523"
  outline-variant: "#e5c4d0"
  gold-border: "#c5a059"
  error: "#ba1a1a"
typography:
  display:
    fontFamily: "Be Vietnam Pro, Sarabun, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Be Vietnam Pro, Sarabun, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
  title:
    fontFamily: "Be Vietnam Pro, Sarabun, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Be Vietnam Pro, Sarabun, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Be Vietnam Pro, Sarabun, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
rounded:
  sm: "4px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  base: "8px"
  sm: "12px"
  md: "16px"
  gutter: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Subsumran Design System

## 1. Overview

**Creative North Star: "The Prestigious Sanctuary"**

The Subsumran Design System combines high-end financial prestige with absolute tactile clarity. Built specifically for mobile-first LINE LIFF interfaces, the system relies on deep rich navy and gold tones, clear spatial layouts (bento-grid patterns), and robust typographic hierarchy to instill trust and convenience for everyday Thai users.

It rejects cluttered banking structures and tacky quick-loan designs in favor of soft surfaces, highly readable typography, and generous tap targets that feel both premium and highly accessible.

**Key Characteristics:**
- **Saturated Confidence**: Deep Navy (`#00193c`) anchors the canvas, paired with rich metallic Gold accents (`#735c00`).
- **Tactile Grid Rhythm**: Bento-box cards with soft boundaries (`16px` border radius) organize information hierarchy without overflow.
- **Welcoming Typography**: Balanced bilingual pairings (Be Vietnam Pro and Sarabun) optimized for ease of reading.
- **Frictionless Affordances**: Primary action points are easily identifiable with solid colors and clear micro-interactions.

## 2. Colors

The Subsumran palette leverages high-contrast premium tones to guide focus and express reliable security.

### Primary
- **Subsumran Deep Navy** (`#00193c`): The foundational color. Used for high-level structure, header banners, and primary branding. Always contrasts against white text.

### Secondary
- **Subsumran Rich Gold** (`#735c00`): The accent of prestige and quality. Used for secondary focus actions, indicators, and important highlights.
- **Subsumran Container Gold** (`#fed65b`): A warm golden yellow used for background highlights and prominent promotional callouts.
- **Subsumran Soft Gold** (`#ffe088`): A pale, pleasant gold used for button fills and active states.

### Neutral
- **Subsumran Ivory Surface** (`#f9f9fc`): The soft, off-white background color that keeps the app feeling warm and approachable.
- **Subsumran Ink Slate** (`#1a1c1e`): The default ink color for headings and text. Fulfills contrast standards easily.
- **Subsumran Outline Grey** (`#c4c6d1`): Gentle border line color for crisp grid dividers.

**The Golden Accents Rule.** Gold acts strictly as a luxury accent or focus state. It must never occupy more than 15% of the total screen space to preserve its premium quality.

## 3. Typography

**Display Font:** Be Vietnam Pro (with sans-serif)
**Body Font:** Sarabun (with sans-serif)

**Character:** Highly professional bilingual pairing. Be Vietnam Pro provides structure and geometric balance to English headings, while Sarabun offers smooth legibility and natural flow for Thai sentences.

### Hierarchy
- **Display** (Bold, `32px`, `40px` line-height): Reserved for large, critical numbers and hero statements.
- **Headline** (Semi-bold, `24px`, `32px` line-height): Used for primary screen sections.
- **Title** (Semi-bold, `20px`, `28px` line-height): Used for card headings and modal titles.
- **Body** (Regular, `14px`, `20px` line-height): Main information and description text. Cap line length at `65ch`.
- **Label** (Medium, `12px`, `16px` line-height): Small status labels, button labels, and secondary tags.

## 4. Elevation

The system relies on a flat-by-default philosophy combined with subtle, high-blur ambient shadows to convey hierarchy and tactile feedback without introducing visual noise.

### Shadow Vocabulary
- **Ambient Low** (`box-shadow: 0 4px 24px rgba(0,0,0,0.06)`): Used on bento cards and modals at rest.
- **Active Lift** (`box-shadow: 0 8px 32px rgba(0,0,0,0.12)`): Triggered on hover or active pressed states to show physical depth.

**The No-Border-Gradients Rule.** Shadows are always soft, gray-tinted, and diffuse. They are never paired with thick solid borders or colored gradients.

## 5. Components

### Buttons
- **Shape:** Rounded Medium (`12px` radius)
- **Primary:** solid Deep Navy background (`#00193c`), white text (`#ffffff`), inside padding of `8px 16px`.
- **Secondary:** solid Soft Gold background (`#ffe088`), Navy text (`#00193c`), inside padding of `8px 16px`.
- **Hover / Focus:** Scale transitions of `transform: scale(1.02)` and transition speed of `0.2s`.

### Cards / Containers
- **Corner Style:** Rounded Large (`16px` radius)
- **Background:** White (`#ffffff`) or Soft Ivory Surface (`#f9f9fc`)
- **Shadow Strategy:** Ambient Low shadow (`0 4px 24px rgba(0,0,0,0.06)`)
- **Border:** `1px` solid border (`#c4c6d1`) if border is used instead of shadow. Never use both high-shadow and thick solid borders.

### Inputs / Fields
- **Style:** `1px` stroke outline (`#c4c6d1`), White background (`#ffffff`), Rounded Medium (`12px` radius).
- **Focus:** Strong Navy border (`#00193c`) with an inner focus glow.

## 6. Do's and Don'ts

### Do:
- **Do** maintain a strict 4.5:1 text-to-background contrast ratio, particularly for Thai scripts where legibility is critical.
- **Do** use exact `12px` and `16px` border-radii for interactive elements to keep a soft, cohesive interface.
- **Do** restrict gold highlights to accents (buttons, status ticks, badges) to preserve the premium aesthetic.

### Don't:
- **Don't** use tiny tracked uppercase eyebrows above every section.
- **Don't** use side-stripe borders as indicators on list items or cards.
- **Don't** pair deep borders (`1px solid`) with large, high-blur shadows on the same card component.
- **Don't** use neon gradients or aggressive, flashing visual triggers.
