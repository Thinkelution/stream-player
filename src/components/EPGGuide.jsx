import React, { useMemo } from 'react';

function EPGGuide({ channel, epgData, loading }) {
  const currentPrograms = useMemo(() => {
    if (!channel || !epgData[channel.name]) return [];

    const now = new Date();
    const programs = epgData[channel.name] || [];

    return programs
      .filter((prog) => {
        const start = new Date(prog.start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
        const stop = new Date(prog.stop.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
        return start <= now && stop >= now;
      })
      .slice(0, 5);
  }, [channel, epgData]);

  return (
    <div className="epg-guide">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Guide</span>
          <h3>Now & Next</h3>
        </div>
        {loading && <span className="mini-spinner" aria-label="Loading guide" />}
      </div>
      {loading && currentPrograms.length === 0 ? (
        <div className="guide-loading">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ) : currentPrograms.length > 0 ? (
        <div className="programs">
          {currentPrograms.map((prog, idx) => (
            <div key={idx} className="program">
              <div className="program-title">{prog.title}</div>
              {prog.description && <div className="program-desc">{prog.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="no-epg">No EPG data available</p>
      )}
    </div>
  );
}

export default EPGGuide;
