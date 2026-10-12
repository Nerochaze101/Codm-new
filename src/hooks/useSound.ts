import { useEffect, useRef } from 'react';

export const useSound = (url: string) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Attempt to load the audio file
    audioRef.current = new Audio(url);
  }, [url]);

  const play = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      // Handle play promise to avoid errors in some browsers
      audioRef.current.play().catch(e => console.error("Audio playback failed", e));
    }
  };

  return play;
};
