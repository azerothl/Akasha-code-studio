# Developer Onboarding Guide

**Project**: Akasha Code Studio UX Refactor  
**Branch**: `refonte-UX`  
**Status**: ✅ Production Ready  

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### First Time Setup
```bash
# Clone repository
git clone https://github.com/akasha/akasha-code-studio.git
cd akasha-code-studio

# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
# http://127.0.0.1:5178
```

### Build & Test
```bash
# Run TypeScript check
npm run build:type-check

# Build for production
npm run build

# Run tests (if available)
npm run test

# Validate refactor
node scripts/validate-refactor.js
```

---

## 📁 Project Structure

```
akasha-code-studio/
├── src/
│   ├── App.tsx                 ← Main app (4180+ lines)
│   ├── index.css               ← All styling (responsive + a11y)
│   ├── main.tsx                ← Entry point
│   │
│   ├── Components (NEW)
│   ├── sidebar.tsx             ← Navigation (280+ lines)
│   ├── projectDashboard.tsx    ← Dashboard (200+ lines)
│   ├── accordion.tsx           ← Reusable accordion (70 lines)
│   ├── stackWizard.tsx         ← Stack builder (150+ lines)
│   ├── skeletonLoader.tsx      ← Loading placeholders (60 lines)
│   │
│   ├── Existing Components
│   ├── codeEditor.tsx
│   ├── designVisualBoard.tsx
│   ├── chatStudioDiff.tsx
│   └── ... (many more)
│
├── Documentation (NEW)
├── FINAL_SUMMARY.md            ← Overview of all changes
├── REFACTOR_SUMMARY.md         ← Phase breakdown
├── COMPONENT_DOCUMENTATION.md  ← Component guides
├── ACCESSIBILITY_GUIDE.md      ← WCAG 2.1 AA details
├── TESTING_GUIDE.md            ← Testing procedures
├── CHANGELOG.md                ← All changes
├── PERFORMANCE_ENHANCEMENTS.md ← Optimization roadmap
├── QUICK_PERFORMANCE_WINS.md   ← Quick wins
│
├── scripts/
├── validate-refactor.js        ← Automated tests (21 tests)
│
├── vite.config.ts              ← Build config
├── tsconfig.json               ← TypeScript config
├── package.json
└── index.html
```

---

## 🎯 Key Concepts

### Navigation System
The app now uses a 5-group hierarchical sidebar:

```typescript
// In sidebar.tsx
const SIDEBAR_NAV_GROUPS = [
  {
    id: "project",
    label: "Projet",
    icon: "📦",
    items: [
      { id: "overview", label: "Overview", tab: "dashboard", ... },
      { id: "git", label: "Git", tab: "git", ... },
      { id: "rag", label: "Code RAG", tab: "codeRag", ... },
    ]
  },
  // ... 4 more groups
];
```

**Usage**: Each group has a set of tabs. When a group is clicked, only its tabs are shown.

### Component Architecture

#### Sidebar Component
```typescript
// Props
<Sidebar
  isOpen={sidebarOpen}
  onToggle={() => setSidebarOpen(!sidebarOpen)}
  activeTab={centerTab}
  onTabSelect={(tab) => setCenterTab(tab)}
  activeGroup={activeGroup}
  onGroupSelect={(group) => setActiveGroup(group)}
/>
```

#### ProjectDashboard Component
```typescript
// Renders 6-card grid:
// 1. Stack Info
// 2. Git Status
// 3. Code RAG Index
// 4. Active Task
// 5. Quick Actions
// 6. Recent Activity
<ProjectDashboard project={project} />
```

#### Accordion Component
```typescript
// Props
<Accordion
  items={[
    { id: "section1", title: "Section 1", content: <div>...</div> },
    { id: "section2", title: "Section 2", content: <div>...</div> },
  ]}
  allowMultiple={true}
/>
```

#### Stack Wizard Component
```typescript
// Props
<StackWizard
  presetId={presetId}
  onPresetChange={(id) => setPresetId(id)}
  addons={addons}
  onToggleAddon={(category, id) => toggleAddon(category, id)}
  customText={customText}
  onCustomTextChange={(text) => setCustomText(text)}
  composedStack={composedStack}
/>
```

---

## 🎨 Styling System

### CSS Variables (Theme)
```css
/* Light/Dark Theme (in :root[data-theme="light"]) */
--akasha-bg: #f4f6fb;              /* Background */
--akasha-text: #101426;            /* Text */
--akasha-accent: #8b5cf6;          /* Accent color */
--akasha-border: rgba(79, 70, 229, 0.18);
```

