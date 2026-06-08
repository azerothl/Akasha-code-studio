# Component Documentation - Akasha Code Studio Refactor

## Overview

This document describes the new and refactored components introduced in the UX refactor branch (`refonte-UX`).

---

## 1. Sidebar Component

### File
`src/sidebar.tsx`

### Purpose
Hierarchical 5-group navigation system replacing flat 9-tab menu. Provides contextual filtering and mobile-responsive drawer.

### Props
```typescript
interface SidebarProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  activeTab: CenterTab;
  onTabSelect: (tab: CenterTab) => void;
  activeGroup: string;
  onGroupSelect: (group: string) => void;
}
```

### Navigation Groups
1. **Project** (📁)
   - Dashboard (📊)
   - Recent Files (📝)

2. **Development** (💻)
   - Chat (💬)
   - Code Review (🔍)
   - Terminal (⌨️)

3. **Design Planning** (✏️)
   - Whiteboard (✏️)
   - Documentation (📖)
   - Stack Config (⚙️)

4. **Operations** (⚙️)
   - Git Status (📊)
   - Settings (⚙️)

5. **Help** (❓)
   - API Docs (📚)
   - Shortcuts (⌨️)

### Key Features
- **Group Expansion**: Click group header to expand/collapse items
- **Tab Selection**: Click item to switch tabs
- **Mobile Drawer**: Automatic drawer on small screens with overlay
- **Auto-expand**: Drawer expands when tab changes to show context
- **localStorage**: Persists open/active state (`akasha-studio-sidebar-open`, `akasha-studio-active-group`)

### Usage
```tsx
import { Sidebar } from "./sidebar";

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("development");

  return (
    <Sidebar
      isOpen={sidebarOpen}
      onToggle={setSidebarOpen}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
      activeGroup={activeGroup}
      onGroupSelect={setActiveGroup}
    />
  );
}
```

### Accessibility
- ✅ `aria-label` on navigation
- ✅ `aria-expanded` for group headers
- ✅ `aria-current="page"` for active items
- ✅ `role="list"` / `role="listitem"` semantic structure
- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ Focus visible on all interactive elements

---

## 2. ProjectDashboard Component

### File
`src/projectDashboard.tsx`

### Purpose
Overview of current project showing health status, Git state, Code RAG index, active task, and recent activity.

### Props
```typescript
interface ProjectDashboardProps {
  project: StudioProject | StudioProjectMeta;
}
```

### Card Sections
1. **Stack** - Current stack configuration
2. **Git Status** - Branch, commits, dirty files
3. **Code RAG Index** - Indexed files/chunks count
4. **Active Task** - Current task with status
5. **Actions** - Quick-access buttons
6. **Activity** - Recent timeline of changes

### Key Features
- **Type Guards**: `isMeta()` distinguishes StudioProject from StudioProjectMeta
- **Status Formatting**: Human-readable status strings
- **Time Formatting**: Relative time display (1m, 2h, 3d)
- **Empty States**: Graceful handling when data unavailable
- **Responsive Grid**: Adapts from 2-3 columns to single column on mobile

### Usage
```tsx
import { ProjectDashboard } from "./projectDashboard";

export function App() {
  const [project, setProject] = useState<StudioProject | null>(null);

  return (
    <main>
      {project && <ProjectDashboard project={project} />}
    </main>
  );
}
```

### Accessibility
- ✅ Semantic card structure
- ✅ Clear headings hierarchy
- ✅ Descriptive labels
- ✅ High contrast (WCAG AA)
- ✅ Keyboard accessible cards

---

## 3. Accordion Component

### File
`src/accordion.tsx`

### Purpose
Reusable collapsible accordion component for organizing settings, FAQs, and grouped content.

### Props & Types
```typescript
type AccordionItem = {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: string;
  isOpen?: boolean;
};

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean; // Default: false (only one open at a time)
  onToggle?: (id: string) => void;
}
```

### Features
- **Single/Multiple**: Toggle between one-open and multi-open modes
- **Smooth Animation**: Slide-down/slide-up transition (400ms)
- **Icons**: Optional emoji or icon per section
- **Keyboard Accessible**: Tab navigation, Space to toggle
- **Focus Management**: Visible focus indicator on headers

### Usage
```tsx
import { Accordion } from "./accordion";

export function SettingsPage() {
  const items: AccordionItem[] = [
    {
      id: "appearance",
      title: "Appearance",
      icon: "🎨",
      content: <AppearanceSettings />,
    },
    {
      id: "conversation",
      title: "Conversation",
      icon: "💬",
      content: <ConversationSettings />,
    },
  ];

  return <Accordion items={items} allowMultiple />;
}
```

### Styling
- CSS classes: `.accordion`, `.accordion-header`, `.accordion-content`
- Animation: `@keyframes slideDown` (smooth collapse/expand)
- Icon rotation: 180° on expand

