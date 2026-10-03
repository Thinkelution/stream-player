import React, { useEffect, useRef } from 'react';
import HLS from 'hls.js';

function VideoPlayer({ channel }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    const url = channel.url;

    if (HLS.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      hlsRef.current = new HLS();
      hlsRef.current.loadSource(url);
      hlsRef.current.attachMedia(video);

      hlsRef.current.on(HLS.Events.MANIFEST_PARSED, () => {
        video.play();
      });

      hlsRef.current.on(HLS.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play();
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [channel]);

  return (
    <div className="video-player">
      <div className="player-header">
        {channel.logo && <img src={channel.logo} alt={channel.name} className="channel-logo" />}
        <h2>{channel.name}</h2>
      </div>
      <video
        ref={videoRef}
        controls
        autoPlay
        style={{
          width: '100%',
          height: '500px',
          backgroundColor: '#000',
          borderRadius: '8px',
        }}
      />
    </div>
  );
}

export default VideoPlayer;
