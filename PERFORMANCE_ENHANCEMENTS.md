# Performance Enhancement Guide

**Branch**: `refonte-UX`  
**Created**: December 2024  
**Focus**: Build optimization, code-splitting, and UX performance  

---

## Current Bundle Size

- **JavaScript**: 514.20 KB (154.15 KB gzipped)
- **CSS**: 98.53 KB (17.73 KB gzipped)
- **Total**: 612.73 KB (171.88 KB gzipped)

### Bundle Analysis
- **Vite**: 314 modules transformed
- **Warning**: Some chunks > 500 KB after minification

---

## 1. Code-Splitting Opportunities

### Recommended Splits

#### 1a. Dashboard Component (Lazy Load)
```typescript
// App.tsx
import { lazy, Suspense } from 'react';

const ProjectDashboard = lazy(() => import('./projectDashboard'));

// In render:
<Suspense fallback={<DashboardSkeletons />}>
  <ProjectDashboard project={project} />
</Suspense>
```

**Impact**: ~50-80 KB reduction (dashboard renders only on demand)
**Implementation**: 15 minutes

#### 1b. Stack Wizard (Lazy Load)
```typescript
const StackWizard = lazy(() => import('./stackWizard'));

// In render (only loaded when project settings open):
<Suspense fallback={<div>Loading...</div>}>
  <StackWizard {...props} />
</Suspense>
```

**Impact**: ~30-50 KB reduction
**Implementation**: 15 minutes

#### 1c. Design Modules (Separate Chunk)
```typescript
// Split design-related modules into separate chunk
import { lazy } from 'react';

const DesignVisualBoard = lazy(() => import('./designVisualBoard'));
const DesignDoc = lazy(() => import('./designDoc'));
```

**Impact**: ~60-100 KB reduction
**Implementation**: 30 minutes

### Vite Config Optimization

```javascript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'dashboard': ['./src/projectDashboard.tsx'],
          'stack': ['./src/stackWizard.tsx'],
          'design': ['./src/designVisualBoard.tsx', './src/designDoc.tsx'],
          'editor': ['./src/codeEditor.tsx'],
        }
      }
    },
    // Increase chunk size limit
    chunkSizeWarningLimit: 600,
  }
}
```

**Expected Result**: 4-5 chunks instead of 1 main bundle
**Improvement**: Faster initial load, faster subsequent page loads

---

## 2. Image Optimization

### Current Status
- Images stored in `assets/screenshots/`
- No image optimization in build

### Improvements

#### 2a. Lazy Load Images
```typescript
<img 
  src="screenshot.png"
  loading="lazy"
  alt="Project screenshot"
/>
```

#### 2b. Use WebP Format
```html
<picture>
  <source srcset="image.webp" type="image/webp" />
  <img src="image.png" alt="Fallback" />
</picture>
```

#### 2c. Responsive Images
```html
<img 
  srcset="image-small.png 480w, image-large.png 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  src="image.png"
  alt="Responsive"
/>
```

**Impact**: 20-40% image size reduction
**Implementation**: 30 minutes

---

## 3. CSS Optimization

### Current: 98.53 KB

#### 3a. Remove Unused Tailwind Classes
```bash
# Run Tailwind's purge
npm install -D @tailwindcss/cli

# Scan all files
npx tailwindcss -i src/index.css -o dist/output.css
```

**Expected Reduction**: 10-20 KB

#### 3b. CSS-in-JS Elimination
- Current approach: All CSS in `index.css`
- Benefit: Single stylesheet, no runtime overhead ✅

#### 3c. Critical CSS Extraction
```typescript
// Extract above-the-fold CSS
// Use tools like: critical, penthouse, or manually

// Inline critical CSS in <head>
<style>/* critical CSS */</style>
<link rel="preload" href="main.css" as="style" />
```

**Impact**: Faster first paint
**Implementation**: 45 minutes

---

## 4. JavaScript Optimization

### Current: 514.20 KB

#### 4a. Tree Shaking
```json
// package.json
{
  "sideEffects": false
}
```

Already enabled in most cases. Check for:
- Unused imports
- Unused exports
- Unused dependencies

#### 4b. Minification
Vite already uses `terser` for minification.

Status: ✅ Optimized

#### 4c. Remove Console Logs
```typescript
// vite.config.ts
export default {
  define: {
    __DEV__: false,
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      }
    }
  }
}
```

**Impact**: 1-3 KB reduction

---

## 5. Network Optimization

### 5a. HTTP/2 Push
```typescript
// vite.config.ts
export default {
  server: {
    http2: true,
  }
}
```

### 5b. Compression
```typescript
// vite.config.ts
import compression from 'vite-plugin-compression';

export default {
  plugins: [compression()]
}
```

**Format**: Brotli (better than gzip)
**Impact**: 15-20% file size reduction

### 5c. Resource Hints
```html
<head>
  <link rel="preconnect" href="https://api.example.com" />
  <link rel="dns-prefetch" href="https://cdn.example.com" />
  <link rel="preload" href="main.js" as="script" />
  <link rel="prefetch" href="next-page.js" />
</head>
```

---

