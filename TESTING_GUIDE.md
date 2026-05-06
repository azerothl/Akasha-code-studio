# Testing Guide - Akasha Code Studio UX Refactor

**Branch**: `refonte-UX`  
**Focus**: Responsive Design & Accessibility (WCAG 2.1 AA)  
**Date**: December 2024  

---

## Quick Start

### 1. Run Dev Server
```bash
cd /path/to/akasha-code-studio
npm install
npm run dev
# Opens http://127.0.0.1:5178
```

### 2. Run Production Build
```bash
npm run build
npm run preview
# Preview mode at http://127.0.0.1:4173
```

---

## Responsive Design Testing

### Desktop (1920px+)
**Expected:**
- Sidebar: Fixed 240px on left
- Main content: Full width with sidebar
- Dashboard: 4-column grid
- Stack wizard: 4 preset cards per row

**Test:**
1. Open browser DevTools (F12)
2. DevTools → Device Toolbar
3. Select "No device" → Set to 1920x1080
4. Verify sidebar width and layout
5. Verify card grids are 4 columns

### Tablet (1024px)
**Expected:**
- Sidebar: 240px but narrower text
- Dashboard: 2-3 column grid
- Stack wizard: 2-3 preset cards per row
- Responsive font sizes

**Test:**
1. DevTools → Device Toolbar
2. Select "iPad" (1024x1366)
3. Verify sidebar responsive width
4. Verify grid changes to 2-3 columns
5. Check font sizes readable

### Small Tablet (768px)
**Expected:**
- Sidebar: 200px, compact
- Dashboard: Single column
- Stack wizard: 2-3 cards per row (or 1)
- Center tabs: Wrapped, smaller

**Test:**
1. DevTools → Device Toolbar
2. Select "iPad Mini" (768x1024)
3. Verify sidebar 200px
4. Verify all grids single column
5. Verify tabs wrapped

### Mobile (480px)
**Expected:**
- Sidebar: Drawer (75vw max)
- Mobile toggle button visible
- All content: Single column
- Stack wizard: 1-2 cards per row
- Touch buttons: ≥ 44x44px

**Test:**
1. DevTools → Device Toolbar
2. Select "iPhone SE" (375x667) or "iPhone 12" (390x844)
3. Verify drawer sidebar appears
4. Click hamburger button (☰) - drawer should open
5. Verify single-column layout
6. Verify touch targets are large

### Extra Small (360px)
**Expected:**
- Minimal layout
- Tabs scroll horizontally
- Single-column everything
- Very large touch targets

**Test:**
1. DevTools → Device Toolbar
2. Enter custom size: 360x640
3. Verify scrollable tabs
4. Verify single-column stack grid
5. Verify responsive font sizes

### Responsive Checklist
- [ ] Desktop (1920px): Full layout works
- [ ] Tablet (1024px): Grid adapts to 2-3 columns
- [ ] Small tablet (768px): Grid adapts to 1 column
- [ ] Mobile (480px): Drawer sidebar works, touch friendly
- [ ] Extra small (360px): Minimal layout works
- [ ] Orientation changes work (portrait/landscape)
- [ ] No horizontal scrolling on mobile
- [ ] Font sizes readable at all sizes
- [ ] Images scale properly
- [ ] Forms are touch-friendly

---

## Accessibility Testing (WCAG 2.1 AA)

### 1. Keyboard Navigation

**Goal**: Navigate entire app using only keyboard

**Test Steps**:
1. Close DevTools
2. Start from top-left of page
3. Press **Tab** repeatedly to navigate
4. Observe **focus indicator** (2px outline)
5. Press **Enter** or **Space** to activate buttons
6. Press **Esc** to close modals/drawers

**Expected**:
- ✅ All interactive elements reachable via Tab
- ✅ Focus indicator visible at all times
- ✅ Logical tab order (top→bottom, left→right)
- ✅ No keyboard traps (can Tab away from any element)
- ✅ Esc closes modals/drawers
- ✅ Shift+Tab navigates backward

**Checklist**:
- [ ] Tab navigates all buttons
- [ ] Tab navigates all links
- [ ] Tab navigates all form inputs
- [ ] Tab navigates sidebar items
- [ ] Focus indicator visible (2px outline)
- [ ] No keyboard traps
- [ ] Logical order (matches visual layout)
- [ ] Esc works in modals

