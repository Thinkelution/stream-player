import React, { useState, useMemo, useDeferredValue, useEffect, useCallback } from 'react';

const ROW_HEIGHT = 50;
const OVERSCAN = 8;

const typeLabel = (type) => {
  if ((type || 'live') === 'movie') return 'Movie';
  if (type === 'series') return 'Series';
  return 'Live';
};

function ChannelList({ channels, selectedChannel, onSelect, favorites, onToggleFavorite, loading, getFavoriteKeys, onVisibleChannelsChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedType, setSelectedType] = useState('all');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const getChannelKey = useCallback((channel) => `${channel.name}|${channel.group}|${channel.contentType || 'live'}|${channel.streamId || channel.seriesId || channel.url}`, []);
  const getKeysForFavorite = useCallback((channel) => getFavoriteKeys?.(channel) || [getChannelKey(channel), `${channel.name}|${channel.group}|${channel.url}`], [getFavoriteKeys, getChannelKey]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const isFavorite = (channel) => getKeysForFavorite(channel).some((key) => favoriteSet.has(key));

  const groups = useMemo(() => {
    const groupSet = new Set(['All', 'Favorites']);
    channels
      .filter((ch) => selectedType === 'all' || (ch.contentType || 'live') === selectedType)
      .forEach((ch) => groupSet.add(ch.group));
    return Array.from(groupSet).filter((group) => group !== 'Favorites' || favorites.length > 0);
  }, [channels, favorites.length, selectedType]);

  const indexedChannels = useMemo(() => {
    return channels.map((channel) => ({
      channel,
      key: getChannelKey(channel),
      searchName: channel.name.toLowerCase(),
    }));
  }, [channels, getChannelKey]);

  const filtered = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return indexedChannels.filter(({ channel: ch, key, searchName }) => {
      const matchesSearch = !normalizedSearch || searchName.includes(normalizedSearch);
      const matchesType = selectedType === 'all' || (ch.contentType || 'live') === selectedType;
      const matchesGroup = selectedGroup === 'All'
        || (selectedGroup === 'Favorites' && getKeysForFavorite(ch).some((favoriteKey) => favoriteSet.has(favoriteKey)))
        || ch.group === selectedGroup;
      return matchesSearch && matchesType && matchesGroup;
    }).map(({ channel }) => channel);
  }, [indexedChannels, deferredSearchTerm, selectedGroup, selectedType, favoriteSet, getKeysForFavorite]);

  useEffect(() => {
    setScrollTop(0);
  }, [deferredSearchTerm, selectedGroup, selectedType]);


  useEffect(() => {
    if (!groups.includes(selectedGroup)) setSelectedGroup('All');
  }, [groups, selectedGroup]);


  useEffect(() => {
    const typePrefix = selectedType === 'all' ? '' : `${typeLabel(selectedType)} · `;
    const groupName = selectedGroup === 'All' ? 'All channels' : selectedGroup;
    onVisibleChannelsChange?.(filtered, `${typePrefix}${groupName}`);
  }, [filtered, selectedGroup, selectedType, onVisibleChannelsChange]);

  const virtualRows = useMemo(() => {
    const visibleCount = Math.ceil((viewportHeight || 1) / ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(filtered.length, startIndex + visibleCount + OVERSCAN * 2);

    return {
      startIndex,
      rows: filtered.slice(startIndex, endIndex),
      topPad: startIndex * ROW_HEIGHT,
      bottomPad: Math.max(0, (filtered.length - endIndex) * ROW_HEIGHT),
    };
  }, [filtered, scrollTop, viewportHeight]);

  const typeCounts = useMemo(() => channels.reduce((counts, channel) => {
    const type = channel.contentType || 'live';
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, { live: 0, movie: 0, series: 0 }), [channels]);

  const typeFilters = [
    ['all', `All ${channels.length}`],
    ['live', `Live ${typeCounts.live || 0}`],
    ['movie', `Movies ${typeCounts.movie || 0}`],
    ['series', `Series ${typeCounts.series || 0}`],
  ].filter(([type, label]) => type === 'all' || !label.endsWith(' 0'));

  const groupLabel = (group) => {
    if (group === 'All') return `All ${channels.length}`;
    if (group === 'Favorites') return `Favorites ${favorites.length}`;
    return group;
  };

  return (
    <div className="channel-list">
      <div className="sidebar-header">
        <div>
          <h2>Library</h2>
          <p>{filtered.length} showing</p>
        </div>
        {loading && <span className="mini-spinner" aria-label="Loading channels" />}
      </div>

      <div className="type-filter">
        {typeFilters.map(([type, label]) => (
          <button
            key={type}
            className={`type-btn ${selectedType === type ? 'active' : ''}`}
            onClick={() => {
              setSelectedType(type);
              setSelectedGroup('All');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search channels"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="group-filter">
        {groups.map((group) => (
          <button
            key={group}
            className={`group-btn ${selectedGroup === group ? 'active' : ''}`}
            onClick={() => setSelectedGroup(group)}
          >
            {groupLabel(group)}
          </button>
        ))}
      </div>

      <div
        className="channels"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={(node) => {
          if (node && node.clientHeight !== viewportHeight) setViewportHeight(node.clientHeight);
        }}
      >
        {loading && channels.length === 0 ? (
          <div className="channel-list-loading">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </div>
        ) : filtered.length > 0 ? (
          <>
            {virtualRows.topPad > 0 && <div style={{ height: virtualRows.topPad }} />}
            {virtualRows.rows.map((channel) => (
              <div
                key={getChannelKey(channel)}
                className={`channel-item ${selectedChannel && getChannelKey(selectedChannel) === getChannelKey(channel) ? 'active' : ''}`}
                onClick={() => onSelect(channel)}
              >
                <div className="channel-logo-frame">
                  {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
                </div>
                <div className="channel-copy">
                  <span className="channel-name">{channel.name}</span>
                  <span className="channel-group"><b>{typeLabel(channel.contentType)}</b> · {channel.group}</span>
                </div>
                <button
                  className={`favorite-btn ${isFavorite(channel) ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(channel);
                  }}
                  title={isFavorite(channel) ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={isFavorite(channel) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite(channel) ? '★' : '☆'}
                </button>
              </div>
            ))}
            {virtualRows.bottomPad > 0 && <div style={{ height: virtualRows.bottomPad }} />}
          </>
        ) : (
          <div className="empty-list">
            <strong>No channels found</strong>
            <span>Try a different search or category.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChannelList;