### Component Classes
```css
.sidebar              /* Main navigation */
.sidebar-group       /* Navigation group */
.sidebar-item        /* Navigation item */

.dashboard-grid      /* Card grid */
.dashboard-card      /* Individual card */

.accordion           /* Container */
.accordion-item      /* Individual item */
.accordion-header    /* Clickable header */
.accordion-content   /* Collapsible content */

.stack-wizard        /* Container */
.step-*              /* Step indicators */
.preset-card         /* Preset button */
```

### Responsive Breakpoints
```css
@media (max-width: 1024px) { /* Tablet */ }
@media (max-width: 768px)  { /* Small Tablet */ }
@media (max-width: 480px)  { /* Mobile */ }
@media (max-width: 360px)  { /* Extra Small */ }
```

---

## ♿ Accessibility Implementation

### ARIA Labels
```typescript
// Every interactive element has aria-label
<button aria-label="Close sidebar">
  <Icon />
</button>

// Expandable sections have aria-expanded
<div 
  role="button" 
  aria-expanded={isOpen}
  aria-label="Project section"
>
  {...}
</div>
```

### Keyboard Navigation
```typescript
// Tab through elements (automatic)
// Shift+Tab to go backwards (automatic)
// Enter/Space to activate buttons (automatic in React)
// Arrow keys for some custom interactions (implement if needed)
```

### Semantic HTML
```html
<nav aria-label="Navigation">        <!-- Landmark -->
<main>                               <!-- Main content -->
<section aria-label="Projects">      <!-- Sections -->
<fieldset>                           <!-- Form grouping -->
  <legend>Stack Configuration</legend>
</fieldset>
```

### Color Contrast
- Text: 17.5:1 (exceeds 4.5:1 WCAG AA minimum)
- Status: All colors verified for contrast

---

## 🧪 Testing

### Automated Validation
```bash
# Run all tests
node scripts/validate-refactor.js

# Expected output:
# ✅ Passed: 21/21 (100%)
# Tests build artifacts, accessibility, components, CSS, docs
```

### Manual Testing Checklist
```bash
# 1. Keyboard navigation
# Use Tab/Shift+Tab to navigate entire app
# Verify focus indicator always visible (2px outline)

# 2. Screen reader (NVDA on Windows)
# Download: https://www.nvaccess.org/
# Test headings (H key), buttons (B key), regions (R key)

# 3. Color contrast
# Use WebAIM: https://webaim.org/resources/contrastchecker/
# Verify: #e5e7eb on #0f0f0f = 17.5:1 ✓

# 4. Responsive design
# DevTools: F12 → Toggle device toolbar
# Test: 1920px → 1024px → 768px → 480px → 360px

# 5. Touch interactions
# Test on actual mobile or DevTools mobile emulation
# Verify buttons are at least 44x44px
# Verify spacing between buttons is at least 8px
```

---

## 🚀 Common Development Tasks

### Adding a New Navigation Item
```typescript
// In sidebar.tsx, add to SIDEBAR_NAV_GROUPS
{
  id: "my-group",
  label: "My Group",
  icon: "🎯",
  items: [
    {
      id: "my-item",
      label: "My Item",
      tab: "my-tab",
      icon: "📋",
    }
  ]
}

// Then in App.tsx, add the tab and render component
<Sidebar
  // ... existing props
  activeGroup={activeGroup}
  onGroupSelect={setActiveGroup}
/>

// Handle tab rendering
{centerTab === "my-tab" && <MyComponent />}
```

### Adding a New Accordion Section
```typescript
// In App.tsx (Settings page)
{
  id: "my-section",
  title: "My Section",
  icon: "⚙️",
  content: (
    <div className="settings-form-group">
      {/* Settings UI here */}
    </div>
  ),
}
```

### Creating a New Component
```typescript
// src/myComponent.tsx
import { useState } from 'react';
import './styles.css'; // or styles in index.css

interface MyComponentProps {
  title: string;
  onClose?: () => void;
}

export function MyComponent({ title, onClose }: MyComponentProps) {
  const [state, setState] = useState(false);

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <button 
        onClick={() => setState(!state)}
        aria-label={`Toggle ${title}`}
      >
        Toggle
      </button>
      {state && <p>Content visible</p>}
    </div>
  );
}
```

### Styling New Components
```css
/* In src/index.css */
.my-component {
  background: var(--akasha-bg-card);
  color: var(--akasha-text);
  border: 1px solid var(--akasha-border);
  border-radius: 8px;
  padding: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .my-component {
    padding: 0.75rem;
    font-size: 14px;
  }
}

/* Accessibility */
.my-component button:focus-visible {
  outline: 2px solid var(--akasha-accent);
  outline-offset: 2px;
}
```

---

## 📊 Performance Considerations

### Current Bundle Size
- **JavaScript**: 514.20 KB (154.15 KB gzipped)
- **CSS**: 98.53 KB (17.73 KB gzipped)
- **Total**: 612.73 KB (171.88 KB gzipped)