---

### 2. Screen Reader Testing (NVDA - Windows)

**Installation**:
1. Download: https://www.nvaccess.org/
2. Install and launch NVDA
3. Default shortcut: Ctrl+Alt+N

**Test with NVDA**:
```
1. Start NVDA (Ctrl+Alt+N)
2. Open browser to http://127.0.0.1:5178
3. Press H to navigate to headings
4. Press T to navigate to tables/data
5. Press B to navigate to buttons
6. Press L to navigate to lists
7. Press Q to navigate to blockquotes
```

**What NVDA Should Announce**:
- "Code Studio navigation" (on sidebar)
- "Dashboard" (tab name)
- "Tableau de bord" (French labels)
- "Stack Wizard" (wizard title)
- "Preset card button: React - Modern JS framework" (button labels)
- "Checkbox: Include Vitest" (for addons)

**Common Issues to Check**:
- [ ] Buttons announced with accessible names
- [ ] Form labels announced with inputs
- [ ] Links announced with descriptive text
- [ ] Images have alt text (or empty for decorative)
- [ ] Headings announced in order (H1 > H2 > H3)
- [ ] Lists announced correctly
- [ ] Tables have proper header/cell association

**Navigation Keys**:
```
H = Next heading
Shift+H = Previous heading
T = Next table
B = Next button
L = Next list
Q = Next blockquote
R = Next radio button
X = Next checkbox
Ctrl+Alt+Arrows = Read tables
```

---

### 3. Color Contrast Testing

**Online Tool**: https://webaim.org/resources/contrastchecker/

**Test Steps**:
1. Open contrast checker
2. Copy foreground color: #e5e7eb (light gray)
3. Copy background color: #0f0f0f (dark)
4. Paste into checker
5. Verify ratio ≥ 4.5:1 (WCAG AA)

**Expected Contrasts**:
- Text on background: 17.5:1 ✅ (exceeds 4.5:1)
- Buttons on background: 15:1 ✅ (exceeds 4.5:1)
- Links on background: 15:1 ✅ (exceeds 4.5:1)

