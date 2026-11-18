let audioElement: HTMLAudioElement | null = null;

export function registerAudioElement(element: HTMLAudioElement | null) {
  audioElement = element;
}

export function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  return audioElement;
}
