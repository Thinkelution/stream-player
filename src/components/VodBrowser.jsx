import React, { useEffect, useMemo, useState } from 'react';

export default function VodBrowser({ type, channels, detail, onSelect, onPlay, onBack, onRetry }) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All');
  const [page, setPage] = useState(0);
  const [season, setSeason] = useState('');
  const items = useMemo(() => channels.filter(item => item.contentType === type), [channels, type]);
  const groups = useMemo(() => [...new Set(items.map(item => item.group))], [items]);
  const filtered = useMemo(() => items.filter(item => (group === 'All' || item.group === group)
    && item.name.toLowerCase().includes(search.toLowerCase())), [items, group, search]);
  const seasons = useMemo(() => [...new Set((detail?.episodes || []).map(item => String(item.season)))], [detail]);
  useEffect(() => { setSearch(''); setGroup('All'); }, [type]);
  useEffect(() => { setPage(0); }, [search, group, type, channels]);
  useEffect(() => { setSeason(seasons[0] || ''); }, [seasons]);

  if (detail) return <section className="vod-browser">
    <button className="btn btn-secondary" onClick={onBack}>Back to series</button>
    <h2>{detail.channel.name}</h2>
    {detail.loading && <p role="status">Loading seasons and episodes…</p>}
    {detail.error && <p role="alert">{detail.error} <button onClick={onRetry}>Retry</button></p>}
    {detail.episodes?.length > 0 && <>
      <label>Season <select value={season} onChange={event => setSeason(event.target.value)}>
        {seasons.map(value => <option key={value} value={value}>Season {value}</option>)}
      </select></label>
      <div className="episode-list">{detail.episodes.filter(item => String(item.season) === season).map(item =>
        <button className="episode-card" key={item.url} onClick={() => onPlay(item)}>
          <strong>Episode {item.episodeNumber}</strong><span>{item.episodeTitle}</span><span>Play episode</span>
        </button>)}</div>
    </>}
  </section>;

  return <section className="vod-browser">
    <h2>{type === 'movie' ? 'Movies' : 'Series'}</h2>
    <div className="vod-filters">
      <input aria-label="Search titles" placeholder="Search titles" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Category" value={group} onChange={event => setGroup(event.target.value)}>
        <option value="All">All categories</option>{groups.map(value => <option key={value}>{value}</option>)}
      </select>
    </div>
    <p>{filtered.length} titles</p>
    <div className="vod-grid">{filtered.slice(page * 60, (page + 1) * 60).map(item =>
      <button className="vod-card" key={item.streamId || item.seriesId || item.url} onClick={() => onSelect(item)}>
        {item.logo ? <img src={item.logo} alt="" loading="lazy" /> : <div className="vod-poster-placeholder">{item.name.charAt(0)}</div>}
        <strong>{item.name}</strong><span>{item.group}</span><span>{type === 'movie' ? 'Play movie' : item.seriesId ? 'Browse episodes' : 'Play episode'}</span>
      </button>)}</div>
    {!filtered.length && <p>No titles found. Try another search or category.</p>}
    {filtered.length > 60 && <div className="vod-pagination">
      <button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span>Page {page + 1} of {Math.ceil(filtered.length / 60)}</span>
      <button disabled={(page + 1) * 60 >= filtered.length} onClick={() => setPage(value => value + 1)}>Next</button>
    </div>}
  </section>;
}
