# Customization Guide

This guide will help you customize the transparency dashboard for your organization.

## Quick Setup for New Organizations

### 1. Fork the Repository

Fork this repository to your GitHub organization account.

### 2. Configure Your Organization

Edit `site/config.json` with your organization's information:

```json
{
  "organization": {
    "name": "Your Organization Name",
    "tagline": "Your catchy tagline",
    "description": "Why you believe in transparency and open source...",
    "githubOrg": "your-github-org-name",
    "website": "https://yourwebsite.com"
  },
  "branding": {
    "primaryColor": "#004488",
    "primaryLightColor": "#0066bb",
    "accentColor": "#107c10"
  },
  "transparency": {
    "whyOpen": {
      "enabled": true,
      "items": [
        {
          "icon": "🌍",
          "title": "Community First",
          "description": "Your explanation of why community matters to you..."
        },
        {
          "icon": "📊",
          "title": "Accountability",
          "description": "How transparency keeps you accountable..."
        },
        {
          "icon": "🚀",
          "title": "Inspire Others",
          "description": "How you hope to inspire others..."
        }
      ]
    }
  },
  "metrics": {
    "cards": [
      {
        "id": "total_contributions",
        "title": "Total Contributions",
        "icon": "🚀",
        "enabled": true
      },
      {
        "id": "active_contributors",
        "title": "Active Contributors",
        "icon": "👥",
        "enabled": true
      },
      {
        "id": "repositories",
        "title": "Repositories",
        "icon": "📦",
        "enabled": true
      },
      {
        "id": "this_week",
        "title": "This Week",
        "icon": "⚡",
        "enabled": true
      }
    ]
  }
}
```

### 3. Configure Data Collection

Edit `scripts/config.json` to set which organizations to track:

```json
{
  "orgAllowlist": ["your-github-org", "partner-org-if-any"],
  "historyWeeks": 260,
  "maxWeeksPerRun": 10,
  "collectAllPublic": false,
  "licenseFilter": "oss"
}
```

**Options explained:**
- `orgAllowlist`: Array of GitHub organization names to track
- `historyWeeks`: How many weeks of history to collect (260 = ~5 years)
- `maxWeeksPerRun`: How many weeks to process per workflow run (prevents timeouts)
- `collectAllPublic`: If true, also tracks staff contributions outside org repos
- `licenseFilter`: "oss" (only open source licenses) or "all" (any repo)

### 4. Set Up GitHub Actions

1. **Add a GitHub Token**:
   - Go to your repository Settings → Secrets and variables → Actions
   - Add a new secret named `GITHUB_TOKEN`
   - Use a Personal Access Token with `read:org` scope

2. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Set Source to "GitHub Actions"
   - The workflow will automatically deploy

3. **Trigger the workflow**:
   - Go to Actions tab
   - Select "Update Metrics"
   - Click "Run workflow"

### 5. Customize Branding Colors

The dashboard uses CSS variables for easy theming. You can either:

**Option A: Edit `site/config.json`** (coming soon - currently in CSS only)

**Option B: Edit `site/src/styles.css`** directly:

```css
:root {
  --primary: #004488;         /* Main brand color */
  --primary-light: #0066bb;   /* Lighter variant for gradients */
  --bg: #f5f5f5;              /* Page background */
  --card-bg: #ffffff;         /* Card backgrounds */
  --text: #333;               /* Text color */
  --border: #e0e0e0;          /* Border color */
  --success: #107c10;         /* Success/positive color */
  --info: #0078d4;            /* Info/neutral color */
}
```

## Advanced Customization

### Adding Custom "Why Open" Items

You can add more than 3 items to the "Why We're Open" section:

```json
{
  "transparency": {
    "whyOpen": {
      "enabled": true,
      "items": [
        {
          "icon": "🎯",
          "title": "Your Custom Reason",
          "description": "Explanation of this transparency value..."
        }
      ]
    }
  }
}
```

### Disabling Sections

To hide the "Why We're Open" section:

```json
{
  "transparency": {
    "whyOpen": {
      "enabled": false
    }
  }
}
```

### Custom Metric Cards

You can customize which metric cards appear and their order in `site/config.json`:

```json
{
  "metrics": {
    "cards": [
      {
        "id": "total_contributions",
        "title": "Total Contributions",
        "icon": "🚀",
        "enabled": true
      },
      {
        "id": "active_contributors",
        "title": "Team Members",
        "icon": "👥",
        "enabled": true
      }
    ]
  }
}
```

### Tracking Multiple Organizations

Add multiple organizations to track contributions across an ecosystem:

```json
{
  "orgAllowlist": [
    "your-main-org",
    "your-subsidiary",
    "partner-org",
    "upstream-project"
  ]
}
```

All contributions will be aggregated together in the dashboard.

### Staff Allowlist for External Contributions

If you want to track your team's contributions to projects outside your organization:

1. Edit `scripts/staff_allowlist.json`:
   ```json
   ["username1", "username2", "username3"]
   ```

2. In `scripts/config.json`, enable:
   ```json
   {
     "collectAllPublic": true
   }
   ```

⚠️ **Note**: This will use more API calls and only works for users in the staff allowlist.

## Deployment Options

### GitHub Pages (Recommended)

The default setup deploys to GitHub Pages automatically. The workflow:
1. Runs weekly (or on-demand)
2. Collects metrics from GitHub API
3. Builds the static site
4. Deploys to `https://your-org.github.io/repository-name/`

### Custom Domain

To use a custom domain:
1. Add a `CNAME` file to `site/public/` with your domain
2. Configure DNS as per [GitHub Pages docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

### Self-Hosting

You can host the built site anywhere:

```bash
# Build the site
cd site
npm run build

# The dist/ folder contains your static site
# Deploy dist/ to any static hosting provider
```

## Testing Locally

Before deploying, test your changes locally:

```bash
# 1. Install dependencies
npm install
cd site && npm install && cd ..

# 2. Collect sample data (requires GITHUB_TOKEN)
export GITHUB_TOKEN=your_token
npm run update
npm run export

# 3. Copy metrics to public directory (config is auto-copied by Vite)
mkdir -p site/public/data
cp data/metrics.json site/public/data/

# 4. Start dev server
cd site
npm run dev
```

Open http://localhost:5173 to see your customized dashboard!

> **Note**: The Vite build process automatically copies `site/config.json` to the public directory, so you only need to maintain one config file.

## Troubleshooting

### "Failed to load config.json"
- Ensure `site/config.json` exists
- Verify the JSON is valid (no trailing commas, proper quotes)
- Check that the file is copied to `site/public/` for local development

### "Failed to load metrics.json"
- Run the data collection scripts first
- Make sure `data/metrics.json` exists
- Copy it to `site/public/data/` for local dev

### Metrics Not Updating
- Check GitHub Actions logs for errors
- Verify your `GITHUB_TOKEN` secret is valid
- Ensure the token has `read:org` scope

### Colors Not Changing
- CSS variables in `site/src/styles.css` take precedence
- Clear browser cache after changes
- Check browser dev tools to verify CSS is loading

## Examples

### Minimal Configuration

```json
{
  "organization": {
    "name": "Acme Corp",
    "tagline": "Open source, open data",
    "githubOrg": "acmecorp"
  }
}
```

This uses all defaults and just changes the organization name.

### Full Custom Configuration

See `site/config.json` for a complete example with all available options.

## Need Help?

- Check the [README.md](README.md) for setup instructions
- Review [AGENTS.md](AGENTS.md) for data collection rules
- Open an issue if you need assistance