### Optimization Opportunities
See `PERFORMANCE_ENHANCEMENTS.md` for detailed recommendations:
1. Lazy load Dashboard (save 50-80 KB)
2. Lazy load StackWizard (save 30-50 KB)
3. Implement code-splitting (separate vendor chunk)
4. Optimize images (WebP, lazy load)
5. Service Worker for offline support

**Quick Win**: Use Suspense boundaries
```typescript
const Dashboard = lazy(() => import('./projectDashboard'));

<Suspense fallback={<div>Loading...</div>}>
  <Dashboard project={project} />
</Suspense>
```

---

## 🐛 Debugging Tips

### TypeScript Errors
```bash
# Check for errors
npm run build:type-check

# Fix common issues:
# - Missing type definitions: `type X = {...}`
# - Prop type mismatches: Check component interface
# - Unused variables: Remove or prefix with _
```

### Build Errors
```bash
# Full build output
npm run build

# Check for:
# - Import errors (missing files)
# - Syntax errors (check console output)
# - Module not found (check node_modules)
```

### Runtime Errors
```bash
# Check browser console: F12 → Console tab
# Common issues:
# - API not responding (check daemon on :3876)
# - Component not rendering (check React DevTools)
# - CSS not applied (check DevTools Styles tab)
```

### Styling Issues
```bash
# DevTools: F12 → Elements/Inspector
# Check:
# - Class names applied
# - CSS specificity conflicts
# - Media queries triggering
# - CSS variables set correctly
```

---

## 📚 Documentation Quick Links

- **Overview**: [FINAL_SUMMARY.md](./FINAL_SUMMARY.md)
- **Components**: [COMPONENT_DOCUMENTATION.md](./COMPONENT_DOCUMENTATION.md)
- **Accessibility**: [ACCESSIBILITY_GUIDE.md](./ACCESSIBILITY_GUIDE.md)
- **Performance**: [PERFORMANCE_ENHANCEMENTS.md](./PERFORMANCE_ENHANCEMENTS.md)
- **Testing**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Changes**: [CHANGELOG.md](./CHANGELOG.md)

---

## 🤝 Contributing Guidelines

### Code Style
- **React**: Use hooks (useState, useEffect, useMemo)
- **TypeScript**: Strict mode enabled (use full types)
- **CSS**: Use CSS variables for colors/sizing
- **Naming**: camelCase for JS, kebab-case for CSS classes

### Before Committing
```bash
# 1. Type check
npm run build:type-check

# 2. Build
npm run build

# 3. Validate
node scripts/validate-refactor.js

# 4. Test manually (if changes affect UI)
npm run dev
# Test keyboard navigation, screen reader, responsiveness
```

### Commit Message Format
```
type(scope): short description

- Detailed explanation of changes
- Impact on functionality
- Related issue numbers

Example:
feat(sidebar): add search filter to navigation

- Add real-time search input
- Filter nav items by name
- Keyboard shortcut (Cmd+K)
- Closes #123
```

---

## 🎓 Learning Resources

### React
- [Official React Docs](https://react.dev)
- [React Hooks Guide](https://react.dev/reference/react/hooks)
- [React TypeScript Cheatsheet](https://github.com/typescript-cheatsheets/react)

### Accessibility
- [WCAG 2.1 Guide](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### CSS
- [MDN CSS Guide](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Responsive Design](https://web.dev/responsive-web-design-basics/)
- [CSS Flexbox](https://web.dev/flexbox/)

---

## 💡 Pro Tips

1. **Use DevTools DevTools Simulator**: Test responsive design without real devices
2. **Use NVDA for Accessibility**: Free screen reader for testing
3. **Use Lighthouse**: Built-in browser audit tool (F12 → Lighthouse)
4. **Use Performance Tab**: Analyze runtime performance (F12 → Performance)
5. **Use React DevTools**: Browser extension for component inspection

---

## ❓ FAQ

### Q: How do I add a new page/tab?
A: Create a new component, add it to sidebar navigation, handle in App.tsx tab rendering

### Q: How do I change colors?
A: Edit CSS variables in `index.css` `:root` section

### Q: How do I make something responsive?
A: Use `@media (max-width: Xpx)` queries in `index.css`

### Q: How do I make something accessible?
A: Add `aria-label`, semantic HTML, keyboard support, test with NVDA

### Q: How do I improve performance?
A: See `PERFORMANCE_ENHANCEMENTS.md` for detailed recommendations

---

## 📞 Getting Help

1. **Check Documentation**: Start with docs/
2. **Search Code**: Use grep to find similar implementations
3. **Check Errors**: Review browser console and build output
4. **Run Tests**: Execute `node scripts/validate-refactor.js`
5. **Ask Team**: Check conversation history or ask colleagues

---

**Last Updated**: December 2024  
**Status**: ✅ Production Ready  
**Questions?**: Check FINAL_SUMMARY.md or docs/
