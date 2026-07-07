import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { test, expect, describe, afterEach } from 'vitest';
import Hero from '../Hero.jsx';
import MetricCard from '../MetricCard.jsx';
import WhyOpen from '../WhyOpen.jsx';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

describe('Hero', () => {
  test('renders default org name and tagline when no config provided', () => {
    render(<Hero />);
    expect(screen.getByText('CivicActions')).toBeDefined();
    expect(screen.getByText('Building in the open, together')).toBeDefined();
  });

  test('renders org name from config', () => {
    const config = { organization: { name: 'My Org' } };
    render(<Hero config={config} />);
    expect(screen.getByText('My Org')).toBeDefined();
  });

  test('renders tagline from config', () => {
    const config = { organization: { name: 'Test', tagline: 'Custom tagline here' } };
    render(<Hero config={config} />);
    expect(screen.getByText('Custom tagline here')).toBeDefined();
  });

  test('renders description from config', () => {
    const config = { organization: { description: 'A custom description for this org.' } };
    render(<Hero config={config} />);
    expect(screen.getByText('A custom description for this org.')).toBeDefined();
  });

  test('renders default description when config has no description', () => {
    const { container } = render(<Hero config={{ organization: {} }} />);
    expect(container.querySelector('.hero-description p').textContent).toMatch(/radical transparency/i);
  });

  test('has hero CSS class on outer container', () => {
    const { container } = render(<Hero />);
    expect(container.querySelector('.hero')).not.toBeNull();
  });

  test('does not show a "viewing" badge when viewingOrg matches defaultOrg', () => {
    render(<Hero viewingOrg="civicactions" defaultOrg="civicactions" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('does not show a "viewing" badge when viewingOrg or defaultOrg is missing', () => {
    render(<Hero viewingOrg="chaoss" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('shows a prominent "viewing" badge naming the org when it differs from the default', () => {
    render(<Hero viewingOrg="chaoss" defaultOrg="civicactions" />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toContain('chaoss');
    expect(badge.textContent).toContain('CivicActions');
  });

  test('"viewing" badge comparison is case-insensitive', () => {
    render(<Hero viewingOrg="CivicActions" defaultOrg="civicactions" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

describe('MetricCard', () => {
  test('renders title and value', () => {
    render(<MetricCard title="Total PRs" value={42} />);
    expect(screen.getByText('Total PRs')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
  });

  test('renders icon when provided', () => {
    render(<MetricCard title="PRs" value={1} icon="🔀" />);
    expect(screen.getByText('🔀')).toBeDefined();
  });

  test('does not render icon container when icon is not provided', () => {
    const { container } = render(<MetricCard title="PRs" value={1} />);
    expect(container.querySelector('.metric-icon')).toBeNull();
  });

  test('renders subtitle when provided', () => {
    render(<MetricCard title="PRs" value={1} subtitle="last 7 days" />);
    expect(screen.getByText('last 7 days')).toBeDefined();
  });

  test('does not render subtitle when not provided', () => {
    const { container } = render(<MetricCard title="PRs" value={1} />);
    expect(container.querySelector('.metric-subtitle')).toBeNull();
  });

  test('shows up arrow and text for up trend', () => {
    const { container } = render(<MetricCard title="PRs" value={1} trend={{ direction: 'up', text: '+5%' }} />);
    const trendEl = container.querySelector('.metric-trend');
    expect(trendEl).not.toBeNull();
    expect(trendEl.textContent).toContain('↑');
    expect(trendEl.textContent).toContain('+5%');
  });

  test('shows down arrow and text for down trend', () => {
    const { container } = render(<MetricCard title="PRs" value={1} trend={{ direction: 'down', text: '-3%' }} />);
    const trendEl = container.querySelector('.metric-trend');
    expect(trendEl).not.toBeNull();
    expect(trendEl.textContent).toContain('↓');
    expect(trendEl.textContent).toContain('-3%');
  });

  test('shows flat arrow and text for flat trend', () => {
    const { container } = render(<MetricCard title="PRs" value={1} trend={{ direction: 'flat', text: 'no change' }} />);
    const trendEl = container.querySelector('.metric-trend');
    expect(trendEl).not.toBeNull();
    expect(trendEl.textContent).toContain('→');
    expect(trendEl.textContent).toContain('no change');
  });

  test('does not render trend element when trend is not provided', () => {
    const { container } = render(<MetricCard title="PRs" value={1} />);
    expect(container.querySelector('.metric-trend')).toBeNull();
  });

  test('applies direction as CSS class on trend element', () => {
    const { container } = render(<MetricCard title="PRs" value={1} trend={{ direction: 'up', text: 'rising' }} />);
    const trendEl = container.querySelector('.metric-trend');
    expect(trendEl.classList.contains('up')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WhyOpen
// ---------------------------------------------------------------------------

describe('WhyOpen', () => {
  test('renders nothing when no config provided', () => {
    const { container } = render(<WhyOpen />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when transparency config is absent', () => {
    const { container } = render(<WhyOpen config={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when whyOpen is not enabled', () => {
    const { container } = render(<WhyOpen config={{ transparency: { whyOpen: { enabled: false } } }} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders heading and default items when enabled', () => {
    render(<WhyOpen config={{ transparency: { whyOpen: { enabled: true } } }} />);
    expect(screen.getByText("Why We're Open")).toBeDefined();
    expect(screen.getByText(/Community First/)).toBeDefined();
    expect(screen.getByText(/Accountability/)).toBeDefined();
    expect(screen.getByText(/Inspire Others/)).toBeDefined();
  });

  test('renders custom items from config instead of defaults', () => {
    const config = {
      transparency: {
        whyOpen: {
          enabled: true,
          items: [
            { icon: '⭐', title: 'Custom Title', description: 'Custom description text here.' },
          ],
        },
      },
    };
    const { container } = render(<WhyOpen config={config} />);
    expect(screen.getByText(/Custom Title/)).toBeDefined();
    expect(screen.getByText('Custom description text here.')).toBeDefined();
    // Default items should not appear within this render
    expect(container.querySelector('.why-item')?.textContent).not.toMatch(/Community First/);
  });

  test('renders multiple custom items', () => {
    const config = {
      transparency: {
        whyOpen: {
          enabled: true,
          items: [
            { icon: 'A', title: 'First', description: 'Desc A' },
            { icon: 'B', title: 'Second', description: 'Desc B' },
          ],
        },
      },
    };
    const { container } = render(<WhyOpen config={config} />);
    const items = container.querySelectorAll('.why-item');
    expect(items.length).toBe(2);
  });
});
