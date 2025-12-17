# React UI Setup Guide

This guide explains how to set up and run the new React-based dashboard UI for the DAP Market Research Agent.

---

## Overview

The React UI is a **completely separate interface** from the existing vanilla JavaScript dashboard. Both UIs can coexist:

- **Classic Dashboard**: `/api/dashboard` (vanilla JS, existing)
- **React Dashboard**: `/react-dashboard` (React + TypeScript, new)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all necessary dependencies including:
- `react` & `react-dom`
- `vite` & `@vitejs/plugin-react`
- `@types/react` & `@types/react-dom`
- `cheerio` (for data quality pipeline)

### 2. Development Mode (Recommended for Development)

Run the React app in development mode with hot module replacement:

```bash
npm run dev:ui
```

This starts Vite dev server on **http://localhost:3001**

- ✅ Hot reload on code changes
- ✅ Fast refresh
- ✅ Source maps for debugging
- ✅ API proxy to backend (port 5000)

**Backend must be running separately:**
```bash
# In another terminal
npm run dev
```

### 3. Production Build

Build the React app for production:

```bash
npm run build:ui
```

This:
1. Compiles TypeScript with type checking
2. Builds React app with Vite
3. Outputs to `dist/ui/`

After building, the React dashboard will be available at:
- **http://localhost:5000/react-dashboard** (when backend is running)

---

## File Structure

```
src/ui/                          # React UI source
├── App.tsx                      # Main app component
├── index.tsx                    # React root
├── index.html                   # HTML template
├── components/                  # Reusable components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── ReportGenerationCard.tsx
│   ├── ProgressTracker.tsx
│   └── RecentReportsGrid.tsx
├── pages/                       # Page components
│   ├── DashboardView.tsx
│   ├── ReportHistoryView.tsx
│   ├── DataQualityView.tsx
│   └── SettingsView.tsx
└── styles/                      # CSS modules
    ├── index.css                # Global styles
    ├── App.css
    ├── Header.css
    └── ...

dist/ui/                         # Built React app (after build:ui)
├── index.html
└── assets/
    ├── index-[hash].js
    └── index-[hash].css

vite.config.ts                   # Vite configuration
tsconfig.ui.json                 # TypeScript config for UI
```

---

## API Endpoints

The React UI uses dedicated API endpoints under `/api/react/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/react/history-list` | GET | Get all reports with quality scores |
| `/api/react/generate-report` | POST | Trigger manual report generation |
| `/api/react/settings-list` | GET | Get current settings |
| `/api/react/settings-update` | POST | Update a setting |
| `/api/react/data-quality-metrics` | GET | Get data quality metrics |
| `/api/react/workflow-progress/:runId` | GET | SSE endpoint for real-time progress |

### Server-Sent Events (SSE)

The React UI uses SSE for real-time workflow progress tracking:

```typescript
// React component subscribes to progress updates
const eventSource = new EventSource(`/api/react/workflow-progress/${runId}`);

eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  // Update UI with progress
};
```

---

## Development Workflow

### Typical Development Flow

1. **Start backend**:
   ```bash
   npm run dev
   ```

2. **Start React UI in dev mode** (in another terminal):
   ```bash
   npm run dev:ui
   ```

3. **Open browser**:
   - React UI: http://localhost:3001
   - Classic UI: http://localhost:5000/api/dashboard

4. **Make changes** to React components
   - Changes auto-reload via HMR
   - TypeScript errors shown in terminal

5. **Build for production** when ready:
   ```bash
   npm run build:ui
   ```

### Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Mastra backend server |
| `npm run dev:ui` | Start Vite dev server for React UI |
| `npm run build:ui` | Build React UI for production |
| `npm run preview:ui` | Preview production build locally |

---

## Configuration

### Vite Configuration (`vite.config.ts`)

```typescript
{
  root: 'src/ui',              // UI source directory
  build: {
    outDir: 'dist/ui',         // Build output directory
  },
  server: {
    port: 3001,                // Dev server port
    proxy: {
      '/api': 'http://localhost:5000'  // Proxy API requests to backend
    }
  }
}
```

### TypeScript Configuration (`tsconfig.ui.json`)

