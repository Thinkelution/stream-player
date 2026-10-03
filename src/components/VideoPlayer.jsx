import React, { useEffect, useRef, useState } from 'react';
import HLS from 'hls.js';

function VideoPlayer({ channel, isFavorite, onToggleFavorite }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);

  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    const url = channel.url;
    setIsBuffering(true);
    setPlaybackError(null);

    if (HLS.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      hlsRef.current = new HLS();
      hlsRef.current.loadSource(url);
      hlsRef.current.attachMedia(video);

      hlsRef.current.on(HLS.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          setIsBuffering(false);
        });
      });

      hlsRef.current.on(HLS.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          setPlaybackError('Unable to play this stream. Try another channel or refresh the playlist.');
          setIsBuffering(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {
        setIsBuffering(false);
      });
    } else {
      setPlaybackError('This stream format is not supported on this device.');
      setIsBuffering(false);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [channel]);

  return (
    <div className="video-player">
      <div className="player-header">
        <div className="now-playing">
          <div className="channel-logo-large">
            {channel.logo ? <img src={channel.logo} alt="" /> : <span>{channel.name.charAt(0)}</span>}
          </div>
          <div>
            <span className="eyebrow">Now playing</span>
            <h2>{channel.name}</h2>
            <p>{channel.group}</p>
          </div>
        </div>
        <button
          className={`favorite-action ${isFavorite ? 'active' : ''}`}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★ Favorite' : '☆ Add Favorite'}
        </button>
      </div>
      <div className="video-shell">
        {isBuffering && (
          <div className="video-overlay">
            <div className="spinner" />
            <span>Starting stream</span>
          </div>
        )}
        {playbackError && (
          <div className="video-overlay error-overlay">
            <strong>Playback issue</strong>
            <span>{playbackError}</span>
          </div>
        )}
        <video
          ref={videoRef}
          controls
          autoPlay
          onCanPlay={() => setIsBuffering(false)}
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onError={() => {
            setPlaybackError('Unable to play this stream. Try another channel or refresh the playlist.');
            setIsBuffering(false);
          }}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
