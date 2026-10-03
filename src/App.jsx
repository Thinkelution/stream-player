import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import ChannelList from './components/ChannelList';
import VideoPlayer from './components/VideoPlayer';
import EPGGuide from './components/EPGGuide';
import Settings from './components/Settings';

const FAVORITES_STORAGE_KEY = 'openStreamPlayerFavorites';
const DEFAULT_EPG_URL = '';
const DEFAULT_CONFIG = {
  configMode: 'm3u',
  m3uUrl: '',
  epgUrl: DEFAULT_EPG_URL,
  fontSize: 'compact',
};
const PLAYLIST_TIMEOUT_MS = 60000;
const EPG_TIMEOUT_MS = 20000;
const JSON_TIMEOUT_MS = 60000;
const PLAYLIST_CACHE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const PLAYLIST_CACHE_STORAGE_KEY = 'openStreamPlayerPlaylistCache';
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


const parseGuideDate = (value) => {
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

const formatGuideTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getCurrentProgramsForChannel = (channel, epgData, limit = 4) => {
  if (!channel) return [];

  const programs = getGuideKeys(channel)
    .map((key) => epgData[key])
    .find((items) => Array.isArray(items) && items.length) || [];
  if (!programs.length) return [];

  const now = new Date();

  return programs
    .map((prog) => ({
      ...prog,
      startDate: parseGuideDate(prog.start),
      stopDate: parseGuideDate(prog.stop),
    }))
    .filter((prog) => prog.stopDate >= now)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, limit)
    .map((prog) => {
      const isCurrent = prog.startDate <= now && prog.stopDate >= now;
      return {
        ...prog,
        label: isCurrent ? 'Now' : formatGuideTime(prog.startDate),
      };
    });
};

const initialLoadingProgress = {
  message: 'Preparing playlist request',
  detail: 'Checking your saved source and starting the connection.',
  elapsedSeconds: 0,
  startedAt: null,
};

