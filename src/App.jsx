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
const JSON_TIMEOUT_MS = 30000;
const PLAYER_HEADERS = {
  'User-Agent': 'IPTVSmartersPro',
  Accept: 'application/json,text/plain,*/*',
};

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
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('streamPlayerConfig') || 'null');
    } catch (err) {
      return null;
    }
  });
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

  useEffect(() => {
    if (!selectedChannel?.streamId || !canUseXtreamApi(config)) return;

    const key = selectedChannel.epgId || selectedChannel.name;
    if (epgData[key]?.length) return;

    fetchXtreamChannelEpg(selectedChannel, config);
    // Fetch guide data lazily when the user selects a channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, config]);

  const getM3uUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_M3U_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/get.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}&type=m3u_plus&output=mpegts`;
    }
    return cfg.m3uUrl || process.env.REACT_APP_M3U_URL;
  };

  const getXtreamBaseUrl = (cfg) => (cfg?.xtreamServer || '').replace(/\/+$/, '');

  const getXtreamApiUrl = (cfg, action = '', extraParams = {}) => {
    const baseUrl = getXtreamBaseUrl(cfg);
    const params = new URLSearchParams({
      username: cfg.xtreamUser,
      password: cfg.xtreamPass,
    });

    if (action) params.set('action', action);
    Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
    return `${baseUrl}/player_api.php?${params.toString()}`;
  };

  const canUseXtreamApi = (cfg) => (
    cfg?.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass
  );

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
        message: canUseXtreamApi(cfg || config) ? 'Connecting to Xtream API' : 'Connecting to playlist',
        detail: canUseXtreamApi(cfg || config)
          ? 'Requesting your provider catalog with player-compatible headers.'
          : 'Requesting your M3U channel list. Slow providers can take a few seconds.',
        elapsedSeconds: 0,
        startedAt: Date.now(),
      });

      const parsed = canUseXtreamApi(cfg || config)
        ? await fetchXtreamChannels(cfg || config)
        : await fetchM3UChannels(cfg);

      setLoadingProgress((current) => ({
        ...current,
        message: 'Parsing channels',
        detail: 'Reading channel names, groups, logos, and stream URLs.',
      }));
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

  const fetchM3UChannels = async (cfg = null) => {
    const m3uUrl = getM3uUrl(cfg);
    if (!m3uUrl) throw new Error('No M3U URL configured');

    let m3uContent;

    if (window.electronAPI) {
      m3uContent = await window.electronAPI.fetchM3U(m3uUrl);
    } else {
      const response = await axios.get(m3uUrl, {
        timeout: PLAYLIST_TIMEOUT_MS,
        headers: PLAYER_HEADERS,
      });
      m3uContent = response.data;
    }

    return parseM3U(m3uContent);
  };

  const fetchXtreamChannels = async (cfg) => {
    setLoadingProgress((current) => ({
      ...current,
      message: 'Checking account',
      detail: 'Verifying the provider login before loading streams.',
    }));

    const account = await fetchJSON(getXtreamApiUrl(cfg));
    if (account?.user_info?.auth !== 1 && account?.user_info?.auth !== '1') {
      throw new Error('Xtream login was rejected. Check your server, username, and password.');
    }

    setLoadingProgress((current) => ({
      ...current,
      message: 'Loading categories',
      detail: 'Fetching channel groups from the provider catalog.',
    }));
    const categories = await fetchJSON(getXtreamApiUrl(cfg, 'get_live_categories'));
    const categoryMap = new Map(
      (Array.isArray(categories) ? categories : []).map((category) => [
        String(category.category_id),
        category.category_name || 'Other',
      ])
    );

    setLoadingProgress((current) => ({
      ...current,
      message: 'Loading live channels',
      detail: 'Downloading the live stream catalog. Large accounts can take several seconds.',
    }));
    const streams = await fetchJSON(getXtreamApiUrl(cfg, 'get_live_streams'));
    if (!Array.isArray(streams)) throw new Error('Provider did not return a valid live channel list.');

    const baseUrl = getXtreamBaseUrl(cfg);
    return streams
      .filter((stream) => stream.stream_id && stream.name && !isXtreamDivider(stream.name))
      .map((stream) => {
        return {
          name: stream.name,
          logo: stream.stream_icon || '',
          group: categoryMap.get(String(stream.category_id)) || 'Other',
          epgId: stream.epg_channel_id || stream.name,
          epgAliases: uniqueValues([
            stream.epg_channel_id,
            stream.name,
            stripChannelQuality(stream.name),
            stripChannelPrefix(stripChannelQuality(stream.name)),
          ]),
          streamId: stream.stream_id,
          url: `${baseUrl}/live/${cfg.xtreamUser}/${cfg.xtreamPass}/${stream.stream_id}.m3u8`,
        };
      });
  };

  const fetchXtreamChannelEpg = async (channel, cfg) => {
    try {
      setEpgLoading(true);
      const response = await fetchJSON(getXtreamApiUrl(cfg, 'get_short_epg', {
        stream_id: channel.streamId,
        limit: 6,
      }));
      const listings = Array.isArray(response?.epg_listings) ? response.epg_listings : [];
      if (!listings.length) return;

      const programs = listings.map((item) => ({
        start: item.start,
        stop: item.end,
        title: decodeBase64Text(item.title) || 'N/A',
        description: decodeBase64Text(item.description),
      }));
      const guideKeys = getGuideKeys(channel);
      setEpgData((current) => ({
        ...current,
        ...Object.fromEntries(guideKeys.map((key) => [key, programs])),
      }));
    } catch (err) {
      console.error('Failed to load Xtream channel EPG:', err);
    } finally {
      setEpgLoading(false);
    }
  };

  const decodeBase64Text = (value) => {
    if (!value) return '';

    try {
      return decodeURIComponent(escape(window.atob(value)));
    } catch (err) {
      try {
        return window.atob(value);
      } catch (fallbackErr) {
        return value;
      }
    }
  };

  const isXtreamDivider = (name) => /^\s*#{3,}.*#{3,}\s*$/.test(name);

  const stripChannelQuality = (name) => String(name || '')
    .replace(/\s*[([]?\b(?:FHD|UHD|HD|SD|HEVC|4K|8K)\b[)\]]?\s*$/i, '')
    .replace(/\s+◉\s*$/u, '')
    .trim();

  const stripChannelPrefix = (name) => String(name || '').replace(/^\s*[A-Z]{2,4}\s*[-|]\s*/i, '').trim();

  const fetchJSON = async (url) => {
    if (window.electronAPI?.fetchJSON) return window.electronAPI.fetchJSON(url);

    const response = await axios.get(url, {
      timeout: JSON_TIMEOUT_MS,
      headers: PLAYER_HEADERS,
    });
    return response.data;
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
        const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : (match ? match[1] : 'Unknown');

        currentChannel = {
          name,
          logo: logoMatch ? logoMatch[1] : '',
          group: groupMatch ? groupMatch[1] : 'Other',
          epgId: tvgIdMatch ? tvgIdMatch[1] : name,
          epgAliases: uniqueValues([tvgIdMatch?.[1], name, stripChannelQuality(name), stripChannelPrefix(stripChannelQuality(name))]),
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
    const channelAliases = {};

    xmlDoc.querySelectorAll('channel').forEach((channelElem) => {
      const id = channelElem.getAttribute('id');
      if (!id) return;

      const displayNames = Array.from(channelElem.querySelectorAll('display-name'))
        .map((displayName) => displayName.textContent?.trim())
        .filter(Boolean);

      channelAliases[id] = uniqueValues([
        id,
        normalizeGuideKey(id),
        ...displayNames,
        ...displayNames.map(stripChannelQuality),
        ...displayNames.map((name) => stripChannelPrefix(stripChannelQuality(name))),
        ...displayNames.map(normalizeGuideKey),
      ]);
    });

    const addPrograms = (keys, program) => {
      uniqueValues(keys).forEach((key) => {
        if (!key) return;
        if (!epg[key]) epg[key] = [];
        epg[key].push(program);
      });
    };

    const programmes = xmlDoc.querySelectorAll('programme');
    programmes.forEach((prog) => {
      const channel = prog.getAttribute('channel');
      const start = prog.getAttribute('start');
      const stop = prog.getAttribute('stop');
      const titleElem = prog.querySelector('title');
      const descElem = prog.querySelector('desc');

      const program = {
        start,
        stop,
        title: titleElem ? titleElem.textContent : 'N/A',
        description: descElem ? descElem.textContent : '',
      };

      addPrograms([
        channel,
        normalizeGuideKey(channel),
        ...(channelAliases[channel] || []),
      ], program);
    });

    return epg;
  };

  return (
    <div className={`app font-${config?.fontSize || 'compact'}`}>
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
