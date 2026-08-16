"use client";

import * as React from "react";

/**
 * Voice, without breaking the single-key constraint.
 *
 * The challenge requires the app to run on one Anthropic key, so any hosted
 * STT/TTS API is off the table. The browser's own Web Speech API needs no key:
 * dictation (SpeechRecognition) fills the composer, synthesis (speechSynthesis)
 * reads an answer back. Both are feature-detected — browsers without them
 * simply never show the buttons, and nothing else changes.
 */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Push-to-talk dictation. `onText` receives the full transcript so far each
 * time it grows; the caller decides how to merge it into its input state.
 */
export function useDictation(onText: (transcript: string, isFinal: boolean) => void) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<RecognitionLike | null>(null);
  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;

  React.useEffect(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const results = Array.from(event.results as ArrayLike<RecognitionResultLike>);
      const transcript = results.map((r) => r[0].transcript).join("");
      const isFinal = results.length > 0 && results[results.length - 1].isFinal;
      onTextRef.current(transcript, isFinal);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => rec.abort();
  }, []);

  const toggle = React.useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        // start() throws if a session is already active; treat as a no-op.
      }
    }
  }, [listening]);

  return { supported, listening, toggle };
}

/**
 * Markdown reads badly aloud. Keep the words, drop the notation, and skip
 * citations entirely — they are a visual affordance, not speech.
 */
export function stripForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\((?:p\.\s*\d+(?:,\s*p\.\s*\d+)*|Quick Start p\.\s*\d|Selection Chart)\)/g, "")
    .replace(/\bp\.\s*(\d{1,2})\b/g, "page $1")
    .replace(/[*_#`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Read one answer aloud; starting a new one (or unmounting) stops the last. */
export function useSpeech() {
  const [supported, setSupported] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) setSupported(true);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggle = React.useCallback(
    (text: string) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      if (speaking) {
        synth.cancel();
        setSpeaking(false);
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
      utterance.rate = 1.05;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      synth.speak(utterance);
      setSpeaking(true);
    },
    [supported, speaking],
  );

  return { supported, speaking, toggle };
}