## 6. React Optimization

### 6a. Lazy Loading Components
```typescript
const Dashboard = lazy(() => 
  import('./projectDashboard').then(m => ({ default: m.ProjectDashboard }))
);
```

### 6b. Memoization
```typescript
const MemoizedDashboard = memo(ProjectDashboard, (prev, next) => {
  return prev.project?.id === next.project?.id;
});
```

### 6c. useDeferredValue for Large Lists
```typescript
const deferredItems = useDeferredValue(largeList);
```

### 6d. useTransition for Non-blocking Updates
```typescript
const [isPending, startTransition] = useTransition();

startTransition(() => {
  // Update expensive UI
});
```

---

## 7. Accessibility Performance

### No Degradation
Current implementation:
- ✅ ARIA labels don't impact bundle
- ✅ Focus indicators use CSS (no JS)
- ✅ Keyboard navigation native

### Enhancements
- [ ] Add `aria-live` for dynamic content updates
- [ ] Add `aria-busy` for loading states
- [ ] Add `aria-invalid` for form validation

---

## 8. Caching Strategy

### Service Worker
```typescript
// public/sw.js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index-*.js',
        '/assets/index-*.css',
      ]);
    })
  );
});
```

**Impact**: Instant repeat visits, offline support

### Cache Headers
```
# Static files: 1 year
Cache-Control: public, max-age=31536000, immutable

# HTML: 1 hour
Cache-Control: public, max-age=3600, must-revalidate

# API: No cache
Cache-Control: no-cache, no-store, must-revalidate
```

---

## 9. Implementation Priority

### Phase 1 (Quick Wins) - 1 hour
1. Enable Brotli compression
2. Remove console logs in production
3. Add resource hints to HTML

### Phase 2 (Code-Splitting) - 2 hours
1. Lazy load Dashboard component
2. Lazy load Stack Wizard
3. Update Vite config with manualChunks

### Phase 3 (Images) - 1 hour
1. Add `loading="lazy"` to images
2. Convert to WebP format
3. Add srcset for responsive images

### Phase 4 (Advanced) - 2-3 hours
1. Service Worker for offline support
2. Critical CSS extraction
3. Advanced React optimization (Suspense boundaries)

---

## 10. Performance Targets

### Initial Load
- **Current**: ~615 KB (172 KB gzipped)
- **Target**: ~400 KB (110 KB gzipped)
- **Improvement**: 36% reduction

### Interaction to Paint (INP)
- **Target**: < 200ms
- **Method**: React Suspense + code-splitting

### Largest Contentful Paint (LCP)
- **Target**: < 2.5s
- **Method**: Lazy load below-fold content

### Cumulative Layout Shift (CLS)
- **Current**: 0 (already optimized)
- **Maintain**: Stable layout

---

## 11. Monitoring Tools

### Build Analysis
```bash
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts
import visualizer from 'rollup-plugin-visualizer';

export default {
  plugins: [visualizer()]
}

# Run: npm run build
# Open: dist/stats.html
```

### Performance Profiling
```bash
# Chrome DevTools
F12 → Performance tab → Record

# Lighthouse
F12 → Lighthouse → Generate report
```

### Runtime Performance
```typescript
// src/main.tsx
performance.mark('react-render-start');

ReactDOM.render(<App />, root);

performance.mark('react-render-end');
performance.measure('react-render', 'react-render-start', 'react-render-end');

console.log(performance.getEntriesByType('measure'));
```

---

## 12. Checklist

- [ ] Phase 1: Compression + resource hints (1 hour)
- [ ] Phase 2: Code-splitting (2 hours)
- [ ] Phase 3: Image optimization (1 hour)
- [ ] Phase 4: Advanced optimizations (2-3 hours)
- [ ] Test: Lighthouse score 90+
- [ ] Test: Bundle size < 120 KB (gzipped)
- [ ] Test: Initial load < 2.5s
- [ ] Monitor: Set up performance tracking

---

## 13. Expected Results

### Before Optimization
- Bundle: 514 KB JS + 98 KB CSS
- Gzipped: 171 KB
- Modules: 314
- Load time: ~3-5s (on slow network)

### After Phase 1 (Compression)
- Gzipped: ~145 KB (15% reduction)
- Load time: ~2.5-4s

### After Phase 2 (Code-splitting)
- Main bundle: 250 KB
- Lazy chunks: 100-150 KB each
- Gzipped: ~95 KB main
- Load time: ~1.5-2.5s initial, fast subsequent

### After Phase 3 (Images)
- Image size: 50-60% smaller
- Lazy load images

### After Phase 4 (Advanced)
- Service Worker: Offline support
- Repeat visits: Instant load
- Target: 90+ Lighthouse score

---

## Notes

- **Current**: Excellent UX, feature-complete, accessibility compliant
- **Optimization**: Not critical for MVP, but recommended for scale
- **Trade-off**: Slightly more complexity vs. 30-40% faster load
- **Rollback**: All optimizations are non-breaking

---

**Status**: Ready for implementation  
**Estimated Time**: 6-8 hours for all phases  
**Priority**: After initial deployment and user feedback