- Separate TS config for UI (React + JSX)
- Path aliases for cleaner imports:
  - `@/` → `src/ui/`
  - `@components/` → `src/ui/components/`
  - `@pages/` → `src/ui/pages/`
  - `@styles/` → `src/ui/styles/`

---

## Features

### Dashboard View
- Report generation card with one-click trigger
- Real-time progress tracker with:
  - Progress bar (percentage complete)
  - Current step status
  - Estimated time remaining
  - Live activity log (last 10 entries)
- Recent reports grid (last 3 reports)
- Quality scores displayed

### Report History View
- Full table of all reports
- Filter by trigger type (cron/manual)
- Columns: title, date range, generated at, trigger, quality score, links
- Links to web version and Google Docs
- Slack notification status

### Data Quality Dashboard
- 4 metric cards:
  - Average content quality score
  - Sources scraped vs failed
  - Citation validation rate
  - Last updated timestamp
- Quality insights with warnings/success messages
- Color-coded status indicators

### Settings View
- Slack channel ID configuration
- Export destination selection
- Cron schedule display (read-only)
- Form validation
- Success/error messages

### Real-Time Progress Tracking
- Server-Sent Events (SSE) for live updates
- Step-by-step progress visualization
- Activity log with timestamps
- Estimated completion time
- Status icons (pending/in_progress/completed/failed)

---

## Troubleshooting

### React Dashboard Shows "Not Built"

**Problem**: Visiting `/react-dashboard` shows a message saying the UI hasn't been built.

**Solution**: Build the React UI first:
```bash
npm run build:ui
```

### API Calls Failing in Dev Mode

**Problem**: API requests return 404 or CORS errors.

**Solution**: Make sure the backend is running on port 5000:
```bash
npm run dev
```

### TypeScript Errors

**Problem**: Type errors when running `npm run build:ui`.

**Solution**: Check `tsconfig.ui.json` and ensure all dependencies are installed:
```bash
npm install
```

### Vite Dev Server Port Conflict

**Problem**: Port 3001 is already in use.

**Solution**: Change the port in `vite.config.ts`:
```typescript
server: {
  port: 3002,  // or any available port
}
```

---

## Deployment

### Building for Production

1. Build the React UI:
   ```bash
   npm run build:ui
   ```

2. Build the backend:
   ```bash
   npm run build
   ```

3. The built React app will be served at `/react-dashboard`

### Environment Variables

The React UI uses the same environment variables as the backend:
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `PERPLEXITY_API_KEY`
- `SLACK_BOT_TOKEN`
- etc.

---

## Integration with Data Quality Pipeline

The React UI is designed to work with the new data quality pipeline:

### Content Quality Metrics

The `DataQualityView` displays metrics from the data quality pipeline:
- Average content quality score (0-100)
- Sources scraped vs failed
- Citation validation rate

These metrics are computed during workflow execution and stored in the database.

### Real-Time Progress

The `ProgressTracker` component shows live progress during report generation:
- Current workflow step
- Progress percentage
- Activity logs
- Estimated time remaining

---

## Next Steps

### To Integrate Data Quality Pipeline into Workflow:

1. **Update workflow** to use `DataQualityPipeline`:
   ```typescript
   import { DataQualityPipeline } from '../services/dataQuality';

   const pipeline = new DataQualityPipeline();
   const enrichedContent = await pipeline.processBatch(rawContents);
   ```

2. **Store quality metrics** in database during workflow execution

3. **Emit progress events** for real-time tracking:
   ```typescript
   // Emit progress event
   await db.storeProgressEvent(runId, {
     currentStep: 3,
     totalSteps: 10,
     stepName: 'Gathering competitor data',
     status: 'in_progress',
   });
   ```

4. **Update SSE endpoint** to read real progress from database

---

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## Summary

The new React UI provides:
- ✅ Modern component-based architecture
- ✅ TypeScript for type safety
- ✅ Real-time progress tracking with SSE
- ✅ Professional design system
- ✅ Data quality metrics dashboard
- ✅ Hot module replacement for fast development

Both UIs (classic and React) can coexist, allowing gradual migration.
