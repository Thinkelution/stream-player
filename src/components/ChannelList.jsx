import React, { useState, useMemo } from 'react';

function ChannelList({ channels, selectedChannel, onSelect, favorites, onToggleFavorite, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  const getChannelKey = (channel) => `${channel.name}|${channel.group}|${channel.url}`;
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const isFavorite = (channel) => favoriteSet.has(getChannelKey(channel));

  const groups = useMemo(() => {
    const groupSet = new Set(['All', 'Favorites']);
    channels.forEach((ch) => groupSet.add(ch.group));
    return Array.from(groupSet).filter((group) => group !== 'Favorites' || favorites.length > 0);
  }, [channels, favorites.length]);

  const filtered = useMemo(() => {
    return channels.filter((ch) => {
      const matchesSearch = ch.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'All'
        || (selectedGroup === 'Favorites' && favoriteSet.has(getChannelKey(ch)))
        || ch.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchTerm, selectedGroup, favoriteSet]);

  const groupLabel = (group) => {
    if (group === 'All') return `All ${channels.length}`;
    if (group === 'Favorites') return `Favorites ${favorites.length}`;
    return group;
  };

  return (
    <div className="channel-list">
      <div className="sidebar-header">
        <div>
          <h2>Channels</h2>
          <p>{filtered.length} showing</p>
        </div>
        {loading && <span className="mini-spinner" aria-label="Loading channels" />}
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

      <div className="channels">
        {loading && channels.length === 0 ? (
          <div className="channel-list-loading">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row short" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((channel) => (
            <div
              key={getChannelKey(channel)}
              className={`channel-item ${selectedChannel === channel ? 'active' : ''}`}
              onClick={() => onSelect(channel)}
            >
              <div className="channel-logo-frame">
                {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
              </div>
              <div className="channel-copy">
                <span className="channel-name">{channel.name}</span>
                <span className="channel-group">{channel.group}</span>
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
          ))
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
