import React from 'react';

function Hero({ orgName = 'CivicActions', tagline = 'Building in the open, together' }) {
  return (
    <div className="hero">
      <div className="hero-content">
        <h1 className="hero-title">{orgName}</h1>
        <p className="hero-tagline">{tagline}</p>
        <div className="hero-description">
          <p>We believe in radical transparency. This dashboard shows our public open-source contributions, celebrating our commitment to building and contributing back to the community.</p>
        </div>
      </div>
    </div>
  );
}

export default Hero;