**Test in Browser**:
1. F12 → Elements tab
2. Select element with text
3. Look at "Computed" styles
4. Note text color (e.g., #e5e7eb)
5. Note background color (e.g., #0f0f0f)
6. Check contrast ratio in WebAIM

**Checklist**:
- [ ] All text has ≥ 4.5:1 contrast
- [ ] All buttons have ≥ 4.5:1 contrast
- [ ] All links have ≥ 4.5:1 contrast
- [ ] Disabled buttons still readable
- [ ] Focus indicator has high contrast

---

### 4. Focus Indicator Testing

**Goal**: Verify visible focus on all interactive elements

**Test Steps**:
1. F12 → Elements tab
2. Click any button (see focus)
3. Press Tab (focus moves to next element)
4. Observe 2px outline on focused element

**Expected**:
- ✅ 2px solid outline (color: var(--akasha-accent) = #8b5cf6)
- ✅ Outline offset: 2px (outside element)
- ✅ Visible on: buttons, inputs, links, accordion headers

**Check CSS**:
```css
*:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}
```

**Checklist**:
- [ ] Buttons have focus outline
- [ ] Inputs have focus outline
- [ ] Links have focus outline
- [ ] Sidebar items have focus outline
- [ ] Accordion headers have focus outline
- [ ] Focus outline is 2px and visible
- [ ] Focus outline color is var(--akasha-accent)

---

### 5. ARIA Labels Testing

**Goal**: Verify all buttons have accessible names

**Test with NVDA or Lighthouse**:

**Method 1: NVDA**
1. Open NVDA
2. Navigate with Tab key
3. Listen to what NVDA announces
4. Should hear button names like "Open menu" or "Dashboard"

**Method 2: Chrome DevTools Lighthouse**
1. F12 → Lighthouse tab
2. Select "Accessibility"
3. Click "Analyze page load"
4. Review results for missing aria-labels

**Expected ARIA Labels**:
- `<button aria-label="Ouvrir/fermer le menu">☰</button>`
- `<button aria-label="Dashboard: Project overview">📊</button>`
- `<button aria-label="React: Modern JavaScript framework">` (preset card)
- `<input aria-label="Include Vitest (Testing)" type="checkbox">`

**Check HTML**:
1. F12 → Elements tab
2. Right-click button → "Inspect"
3. Look for `aria-label` attribute
4. Verify label is descriptive

**Checklist**:
- [ ] Icon-only buttons have aria-label
- [ ] Preset cards have aria-label
- [ ] Addon checkboxes have aria-label
- [ ] Sidebar items have aria-label
- [ ] All aria-labels are descriptive
- [ ] No generic labels like "button" or "item"

---

### 6. Font Size & Readability

**Goal**: Verify readable font sizes at all device sizes

**Desktop (16px base)**:
- Body text: 16px
- Headings: 24px (h1), 20px (h2), 18px (h3)
- Line height: 1.6 (body), 1.3 (headings)

**Mobile (14px minimum)**:
- Adjusted for screen size
- Still readable without zoom
- Min 14px on form inputs (prevents iOS zoom)

**Test**:
1. F12 → Elements tab
2. Inspect text element
3. Check "Computed" → font-size
4. Verify size ≥ 16px (desktop) or ≥ 14px (mobile)
5. Read text comfortably without zoom

**Checklist**:
- [ ] Body text ≥ 16px (desktop)
- [ ] Form inputs ≥ 14px
- [ ] Headings ≥ 18px
- [ ] Line height ≥ 1.5
- [ ] Text readable without zoom
- [ ] No text smaller than 12px (except hints/captions)

---

### 7. Touch Target Sizes

**Goal**: Verify buttons are ≥ 44x44 pixels (accessible)

**Test on Mobile**:
1. DevTools → Device Toolbar (480px)
2. Try clicking buttons with finger (or mouse)
3. Verify easy to click (not too small)
4. Verify 8px spacing between targets

**Measure in DevTools**:
1. Right-click button → "Inspect"
2. Right-click in Inspector → "Measure"
3. Drag to measure element
4. Verify width ≥ 44px AND height ≥ 44px

**Expected**:
- Buttons: 44x44px minimum
- Sidebar items: 44x44px minimum
- Checkboxes: 18x18px + padding
- Links: 44x44px clickable area

**Checklist**:
- [ ] Buttons ≥ 44x44px
- [ ] Links ≥ 44x44px
- [ ] Form inputs ≥ 44px height
- [ ] Checkboxes ≥ 18x18px
- [ ] 8px spacing between targets
- [ ] Easy to click on mobile

---

### 8. Semantic HTML & Landmarks

**Goal**: Verify semantic structure for screen readers

**Test with NVDA**:
1. Open NVDA
2. Press R to navigate to regions/landmarks
3. Expected landmarks:
   - `<nav>` for sidebar
   - `<main>` for main content
   - `<section>` for major sections

**Check HTML**:
1. F12 → Elements tab
2. Ctrl+F → Search for `<nav>`
3. Search for `<main>`
4. Search for `<section>`
5. Verify elements are semantic

**Expected Structure**:
```html
<nav aria-label="Navigation principale">
  {/* Sidebar */}
</nav>

<main>
  {/* Main content */}
  <section>
    {/* Dashboard */}
  </section>
</main>
```

**Checklist**:
- [ ] `<nav>` tags used for navigation
- [ ] `<main>` tag wraps main content
- [ ] `<section>` tags wrap major sections
- [ ] `<article>` tags for standalone content
- [ ] `<header>` and `<footer>` where appropriate
- [ ] Forms use `<label>` with `htmlFor`
- [ ] `<fieldset>` + `<legend>` for form groups

---

### 9. Reduced Motion

**Goal**: Respect user preference for reduced animations

**Test**:
1. F12 → Rendering tab
2. Click "Emulate CSS media feature prefers-reduced-motion"
3. Select "prefers-reduced-motion"
4. Reload page
5. Verify animations are very fast or disabled

**Expected**:
- Animations run at 0.01ms (instant)
- Transitions run at 0.01ms (instant)
- No smooth scrolling
- Page feels snappy

**Check CSS**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Checklist**:
- [ ] Animations disabled with prefers-reduced-motion
- [ ] Transitions run instantly
- [ ] Focus indicators still visible
- [ ] Scrolling not affected

---

## Feature Testing

### Sidebar Navigation
- [ ] Click group header to expand/collapse
- [ ] Sidebar items change active tab
- [ ] Mobile: Sidebar opens/closes with toggle
- [ ] Sidebar persists state (localStorage)
- [ ] Only relevant tabs show per group

### Dashboard
- [ ] All 6 cards display
- [ ] Card content shows real project data
- [ ] Responsive: 4→2→1 columns
- [ ] Empty states show when data missing

### Settings Accordion
- [ ] Accordion sections expand/collapse
- [ ] Multiple sections can open simultaneously
- [ ] Smooth animation when expanding
- [ ] Toggle icon rotates 180°
- [ ] Settings values persist

### Stack Wizard
- [ ] Step 1: Preset cards display with icons
- [ ] Step 2: Custom textarea appears only when "Custom" selected
- [ ] Step 3: Addon groups appear only when preset selected
- [ ] Step 4: Preview shows composed stack
- [ ] Preset selection updates preview in real-time
- [ ] Addon selection updates preview
- [ ] Custom text updates preview

---

## Automated Testing

### Lighthouse (Chrome)
1. F12 → Lighthouse tab
2. Select "Accessibility"
3. Click "Analyze page load"
4. Review report for issues
5. Expected: 90+ score

### Axe DevTools
1. Install: https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnkpklempisson
2. F12 → Axe DevTools tab
3. Scan page
4. Review results
5. Expected: 0 violations

### WAVE (WebAIM)
1. Visit: https://wave.webaim.org/
2. Enter URL: http://127.0.0.1:5178
3. Review report
4. Expected: No errors, minimal alerts

---

## Regression Testing

### Existing Features Still Work
- [ ] Chat messaging
- [ ] Code editor
- [ ] Terminal
- [ ] Project creation
- [ ] Git integration
- [ ] Settings save

### New Features Work
- [ ] Sidebar navigation
- [ ] Dashboard overview
- [ ] Settings accordion
- [ ] Stack Wizard

### No Breaking Changes
- [ ] No console errors
- [ ] No missing data
- [ ] No UI glitches

---

## Browser Testing

### Desktop Browsers
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

### Mobile Browsers
- [ ] Chrome mobile
- [ ] Safari mobile (iOS)
- [ ] Firefox mobile

---

## Summary Checklist

### Responsive Design
- [ ] Desktop (1920px): Full layout
- [ ] Tablet (1024px): 2-3 columns
- [ ] Mobile (768px): Single column
- [ ] Small mobile (480px): Drawer + touch-friendly
- [ ] Extra small (360px): Minimal layout
- [ ] No horizontal scrolling on mobile

### Accessibility
- [ ] Keyboard navigation works (Tab/Shift+Tab)
- [ ] Focus indicator visible (2px outline)
- [ ] ARIA labels on all buttons
- [ ] Screen reader announces content
- [ ] Color contrast ≥ 4.5:1
- [ ] Font sizes readable (≥ 16px)
- [ ] Touch targets ≥ 44x44px
- [ ] Prefers-reduced-motion respected
- [ ] Semantic HTML used
- [ ] No keyboard traps

### Features
- [ ] Sidebar navigation works
- [ ] Dashboard displays correctly
- [ ] Accordion expands/collapses
- [ ] Stack Wizard progresses through steps
- [ ] All existing features work
- [ ] No console errors

---

**Testing Date**: ___________  
**Tester**: ___________  
**Result**: PASS / FAIL  
**Issues Found**: ___________  

---

## Need Help?

- **Keyboard Navigation**: See `ACCESSIBILITY_GUIDE.md` Section 1
- **ARIA Labels**: See `ACCESSIBILITY_GUIDE.md` Section 2
- **Screen Readers**: See `ACCESSIBILITY_GUIDE.md` Section 3
- **Responsive**: See `COMPONENT_DOCUMENTATION.md` CSS Architecture
- **Components**: See `COMPONENT_DOCUMENTATION.md` for each component

---

**Last Updated**: December 2024  
**Branch**: `refonte-UX`