### Accessibility
- ✅ Semantic HTML (no `<details>`/`<summary>` for more control)
- ✅ `aria-expanded` for screen readers
- ✅ Focus visible on headers
- ✅ Keyboard navigation (Tab, Space)

---

## 4. StackWizard Component

### File
`src/stackWizard.tsx`

### Purpose
Visual, multi-step wizard for selecting and configuring technology stack. Replaces deprecated text-heavy `StackFields`.

### Props
```typescript
interface StackWizardProps {
  presetId: string;
  onPresetChange: (id: string) => void;
  addons: Record<StackAddonCategoryId, string[]>;
  onToggleAddon: (cat: StackAddonCategoryId, optId: string) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  composedStack: string;
}
```

### 4-Step Workflow

**Step 1: Preset Selection**
- Visual card grid with emoji icons
- Presets: None, React, Vue, Svelte, Python-FastAPI, Node-Express, Custom
- Card shows: emoji, name, brief description

**Step 2: Custom Stack Input** (conditional, if "Custom" selected)
- Textarea for free-form stack description
- Placeholder: "Ex: Python 3.11, FastAPI, PostgreSQL, React TypeScript, Docker, GitHub, pytest"
- 8 rows for comfortable input

**Step 3: Addon Selection** (conditional, if preset selected)
- Categorized addon groups: Testing, CI/CD, Deployment, Observability
- Checkboxes within each group
- Multi-select to customize preset

**Step 4: Preview** (conditional, if preset selected)
- Read-only textarea showing composed stack
- Real-time reflection of all selections
- Helpful hint: "Text injected into daemon instructions"

### Key Features
- **Progressive Disclosure**: Steps appear based on selections
- **Visual Feedback**: Active cards highlighted, addon count visible
- **Real-Time Preview**: Composedstack updates immediately
- **Responsive Grid**: 2-4 columns on desktop, 2 on tablet, 1 on mobile

### Usage
```tsx
import { StackWizard } from "./stackWizard";
import { STACK_PRESET_NONE, emptyStackAddons, composeStackString } from "./stackConfig";

export function ProjectSettings() {
  const [presetId, setPresetId] = useState(STACK_PRESET_NONE);
  const [addons, setAddons] = useState(emptyStackAddons());
  const [customText, setCustomText] = useState("");

  const composedStack = composeStackString(presetId, addons, customText);

  return (
    <StackWizard
      presetId={presetId}
      onPresetChange={setPresetId}
      addons={addons}
      onToggleAddon={(cat, optId) => {
        setAddons((prev) => ({
          ...prev,
          [cat]: prev[cat].includes(optId)
            ? prev[cat].filter((id) => id !== optId)
            : [...prev[cat], optId],
        }));
      }}
      customText={customText}
      onCustomTextChange={setCustomText}
      composedStack={composedStack}
    />
  );
}
```

### Styling
- CSS classes: `.stack-wizard`, `.stack-wizard-step`, `.stack-preset-grid`, `.stack-addon-groups-grid`
- Card sizing: 140px on desktop, 120px on tablet, 100px on mobile
- Addon group cards: 250px min-width on desktop, single column on mobile
- Smooth transitions on all interactions

### Accessibility
- ✅ Semantic `<fieldset>` + `<legend>` for addon groups
- ✅ `aria-label` on all preset buttons
- ✅ `aria-pressed` for toggle state
- ✅ Step titles with `id` for `aria-labelledby`
- ✅ High contrast (WCAG AA)
- ✅ Keyboard navigation (Tab, Space to select)
- ✅ Focus visible on all interactive elements

### Related Functions (stackConfig.ts)
```typescript
// Constants
STACK_PRESET_NONE = "none";
STACK_PRESET_CUSTOM = "custom";
BASE_STACK_PRESETS: StackPresetRow[] = [/* presets */];
STACK_ADDON_GROUPS: StackAddonGroup[] = [/* groups */];

// Helpers
emptyStackAddons(): Record<StackAddonCategoryId, string[]>;
composeStackString(presetId, addons, customText): string;
```

---

## CSS Architecture

### New CSS Sections

1. **Sidebar Styles** (~200 lines)
   - Fixed positioning (240px desktop, 200px tablet)
   - Mobile drawer with overlay
   - Hierarchical indentation
   - Active/hover states

2. **Dashboard Styles** (~150 lines)
   - Card grid (2-3 columns, responsive)
   - Card hover effects
   - Empty state layout
   - Status badge styling

3. **Accordion Styles** (~80 lines)
   - Header interactions
   - Content slide animation
   - Icon rotation
   - Focus states

4. **Stack Wizard Styles** (~150 lines)
   - Preset card grid
   - Addon group cards
   - Step titles and hints
   - Preview textarea

