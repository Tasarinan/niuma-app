import { useState, useCallback, useRef } from "react";

export interface UseTTSReturn {
  isEnabled: boolean;
  isSpeaking: boolean;
  toggle: () => void;
  speak: (text: string) => void;
  stop: () => void;
}

/**
 * Text-to-Speech using the browser's built-in Web Speech API.
 * Zero-dependency, zero-token. Works offline.
 */
export function useTTS(): UseTTSReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!text.trim()) return;

      // Stop any current speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isEnabled]
  );

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) {
        // Disabling — stop any active speech
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
      }
      return !prev;
    });
  }, []);

  return { isEnabled, isSpeaking, toggle, speak, stop };
}