function App() {
  const [channels, setChannels] = useState([]);
  const [activeChannels, setActiveChannels] = useState([]);
  const [activeChannelListLabel, setActiveChannelListLabel] = useState('Channels');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(initialLoadingProgress);
  const [epgLoading, setEpgLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('streamPlayerConfig') || 'null') || DEFAULT_CONFIG;
    } catch (err) {
      return DEFAULT_CONFIG;
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    } catch (err) {
      return [];
    }
  });


  const fullscreenPrograms = useMemo(
    () => getCurrentProgramsForChannel(selectedChannel, epgData, 2),
    [selectedChannel, epgData]
  );

  const getCurrentProgramTitleForChannel = useCallback((channel) => {
    if ((channel?.contentType || 'live') !== 'live') return '';
    const currentProgram = getCurrentProgramsForChannel(channel, epgData, 1)[0];
    return currentProgram?.label === 'Now' ? currentProgram.title : '';
  }, [epgData]);

  const handleVisibleChannelsChange = useCallback((visibleChannels, label) => {
    setActiveChannels(visibleChannels);
    setActiveChannelListLabel(label || 'Channels');
  }, []);

  useEffect(() => {
    const boot = async () => {
      const stored = localStorage.getItem('streamPlayerConfig');
      const startupConfig = stored ? JSON.parse(stored) : config;
      if (stored) setConfig(startupConfig);

      if (!hasConfiguredSource(startupConfig)) {
        setLoading(false);
        setError(null);
        return;
      }

      const cachedChannels = await loadCachedPlaylist(startupConfig);
      if (cachedChannels?.length) {
        setChannels(cachedChannels);
        setSelectedChannel((current) => current || cachedChannels[0]);
        setLoading(false);
        setError(null);
        fetchEPG(startupConfig);
        return;
      }

      fetchPlaylist(startupConfig, { manual: false });
      fetchEPG(startupConfig);
    };

    boot().catch((err) => {
      console.error(err);
      if (hasConfiguredSource(config)) {
        fetchPlaylist(config, { manual: false });
        fetchEPG(config);
      } else {
        setLoading(false);
      }
    });
    // Load saved configuration once on startup; settings saves and Refresh force their own reload.
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


  const hasConfiguredSource = (cfg = config) => {
    if (!cfg) return Boolean(process.env.REACT_APP_M3U_URL);
    if (cfg.configMode === 'xtream') {
      return Boolean(cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass);
    }
    return Boolean(cfg.m3uUrl || process.env.REACT_APP_M3U_URL);
  };

  const getM3uUrl = (cfg) => {
    if (!cfg) cfg = config;
    if (!cfg) return process.env.REACT_APP_M3U_URL || '';

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/get.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}&type=m3u_plus&output=mpegts`;
    }
    return cfg.m3uUrl || process.env.REACT_APP_M3U_URL || '';
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
    if (!cfg) return process.env.REACT_APP_EPG_URL || DEFAULT_EPG_URL;

    if (cfg.configMode === 'xtream' && cfg.xtreamServer && cfg.xtreamUser && cfg.xtreamPass) {
      return `${cfg.xtreamServer}/xmltv.php?username=${cfg.xtreamUser}&password=${cfg.xtreamPass}`;
    }
    return cfg.epgUrl || process.env.REACT_APP_EPG_URL || DEFAULT_EPG_URL;
  };

  const getPlaylistCacheKey = (cfg = config) => JSON.stringify({
    mode: cfg?.configMode || 'm3u',
    m3uUrl: cfg?.m3uUrl || '',
    xtreamServer: getXtreamBaseUrl(cfg),
    xtreamUser: cfg?.xtreamUser || '',
  });

  const readPlaylistCache = async () => {
    if (window.electronAPI?.getPlaylistCache) return window.electronAPI.getPlaylistCache();

    try {
      return JSON.parse(localStorage.getItem(PLAYLIST_CACHE_STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  };

  const writePlaylistCache = async (cache) => {
    if (window.electronAPI?.setPlaylistCache) return window.electronAPI.setPlaylistCache(cache);

    try {
      localStorage.setItem(PLAYLIST_CACHE_STORAGE_KEY, JSON.stringify(cache));
      return true;
    } catch (err) {
      console.warn('Unable to write playlist cache:', err);
      return false;
    }
  };

  const loadCachedPlaylist = async (cfg = config) => {
    const cache = await readPlaylistCache();
    if (!cache?.channels?.length) return null;
    if (cache.cacheKey !== getPlaylistCacheKey(cfg)) return null;
    if (Date.now() - Number(cache.savedAt || 0) > PLAYLIST_CACHE_MAX_AGE_MS) return null;

    setLoadingProgress({
      message: 'Using saved playlist',
      detail: 'OpenStreamPlayer will refresh automatically every 2 days, or immediately when you press Refresh.',
      elapsedSeconds: 0,
      startedAt: null,
    });
    return cache.channels;
  };

  const savePlaylistCache = async (cfg, parsedChannels) => {
    if (!parsedChannels?.length) return;
    await writePlaylistCache({
      cacheKey: getPlaylistCacheKey(cfg),
      savedAt: Date.now(),
      channels: parsedChannels,
    });
  };

  const fetchPlaylist = async (cfg = null, options = { manual: true }) => {
    try {
      setLoading(true);
      setError(null);
      const effectiveConfig = cfg || config;
      setLoadingProgress({
        message: canUseXtreamApi(effectiveConfig) ? 'Connecting to Xtream API' : 'Connecting to playlist',
        detail: options.manual
          ? 'Refreshing from the provider now.'
          : 'No saved playlist under 2 days old was found, so OpenStreamPlayer is refreshing once.',
        elapsedSeconds: 0,
        startedAt: Date.now(),
      });

      const parsed = canUseXtreamApi(effectiveConfig)
        ? await fetchXtreamChannels(effectiveConfig)
        : await fetchM3UChannels(effectiveConfig);

      setLoadingProgress((current) => ({
        ...current,
        message: 'Parsing channels',
        detail: 'Reading channel names, groups, logos, and stream URLs.',
      }));
      setChannels(parsed);
      await savePlaylistCache(effectiveConfig, parsed);
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

  const buildCategoryMap = (categories) => new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [
      String(category.category_id),
      category.category_name || 'Other',
    ])
  );

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
      detail: 'Fetching live, movie, and series groups from the provider catalog.',
    }));
    const liveCategories = await fetchJSON(getXtreamApiUrl(cfg, 'get_live_categories'));
    const vodCategories = await fetchJSON(getXtreamApiUrl(cfg, 'get_vod_categories')).catch(() => []);
    const seriesCategories = await fetchJSON(getXtreamApiUrl(cfg, 'get_series_categories')).catch(() => []);
    const liveCategoryMap = buildCategoryMap(liveCategories);
    const vodCategoryMap = buildCategoryMap(vodCategories);
    const seriesCategoryMap = buildCategoryMap(seriesCategories);

    setLoadingProgress((current) => ({
      ...current,
      message: 'Loading library',
      detail: 'Downloading live channels, movies, and series from the provider catalog.',
    }));
    const streams = await fetchJSON(getXtreamApiUrl(cfg, 'get_live_streams'));
    if (!Array.isArray(streams)) throw new Error('Provider did not return a valid live channel list.');

    const vodStreams = await fetchJSON(getXtreamApiUrl(cfg, 'get_vod_streams')).catch(() => []);
    const seriesStreams = await fetchJSON(getXtreamApiUrl(cfg, 'get_series')).catch(() => []);
    const baseUrl = getXtreamBaseUrl(cfg);

    const liveItems = streams
      .filter((stream) => stream.stream_id && stream.name && !isXtreamDivider(stream.name))
      .map((stream) => ({
        name: stream.name,
        logo: stream.stream_icon || '',
        group: liveCategoryMap.get(String(stream.category_id)) || 'Other',
        contentType: 'live',
        epgId: stream.epg_channel_id || stream.name,
        epgAliases: uniqueValues([
          stream.epg_channel_id,
          stream.name,
          stripChannelQuality(stream.name),
          stripChannelPrefix(stripChannelQuality(stream.name)),
        ]),
        streamId: stream.stream_id,
        url: `${baseUrl}/live/${cfg.xtreamUser}/${cfg.xtreamPass}/${stream.stream_id}.m3u8`,
      }));

    const movieItems = (Array.isArray(vodStreams) ? vodStreams : [])
      .filter((stream) => stream.stream_id && stream.name)
      .map((stream) => ({
        name: stream.name,
        logo: stream.stream_icon || '',
        group: vodCategoryMap.get(String(stream.category_id)) || 'Movies',
        contentType: 'movie',
        streamId: stream.stream_id,
        url: `${baseUrl}/movie/${cfg.xtreamUser}/${cfg.xtreamPass}/${stream.stream_id}.${stream.container_extension || 'mp4'}`,
      }));

    const seriesItems = (Array.isArray(seriesStreams) ? seriesStreams : [])
      .filter((series) => series.series_id && series.name)
      .map((series) => ({
        name: series.name,
        logo: series.cover || series.stream_icon || '',
        group: seriesCategoryMap.get(String(series.category_id)) || 'Series',
        contentType: 'series',
        seriesId: series.series_id,
        url: '',
      }));

    const apiItems = [...liveItems, ...movieItems, ...seriesItems];

    if (liveItems.length > 0 && movieItems.length === 0 && seriesItems.length === 0) {
      try {
        setLoadingProgress((current) => ({
          ...current,
          message: 'Loading full playlist fallback',
          detail: 'The Xtream catalog returned live channels only, so OpenStreamPlayer is loading the full M3U to recover movies and series.',
        }));
        const playlistItems = await fetchM3UChannels(cfg);
        if (playlistItems.length > apiItems.length) return playlistItems;
      } catch (fallbackErr) {
        console.warn('Full Xtream playlist fallback failed:', fallbackErr);
      }
    }

    return apiItems;
  };

  const resolvePlayableChannel = async (channel, cfg = config) => {
    if (channel?.contentType !== 'series' || channel.url || !canUseXtreamApi(cfg)) return channel;

    const info = await fetchJSON(getXtreamApiUrl(cfg, 'get_series_info', { series_id: channel.seriesId }));
    const seasons = Object.values(info?.episodes || {}).flat();
    const episode = seasons.find((item) => item?.id);
    if (!episode) throw new Error('No playable episodes were returned for this series.');

    const baseUrl = getXtreamBaseUrl(cfg);
    return {
      ...channel,
      name: `${channel.name} · S${episode.season || '?'} E${episode.episode_num || '?'}`,
      episodeTitle: episode.title || channel.name,
      url: `${baseUrl}/series/${cfg.xtreamUser}/${cfg.xtreamPass}/${episode.id}.${episode.container_extension || 'mp4'}`,
    };
  };

  const handleSelectChannel = async (channel) => {
    try {
      setError(null);
      setSelectedChannel(await resolvePlayableChannel(channel));
    } catch (err) {
      setError('Failed to load series: ' + getFriendlyError(err));
    }
  };


  useEffect(() => {
    const handleChannelKeydown = (event) => {
      const navigationChannels = activeChannels.length ? activeChannels : channels;
      if (settingsOpen || !navigationChannels.length || !selectedChannel) return;
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;

      const target = event.target;
      const isTyping = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable;
      if (isTyping) return;

      event.preventDefault();
      const selectedKey = getChannelKey(selectedChannel);
      const currentIndex = navigationChannels.findIndex((item) => getChannelKey(item) === selectedKey);
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(navigationChannels.length - 1, safeIndex + 1)
        : Math.max(0, safeIndex - 1);

      if (nextIndex !== safeIndex) handleSelectChannel(navigationChannels[nextIndex]);
    };

    window.addEventListener('keydown', handleChannelKeydown);
    return () => window.removeEventListener('keydown', handleChannelKeydown);
    // Arrow keys should follow the current loaded channel list while ignoring text fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, activeChannels, selectedChannel, settingsOpen]);

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

  const inferContentTypeFromUrl = (url, group = '') => {
    const source = `${url || ''} ${group || ''}`.toLowerCase();
    if (/\/series\//.test(source) || /\bseries\b/.test(source)) return 'series';
    if (/\/movie\//.test(source) || /\b(?:movie|movies|vod|film|films)\b/.test(source)) return 'movie';
    return 'live';
  };

  const fetchJSON = async (url, timeoutMs = JSON_TIMEOUT_MS) => {
    if (window.electronAPI?.fetchJSON) return window.electronAPI.fetchJSON(url, { timeout: timeoutMs });

    const response = await axios.get(url, {
      timeout: timeoutMs,
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

  const getChannelKey = (channel) => `${channel.name}|${channel.group}|${channel.contentType || 'live'}|${channel.streamId || channel.seriesId || channel.url}`;

  const getLegacyChannelKey = (channel) => `${channel.name}|${channel.group}|${channel.url}`;

  const getFavoriteKeys = (channel) => uniqueValues([
    getChannelKey(channel),
    getLegacyChannelKey(channel),
  ]);

  const isFavorite = (channel) => channel && getFavoriteKeys(channel).some((key) => favorites.includes(key));

  useEffect(() => {
    if (!channels.length || !favorites.length) return;

    setFavorites((current) => {
      const saved = new Set(current);
      const matchedLegacyKeys = new Set();
      const migrated = [];

      channels.forEach((channel) => {
        const canonicalKey = getChannelKey(channel);
        const keys = getFavoriteKeys(channel);
        if (keys.some((key) => saved.has(key))) {
          migrated.push(canonicalKey);
          keys.forEach((key) => matchedLegacyKeys.add(key));
        }
      });

      const untouched = current.filter((key) => !matchedLegacyKeys.has(key));
      const next = uniqueValues([...untouched, ...migrated]);
      if (next.length === current.length && next.every((key, index) => key === current[index])) return current;

      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    // Reconcile old favorites keys after a playlist is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  const toggleFavorite = (channel) => {
    if (!channel) return;

    const canonicalKey = getChannelKey(channel);
    const matchingKeys = new Set(getFavoriteKeys(channel));
    setFavorites((current) => {
      const alreadyFavorite = current.some((favorite) => matchingKeys.has(favorite));
      const next = alreadyFavorite
        ? current.filter((favorite) => !matchingKeys.has(favorite))
        : uniqueValues([...current, canonicalKey]);

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
        currentChannel.contentType = inferContentTypeFromUrl(line, currentChannel.group);
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
            <p>{channels.length ? `${channels.length} items loaded` : 'Open IPTV player'}</p>
          </div>
        </div>
        <div className="header-buttons">
          <button onClick={() => setSettingsOpen(true)} className="btn btn-secondary">
            Settings
          </button>
          <button
            onClick={() => (hasConfiguredSource(config) ? fetchPlaylist(config, { manual: true }) : setSettingsOpen(true))}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? <span className="mini-spinner" /> : null}
            {loading ? 'Loading' : hasConfiguredSource(config) ? 'Refresh' : 'Add Playlist'}
          </button>
        </div>
      </header>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(cfg) => {
          setConfig(cfg);
          setSettingsOpen(false);
          fetchPlaylist(cfg, { manual: true });
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
                channels={activeChannels.length ? activeChannels : channels}
                channelListLabel={activeChannelListLabel}
                fullscreenPrograms={fullscreenPrograms}
                selectedChannel={selectedChannel}
                onSelectChannel={handleSelectChannel}
                getChannelKey={getChannelKey}
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
                {hasConfiguredSource(config) ? (
                  <button className="btn btn-primary" onClick={() => fetchPlaylist(config, { manual: true })}>
                    Try Again
                  </button>
                ) : null}
                <button className="btn btn-primary" onClick={() => setSettingsOpen(true)}>
                  Add Playlist
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="sidebar">
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelect={handleSelectChannel}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            loading={loading}
            getFavoriteKeys={getFavoriteKeys}
            getCurrentProgramTitle={getCurrentProgramTitleForChannel}
            onVisibleChannelsChange={handleVisibleChannelsChange}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
