# Transparency Dashboard Features

This document lists the key features of the transparency dashboard inspired by cal.com/open.

## Visual Features

### Hero Section
- Large, prominent organization name
- Customizable tagline
- Mission/transparency statement
- Gradient background with brand colors
- Responsive design

### Metric Cards
- Four highlighted metrics with icons:
  - 🚀 Total Contributions
  - 👥 Active Contributors  
  - 📦 Repositories
  - ⚡ This Week's Activity
- Hover effects
- Clean, modern card design
- Automatically calculated from data

### "Why We're Open" Section
- Customizable transparency philosophy cards
- Default: Community First, Accountability, Inspire Others
- Icons + title + description format
- Responsive grid layout
- Can be enabled/disabled via config

### Existing Features (Preserved)
- Weekly trend charts with multiple metrics
- Contributor leaderboard
- Project/repository breakdown view
- Filtering by metric type, time range, and contributor
- Legend with visual indicators

## Technical Features

### Configuration System
- Single source of truth: `site/config.json`
- Organization branding (name, tagline, colors)
- Customizable transparency messaging
- Metric card configuration
- Automatic config deployment via Vite

### Data Pipeline
- SQLite-based data storage
- Weekly automated data collection
- GitHub GraphQL API integration
- Open source license filtering
- Multi-organization support

### Deployment
- Static site generation (Vite + React)
- GitHub Pages ready
- No runtime API calls
- Automatic weekly updates via GitHub Actions
- Custom domain support

## Generalization Features

### Easy Forking
Any organization can fork and customize by:
1. Editing `site/config.json` (branding & content)
2. Editing `scripts/config.json` (data collection)
3. Pushing to GitHub (auto-deployment)

### Flexibility
- Support for multiple GitHub organizations
- Configurable history window
- Optional "all public repos" mode for staff
- License filtering (OSS-only or all)
- Extensible component architecture

## Privacy & Security

- Public data only (no private repos)
- No content leakage (counts only, no titles/URLs)
- Rate-limit safe queries
- No runtime GitHub API access
- Pre-generated static data

## Documentation

- Comprehensive README.md
- Detailed CUSTOMIZATION.md guide
- Quick start for new organizations
- Troubleshooting section
- Example configurations
