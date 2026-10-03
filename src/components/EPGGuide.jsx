import React, { useMemo } from 'react';

const normalizeGuideKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/&amp;/g, '&')
  .replace(/\b(?:fhd|uhd|hd|sd|hevc|4k|8k)\b/g, '')
  .replace(/^[a-z]{2,4}\s*[-|]\s*/i, '')
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];

const getGuideKeys = (channel) => {
  if (!channel) return [];

  const rawKeys = uniqueValues([
    channel.epgId,
    channel.name,
    ...(channel.epgAliases || []),
  ]);
  const normalizedKeys = rawKeys.map(normalizeGuideKey);

  return uniqueValues([...rawKeys, ...normalizedKeys]);
};

function EPGGuide({ channel, epgData, loading }) {
  const parseXmltvDate = (value) => {
    const raw = String(value || '');
    const xtreamMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (xtreamMatch) {
      const [, year, month, day, hour, minute, second] = xtreamMatch;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    }

    const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/);
    if (!match) return new Date(value || 0);

    const [, year, month, day, hour, minute, second, offset] = match;
    const tz = offset ? `${offset.slice(0, 3)}:${offset.slice(3)}` : 'Z';
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${tz}`);
  };

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const currentPrograms = useMemo(() => {
    if (!channel) return [];

    const programs = getGuideKeys(channel)
      .map((key) => epgData[key])
      .find((items) => Array.isArray(items) && items.length) || [];
    if (!programs.length) return [];

    const now = new Date();

    return programs
      .map((prog) => ({
        ...prog,
        startDate: parseXmltvDate(prog.start),
        stopDate: parseXmltvDate(prog.stop),
      }))
      .filter((prog) => prog.stopDate >= now)
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 4)
      .map((prog) => {
        const isCurrent = prog.startDate <= now && prog.stopDate >= now;
        return {
          ...prog,
          label: isCurrent ? 'Now' : formatTime(prog.startDate),
        };
      })
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
              <div className="program-title"><span>{prog.label}</span>{prog.title}</div>
              {prog.description && <div className="program-desc">{prog.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="no-epg">No guide data was found for this channel in the provider EPG.</p>
      )}
    </div>
  );
}

export default EPGGuide;
