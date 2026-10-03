import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import ChannelList from './components/ChannelList';
import VideoPlayer from './components/VideoPlayer';
import EPGGuide from './components/EPGGuide';
import Settings from './components/Settings';

const FAVORITES_STORAGE_KEY = 'openStreamPlayerFavorites';
const PLAYLIST_TIMEOUT_MS = 30000;
const EPG_TIMEOUT_MS = 20000;

const initialLoadingProgress = {
  message: 'Preparing playlist request',
  detail: 'Checking your saved source and starting the connection.',
  elapsedSeconds: 0,
  startedAt: null,
};

function App() {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(initialLoadingProgress);
  const [epgLoading, setEpgLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    } catch (err) {
      return [];
    }
  });

  useEffect(() => {
    const stored = localStorage.getItem('streamPlayerConfig');
    if (stored) {
      setConfig(JSON.parse(stored));
      fetchPlaylist(JSON.parse(stored));
      fetchEPG(JSON.parse(stored));
    } else {
      fetchPlaylist();
      fetchEPG();
    }
    // Load saved configuration once on startup; settings saves trigger their own refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading || !loadingProgress.startedAt) return undefined;

    const timer = window.setInterval(() => {
      setLoadingProgress((current) => ({
        ...current,
        elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000),
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading, loadingProgress.startedAt]);

  const getM3uUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_M3U_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/get.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}&type=m3u_plus&output=mpegts`;
    }
    return cfg.m3uUrl || process.env.REACT_APP_M3U_URL;
  };

  const getEpgUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_EPG_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/xmltv.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}`;
    }
    return cfg.epgUrl || process.env.REACT_APP_EPG_URL;
  };

  const fetchPlaylist = async (cfg = null) => {
    try {
      setLoading(true);
      setError(null);
      setLoadingProgress({
        message: 'Connecting to playlist',
        detail: 'Requesting your M3U channel list. Slow providers can take a few seconds.',
        elapsedSeconds: 0,
        startedAt: Date.now(),
      });
      const m3uUrl = getM3uUrl(cfg);
      if (!m3uUrl) throw new Error('No M3U URL configured');

      let m3uContent;

      if (window.electronAPI) {
        m3uContent = await window.electronAPI.fetchM3U(m3uUrl);
      } else {
        const response = await axios.get(m3uUrl, { timeout: PLAYLIST_TIMEOUT_MS });
        m3uContent = response.data;
      }

      setLoadingProgress((current) => ({
        ...current,
        message: 'Parsing channels',
        detail: 'Reading channel names, groups, logos, and stream URLs.',
      }));
      const parsed = parseM3U(m3uContent);
      setChannels(parsed);
      if (parsed.length > 0) {
        setSelectedChannel((current) => {
          if (current) {
            const match = parsed.find((channel) => getChannelKey(channel) === getChannelKey(current));
            if (match) return match;
          }
          return parsed[0];
        });
      } else {
        setSelectedChannel(null);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load playlist: ' + getFriendlyError(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEPG = async (cfg = null) => {
    try {
      setEpgLoading(true);
      const epgUrl = getEpgUrl(cfg);
      if (!epgUrl) {
        console.log('No EPG URL configured');
        return;
      }

      let epgContent;

      if (window.electronAPI) {
        epgContent = await window.electronAPI.fetchEPG(epgUrl);
      } else {
        const response = await axios.get(epgUrl, { timeout: EPG_TIMEOUT_MS });
        epgContent = response.data;
      }

      const parsed = parseEPG(epgContent);
      setEpgData(parsed);
    } catch (err) {
      console.error('Failed to load EPG:', err);
    } finally {
      setEpgLoading(false);
    }
  };

  const getFriendlyError = (err) => {
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
      return 'The playlist server did not respond within 30 seconds. Check the URL or try again.';
    }

    if (/No M3U URL configured/i.test(err?.message || '')) {
      return 'No M3U URL configured. Open Settings and add your playlist or Xtream details.';
    }

    return err?.message || 'Unknown error';
  };

  const getChannelKey = (channel) => `${channel.name}|${channel.group}|${channel.url}`;

  const isFavorite = (channel) => channel && favorites.includes(getChannelKey(channel));

  const toggleFavorite = (channel) => {
    if (!channel) return;

    const key = getChannelKey(channel);
    setFavorites((current) => {
      const next = current.includes(key)
        ? current.filter((favorite) => favorite !== key)
        : [...current, key];

      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const parseM3U = (content) => {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#EXTINF:')) {
        const match = line.match(/,(.+)$/);
        const nameMatch = line.match(/tvg-name="([^"]+)"/);
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);

        currentChannel = {
          name: nameMatch ? nameMatch[1] : (match ? match[1] : 'Unknown'),
          logo: logoMatch ? logoMatch[1] : '',
          group: groupMatch ? groupMatch[1] : 'Other',
          url: '',
        };
      } else if (line && !line.startsWith('#') && currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
    return channels;
  };

  const parseEPG = (xmlContent) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const epg = {};

    const programmes = xmlDoc.querySelectorAll('programme');
    programmes.forEach((prog) => {
      const channel = prog.getAttribute('channel');
      const start = prog.getAttribute('start');
      const stop = prog.getAttribute('stop');
      const titleElem = prog.querySelector('title');
      const descElem = prog.querySelector('desc');

      if (!epg[channel]) epg[channel] = [];
      epg[channel].push({
        start,
        stop,
        title: titleElem ? titleElem.textContent : 'N/A',
        description: descElem ? descElem.textContent : '',
      });
    });

    return epg;
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">OS</div>
          <div>
            <h1>OpenStreamPlayer</h1>
            <p>{channels.length ? `${channels.length} channels loaded` : 'Open IPTV player'}</p>
          </div>
        </div>
        <div className="header-buttons">
          <button onClick={() => setSettingsOpen(true)} className="btn btn-secondary">
            Settings
          </button>
          <button onClick={() => fetchPlaylist()} disabled={loading} className="btn btn-primary">
            {loading ? <span className="mini-spinner" /> : null}
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </header>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(cfg) => {
          setConfig(cfg);
          setSettingsOpen(false);
          fetchPlaylist(cfg);
          fetchEPG(cfg);
        }}
      />

      {error && <div className="error-banner">{error}</div>}

      <div className="app-container">
        <div className="player-section">
          {loading && channels.length === 0 ? (
            <div className="state-panel loading-panel">
              <div className="spinner" />
              <div>
                <h2>Loading playlist</h2>
                <p>{loadingProgress.message}</p>
              </div>
              <div className="loading-progress">
                <div className="progress-track">
                  <div className="progress-bar" />
                </div>
                <div className="progress-meta">
                  <span>{loadingProgress.detail}</span>
                  <strong>{loadingProgress.elapsedSeconds}s</strong>
                </div>
              </div>
            </div>
          ) : selectedChannel ? (
            <>
              <VideoPlayer
                channel={selectedChannel}
                isFavorite={isFavorite(selectedChannel)}
                onToggleFavorite={() => toggleFavorite(selectedChannel)}
              />
              <EPGGuide channel={selectedChannel} epgData={epgData} loading={epgLoading} />
            </>
          ) : (
            <div className={`state-panel ${error ? 'error-panel' : 'empty-panel'}`}>
              <h2>{error ? 'Playlist did not load' : 'Add a playlist to start watching'}</h2>
              <p>{error || 'Open Settings, add your M3U or Xtream details, and your channels will appear here.'}</p>
              <div className="state-actions">
                <button className="btn btn-primary" onClick={() => fetchPlaylist()}>
                  Try Again
                </button>
                <button className="btn btn-secondary" onClick={() => setSettingsOpen(true)}>
                  Open Settings
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelect={setSelectedChannel}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            loading={loading}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