5. **Responsive Styles** (~400 lines)
   - 4 breakpoints: 1024px, 768px, 480px, 360px
   - Flexible layouts
   - Touch-friendly sizes
   - Font adjustments

6. **Accessibility Styles** (~150 lines)
   - Focus visible states
   - Screen reader only text
   - High contrast support
   - Reduced motion support

### Total: ~97.91 KB (gzipped 17.56 KB)

---

## Theme Variables (CSS)

```css
--akasha-primary: #8b5cf6; /* Violet */
--akasha-secondary: #06b6d4; /* Cyan */
--akasha-bg: #0f0f0f; /* Dark background */
--akasha-bg-hover: rgba(139, 92, 246, 0.05);
--akasha-text: #e5e7eb; /* Light text */
--akasha-text-muted: #9ca3af;
--akasha-text-dim: #6b7280;
--akasha-border: #1f2937;
--akasha-accent: #8b5cf6;
```

---

## Integration Points in App.tsx

### 1. Sidebar Integration
```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);
const [activeGroup, setActiveGroup] = useState(getDefaultGroup());

// Sidebar rendering
<Sidebar
  isOpen={sidebarOpen}
  onToggle={setSidebarOpen}
  activeTab={centerTab}
  onTabSelect={setCenterTab}
  activeGroup={activeGroup}
  onGroupSelect={setActiveGroup}
/>
```

### 2. Dashboard Integration
```tsx
// In centerTab switch
case "dashboard":
  return <ProjectDashboard project={project} />;
```

### 3. Settings Accordion Integration
```tsx
// In "settings" tab
<Accordion
  items={[
    { id: "appearance", title: "Appearance", icon: "🎨", content: <Appearance /> },
    { id: "conversation", title: "Conversation", icon: "💬", content: <Conversation /> },
    // ... more sections
  ]}
  allowMultiple
/>
```

### 4. StackWizard Integration (2 locations)
- **Project Settings** (line 2733)
- **New Project Modal** (line 4296)

---

## Migration Guide (for developers)

### Replacing StackFields
**Before:**
```tsx
<StackFields
  selectId="stack-select"
  presetId={presetId}
  onPresetChange={setPresetId}
  // ... other props
/>
```

**After:**
```tsx
<StackWizard
  presetId={presetId}
  onPresetChange={setPresetId}
  addons={addons}
  onToggleAddon={handleToggleAddon}
  customText={customText}
  onCustomTextChange={setCustomText}
  composedStack={composedStack}
/>
```

### Adding Responsive Styles
All new components include responsive breakpoints. No additional work needed for mobile—they adapt automatically.

### Accessibility Best Practices
- Always use `aria-label` on buttons
- Use `role="group"` for grouped elements
- Use `<fieldset>` + `<legend>` for form groups
- Use `.sr-only` for screen-reader-only text
- Test with keyboard navigation (Tab, Arrow keys)

---

## Testing Recommendations

### Unit Tests
- Test sidebar group expand/collapse
- Test accordion toggle
- Test StackWizard step progression
- Test dashboard empty states

### Integration Tests
- Test tab switching with sidebar
- Test data flow through StackWizard
- Test localStorage persistence

### E2E Tests
- Test complete user journey (create project → configure stack → review dashboard)
- Test mobile responsive flows
- Test keyboard-only navigation

### Accessibility Tests
- NVDA/JAWS screen reader testing
- Keyboard-only navigation (no mouse)
- Color contrast validation (WebAIM)
- Focus indicator visibility

---

## Performance Considerations

### Bundle Size
- Current: 514 KB JS (gzipped 154 KB)
- CSS: 97.91 KB (gzipped 17.56 KB)
- **Optimization**: Consider code-splitting Dashboard/StackWizard into separate chunks

### Rendering
- Sidebar groups use conditional rendering (not hidden CSS)
- Dashboard cards memoized to prevent re-renders
- StackWizard steps conditionally mounted

### Animations
- CSS transitions (not JS-based)
- Respects `prefers-reduced-motion`
- Smooth performance on mobile

---

## Future Enhancements

1. **Dark/Light Mode Toggle**
   - Add theme switcher
   - Update CSS variables dynamically

2. **Drag-and-Drop**
   - Reorder addons by priority
   - Rearrange dashboard cards

3. **Custom Presets**
   - Save/load user-defined stacks
   - Share presets with team

4. **Advanced Filtering**
   - Search sidebar items
   - Filter dashboard by tag

5. **Loading States**
   - Skeleton loaders for cards
   - Spinners for async operations

---

## References

- **WCAG 2.1 AA Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Learn/Accessibility
- **React Accessibility**: https://react.dev/learn#accessibility

---

**Last Updated**: December 2024  
**Branch**: `refonte-UX`  
**Status**: Ready for development/review
