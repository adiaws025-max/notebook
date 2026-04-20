---
name: dataledger
description: Build a structured, high-clarity CSV analytics and notebook platform designed for reliability, readability, and real-world usability.
---

# DataLedger — System Blueprint

DataLedger is a browser-based data analysis platform designed to make structured data understandable, reliable, and easy to work with.

It combines CSV processing, intelligent visualization, and guided Python execution into a single environment that prioritizes clarity and usability.

---

## Design Direction

This system is intentionally built for clarity over complexity.

The interface must:
- Be easy to read without strain
- Avoid clutter and unnecessary motion
- Use strong contrast and consistent spacing
- Present information in a controlled, step-by-step manner

Avoid overwhelming the user. Show only what is needed at each stage.

---

## Core System Capabilities

### 1. Structured CSV Processing
- Header normalization (lowercase, consistent format)
- Duplicate detection and removal
- Missing value identification and handling
- Type-safe parsing with validation layer

### 2. Intelligent Data Profiling (NEW)
Before any visualization:
- Column summaries (min, max, unique count)
- Data quality warnings
- Type confidence scoring (detect misclassified columns)

This fixes a major weakness from the old system.

---

### 3. Unified Visualization Engine (FIXED)

Instead of separate STANDARD and CUSTOM modes:
- Single engine with guided defaults + manual override
- Dynamic column filtering based on chart type
- Smart chart recommendations

Supported charts:
- Distribution
- Pie / Category Breakdown
- Violin
- Heatmap (correlation)
- Pair analysis grid
- Joint distribution
- Bar
- Histogram
- Scatter
- Line

---

### 4. Context-Aware Insight Engine (UPGRADED)

- Recognizes common column meanings (age, income, etc.)
- Generates human-readable explanations
- Provides:
  - Trend explanation
  - Risk flags
  - Data imbalance warnings
  - Correlation interpretation

Outputs are short, readable, and practical.

---

### 5. Guided Notebook System (REFINED)

Instead of dumping 14 cells at once:

- Progressive notebook unlocking
- Each step builds on the previous one
- Clear explanations for each operation

Notebook includes:
- Data loading
- Structure inspection
- Cleaning validation
- Statistical summary
- Visualization generation

All outputs render inline using image encoding.

---

### 6. Lightweight Python Runtime (FIXED)

Old issue:
- Pyodide loaded everything → slow

New approach:
- Lazy-load packages only when needed
- Preload minimal core (pandas, numpy)
- Load matplotlib/scipy only when required

This significantly improves performance.

---

### 7. Deterministic Error Recovery (IMPROVED)

Instead of vague AI repair:

1. Detect exact error type
2. Apply rule-based fix:
   - Missing import
   - Wrong column reference
   - Type mismatch
3. Show corrected version
4. Allow user to accept or reject

No hidden AI rewriting.

---

### 8. Workspace System

Users can:
- Save datasets
- Reload previous sessions
- Delete stored work

Storage:
- Firebase (primary)
- Local fallback

Includes confirmation safeguards.

---

### 9. Step-Based Workflow (NEW UX FIX)

Instead of showing everything at once:

1. Upload
2. Clean
3. Review Data Profile
4. Visualize
5. Analyze
6. Notebook

Each step unlocks the next.

This prevents overload and improves usability.

---

## Technology Stack

| Layer | Tool |
|------|------|
| Framework | Next.js |
| UI | React |
| Language | TypeScript |
| Charts | Chart.js |
| Data Parsing | Papa Parse |
| Python Runtime | Pyodide |
| Storage | Firebase |
| Styling | Tailwind CSS |

---

## Project Structure
