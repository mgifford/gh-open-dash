import React from 'react';

function Hero({ config, viewingOrg, defaultOrg }) {
  const orgName = config?.organization?.name || 'CivicActions';
  const tagline = config?.organization?.tagline || 'Building in the open, together';
  const description = config?.organization?.description ||
    'We believe in radical transparency. This dashboard shows our public open-source contributions, celebrating our commitment to building and contributing back to the community.';

  const isViewingOther = viewingOrg && defaultOrg && viewingOrg.toLowerCase() !== defaultOrg.toLowerCase();

  return (
    <div className="hero">
      <div className="hero-content">
        {isViewingOther && (
          <div className="hero-viewing-badge" role="status">
            📊 Now viewing data for <strong>{viewingOrg}</strong>, not {orgName}
          </div>
        )}
        <h1 className="hero-title">{orgName}</h1>
        <p className="hero-tagline">{tagline}</p>
        <div className="hero-description">
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default Hero;
