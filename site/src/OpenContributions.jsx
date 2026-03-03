import React, { useState } from 'react';

/**
 * OpenContributions - Shows which tracked repos publish an
 * `.well-known/open-contributions.json` descriptor and surfaces
 * any structured metadata they contain.
 *
 * Spec: https://www.foo.be/2026/03/open-contributions-descriptor
 */
function DescriptorDetail({ descriptor }) {
  if (!descriptor) return null;
  const entries = Object.entries(descriptor).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;

  return (
    <dl style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: '1.6' }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <dt style={{ fontWeight: 600, minWidth: 140, color: '#555' }}>{key}:</dt>
          <dd style={{ margin: 0, wordBreak: 'break-word' }}>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RepoRow({ entry }) {
  const [open, setOpen] = useState(false);

  return (
    <li
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          title={entry.has_descriptor ? 'Has open-contributions descriptor' : 'No descriptor found'}
          style={{ fontSize: 16 }}
        >
          {entry.has_descriptor ? '✅' : '⬜'}
        </span>
        <span style={{ fontFamily: 'monospace', flex: 1 }}>{entry.repo}</span>
        {entry.has_descriptor && entry.descriptor && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              fontSize: 12,
              padding: '2px 8px',
              cursor: 'pointer',
              background: '#f0f4ff',
              border: '1px solid #b0c4e8',
              borderRadius: 4,
            }}
          >
            {open ? 'Hide' : 'View'}
          </button>
        )}
      </div>
      {open && <DescriptorDetail descriptor={entry.descriptor} />}
    </li>
  );
}

function OpenContributions({ data }) {
  const [showAll, setShowAll] = useState(false);

  if (!data || !data.open_contributions || data.open_contributions.length === 0) {
    return (
      <div className="chart-container">
        <h3>📄 Open Contributions Descriptors</h3>
        <p className="no-data">
          No open-contributions data available yet. Enable{' '}
          <code>collectOpenContributions</code> in{' '}
          <code>scripts/config.json</code> to check tracked repos for{' '}
          <code>.well-known/open-contributions.json</code> descriptors.
        </p>
      </div>
    );
  }

  const total = data.open_contributions.length;
  const withDescriptor = data.open_contributions.filter(r => r.has_descriptor);
  const displayList = showAll ? data.open_contributions : withDescriptor;

  return (
    <div className="chart-container">
      <h3>📄 Open Contributions Descriptors</h3>
      <p style={{ marginBottom: 10, color: '#555', fontSize: 14 }}>
        {withDescriptor.length} of {total} tracked{' '}
        {total === 1 ? 'repo publishes' : 'repos publish'} a{' '}
        <code>.well-known/open-contributions.json</code> descriptor.
        {' '}
        <a
          href="https://www.foo.be/2026/03/open-contributions-descriptor"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#005a9c' }}
        >
          Learn about the spec ↗
        </a>
      </p>

      {withDescriptor.length === 0 ? (
        <p className="no-data">
          None of the tracked repositories currently publish an open-contributions descriptor.
          Consider adding a <code>.well-known/open-contributions.json</code> file to your
          projects to improve contribution discoverability!
        </p>
      ) : (
        <>
          <ul style={{ padding: 0, margin: 0, border: '1px solid #e0e0e0', borderRadius: 6 }}>
            {displayList.map(entry => (
              <RepoRow key={entry.repo} entry={entry} />
            ))}
          </ul>
          {total > withDescriptor.length && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowAll(s => !s)}
                style={{
                  fontSize: 13,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  background: 'none',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  color: '#005a9c',
                }}
              >
                {showAll
                  ? 'Show only repos with descriptors'
                  : `Show all ${total} checked repos`}
              </button>
            </div>
          )}
        </>
      )}
      <p style={{ marginTop: 10, fontSize: 12, color: '#888', fontStyle: 'italic' }}>
        Descriptors fetched via the GitHub Contents API for each tracked repository.
        Run <code>node scripts/update_sqlite.mjs</code> with{' '}
        <code>collectOpenContributions: true</code> to refresh.
      </p>
    </div>
  );
}

export default OpenContributions;
