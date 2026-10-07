"use client";

/**
 * Sprint Soundtrack — MVP de Retrospectiva Ágil Musical
 * Next.js App Router + Tailwind + Lucide + Tone.js
 *
 * Mapeo: 7 respuestas Likert → 7 grados diatónicos → progresión de acordes
 * Teoría: modos griegos + dimensiones emocionales (Mauro de María)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Music2,
  Play,
  Square,
  Volume2,
  Sparkles,
  ChevronDown,
  Home,
  Waves,
  CloudRain,
  Sun,
  Zap,
  Heart,
  Moon,
} from "lucide-react";
import * as Tone from "tone";

// ─────────────────────────────────────────────
// 1. DICCIONARIO MUSICAL (core dinámico)
// ─────────────────────────────────────────────

/** Notas cromáticas (enarmonía simplificada) */
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Intervalos de los modos griegos (semitonos desde la raíz del modo)
 * Ionian = mayor natural, Aeolian = menor natural, etc.
 */
const MODE_INTERVALS = {
  jónico: [0, 2, 4, 5, 7, 9, 11], // mayor
  dórico: [0, 2, 3, 5, 7, 9, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  mixolidio: [0, 2, 4, 5, 7, 9, 10],
  eólico: [0, 2, 3, 5, 7, 8, 10], // menor natural
  locrio: [0, 1, 3, 5, 6, 8, 10],
};

/** Calidad del acorde triádico por grado en cada modo (0=maj, 1=min, 2=dim) */
const MODE_CHORD_QUALITIES = {
  jónico: [0, 1, 1, 0, 0, 1, 2],
  dórico: [1, 1, 0, 1, 1, 0, 2],
  frigio: [1, 0, 1, 1, 0, 2, 0],
  lidio: [0, 0, 1, 2, 0, 1, 1],
  mixolidio: [0, 1, 2, 0, 1, 1, 0],
  eólico: [1, 2, 0, 1, 1, 0, 0],
  locrio: [2, 0, 1, 1, 0, 0, 1],
};

const QUALITY_SUFFIX = ["", "m", "dim"]; // maj, min, dim

/**
 * Dimensiones emocionales por grado (base Mauro de María + adaptación)
 * Se muestran en tooltip al hover de cada botón Likert.
 */
const DEGREE_EMOTIONS = [
  {
    degree: "I",
    label: "Reposo / Hogar",
    description: "Llegada, estabilidad, centro emocional del sprint",
    icon: Home,
    color: "cyan",
  },
  {
    degree: "II",
    label: "Tensión inicial",
    description: "Alejamiento suave, primeras dudas o fricción",
    icon: Waves,
    color: "sky",
  },
  {
    degree: "III",
    label: "Melancolía",
    description: "Tensión pasiva, sonoridad intermedia, reflexión",
    icon: CloudRain,
    color: "indigo",
  },
  {
    degree: "IV",
    label: "Apertura",
    description: "Expansión lumínica, diálogo, posibilidades",
    icon: Sun,
    color: "amber",
  },
  {
    degree: "V",
    label: "Tensión activa",
    description: "Inestable, exige resolución, energía alta",
    icon: Zap,
    color: "orange",
  },
  {
    degree: "VI",
    label: "Nostalgia",
    description: "Tensión contrastante, reflexiva, añoranza",
    icon: Heart,
    color: "rose",
  },
  {
    degree: "VII",
    label: "Cierre filoso",
    description: "Tensión oscura, inestable, resolución pendiente",
    icon: Moon,
    color: "violet",
  },
];

/** Preguntas típicas de retrospectiva ágil (7) */
const QUESTIONS = [
  "¿Cómo sentiste el inicio del sprint?",
  "¿Cómo fue la colaboración del equipo?",
  "¿Cómo manejamos los bloqueos e impedimentos?",
  "¿Qué tan clara estuvo la comunicación?",
  "¿Cómo se sintió el ritmo de entrega?",
  "¿Qué tan alineados estuvimos con el objetivo?",
  "¿Cómo te sientes al cerrar este sprint?",
];

// ─────────────────────────────────────────────
// 2. UTILIDADES MUSICALES
// ─────────────────────────────────────────────

function noteIndex(note) {
  return NOTES.indexOf(note);
}

function transpose(note, semitones) {
  const idx = (noteIndex(note) + semitones + 120) % 12;
  return NOTES[idx];
}

/**
 * Construye los 7 acordes diatónicos de una tonalidad + modo.
 * Retorna array de { root, quality, symbol, notes: [root, third, fifth] }
 */
function buildDiatonicChords(rootNote, modeKey) {
  const intervals = MODE_INTERVALS[modeKey];
  const qualities = MODE_CHORD_QUALITIES[modeKey];

  return intervals.map((semi, i) => {
    const chordRoot = transpose(rootNote, semi);
    const quality = qualities[i]; // 0 maj, 1 min, 2 dim
    // Intervalos de la triada relativa a la raíz del acorde
    const thirdSemi = quality === 0 ? 4 : 3; // maj 3rd o min 3rd
    const fifthSemi = quality === 2 ? 6 : 7; // dim 5th o perfect 5th
    const third = transpose(chordRoot, thirdSemi);
    const fifth = transpose(chordRoot, fifthSemi);
    const symbol = `${chordRoot}${QUALITY_SUFFIX[quality]}`;
    return {
      root: chordRoot,
      quality,
      symbol,
      notes: [chordRoot, third, fifth],
      degree: DEGREE_EMOTIONS[i].degree,
    };
  });
}

/**
 * Convierte notas a notación científica para Tone.js (octava 3-4 para pad)
 */
function toToneNotes(chordNotes, baseOctave = 3) {
  const rootIdx = noteIndex(chordNotes[0]);
  return chordNotes.map((n, i) => {
    const idx = noteIndex(n);
    let oct = baseOctave;
    if (i > 0 && idx < rootIdx) oct = baseOctave + 1;
    return `${n}${oct}`;
  });
}

// ─────────────────────────────────────────────
// 3. COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function SprintSoundtrack() {
  // Configuración global
  const [rootNote, setRootNote] = useState("C");
  const [mode, setMode] = useState("jónico");

  // Respuestas: array de 7 (null = sin responder, 0-6 = grado)
  const [answers, setAnswers] = useState(Array(7).fill(null));

  // Audio
  const [audioReady, setAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);

  const synthRef = useRef(null);
  const reverbRef = useRef(null);
  const scheduledIds = useRef([]);

  // Acordes diatónicos derivados de root + mode
  const diatonicChords = useMemo(
    () => buildDiatonicChords(rootNote, mode),
    [rootNote, mode]
  );

  // Progresión generada por las respuestas
  const progression = useMemo(() => {
    return answers.map((degreeIdx) =>
      degreeIdx === null ? null : diatonicChords[degreeIdx]
    );
  }, [answers, diatonicChords]);

  const allAnswered = answers.every((a) => a !== null);

  // ── Inicializar Tone.js (una sola vez, tras gesto de usuario) ──
  const initAudio = useCallback(async () => {
    if (audioReady) return;
    await Tone.start();
    // PolySynth tipo Pad / Rhodes suave
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.45 }).toDestination();
    await reverb.generate();
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: {
        attack: 0.4,
        decay: 0.6,
        sustain: 0.7,
        release: 2.2,
      },
      volume: -8,
    }).connect(reverb);

    synthRef.current = synth;
    reverbRef.current = reverb;
    setAudioReady(true);
  }, [audioReady]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (reverbRef.current) {
        reverbRef.current.dispose();
      }
    };
  }, []);

  // ── Seleccionar respuesta ──
  const selectAnswer = (qIndex, degreeIdx) => {
    // Primera interacción → desbloquear audio
    if (!audioReady) {
      initAudio();
    }
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = degreeIdx;
      return next;
    });
  };

  // ── Reproducir progresión ──
  const playProgression = async () => {
    if (!allAnswered) return;
    if (!audioReady) {
      await initAudio();
    }

    // Detener cualquier reproducción previa
    stopPlayback();

    const synth = synthRef.current;
    if (!synth) return;

    setIsPlaying(true);
    setPlayingIndex(0);

    const chordDuration = 1.6; // segundos por acorde
    const now = Tone.now();

    progression.forEach((chord, i) => {
      if (!chord) return;
      const notes = toToneNotes(chord.notes, 3);
      // Añadir la raíz una octava arriba para más cuerpo
      const richNotes = [...notes, `${chord.root}4`];

      const startTime = now + i * chordDuration;

      // Programar ataque
      synth.triggerAttackRelease(richNotes, chordDuration * 0.95, startTime);

      // Feedback visual sincronizado
      const timeoutId = setTimeout(() => {
        setPlayingIndex(i);
      }, i * chordDuration * 1000);
      scheduledIds.current.push(timeoutId);
    });

    // Fin de la secuencia
    const endId = setTimeout(() => {
      setIsPlaying(false);
      setPlayingIndex(-1);
    }, progression.length * chordDuration * 1000 + 200);
    scheduledIds.current.push(endId);
  };

  const stopPlayback = () => {
    scheduledIds.current.forEach(clearTimeout);
    scheduledIds.current = [];
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setPlayingIndex(-1);
  };

  // ── UI helpers ──
  const selectedColorMap = {
    cyan: "border-cyan-400 bg-cyan-500/40 text-cyan-100 glow-cyan",
    sky: "border-sky-400 bg-sky-500/40 text-sky-100",
    indigo: "border-indigo-400 bg-indigo-500/40 text-indigo-100",
    amber: "border-amber-400 bg-amber-500/40 text-amber-100",
    orange: "border-orange-400 bg-orange-500/40 text-orange-100",
    rose: "border-rose-400 bg-rose-500/40 text-rose-100",
    violet: "border-violet-400 bg-violet-500/40 text-violet-100 glow-purple",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 ring-1 ring-cyan-400/40">
              <Music2 className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                Sprint Soundtrack
              </h1>
              <p className="text-xs text-zinc-400">
                Retrospectiva ágil → progresión musical
              </p>
            </div>
          </div>

          {/* Selectores de Tonalidad */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="hidden sm:inline">Raíz</span>
              <div className="relative">
                <select
                  value={rootNote}
                  onChange={(e) => setRootNote(e.target.value)}
                  className="appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-8 text-sm font-medium text-zinc-100 outline-none transition focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                >
                  {NOTES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="hidden sm:inline">Modo</span>
              <div className="relative">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-8 text-sm font-medium capitalize text-zinc-100 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40"
                >
                  {Object.keys(MODE_INTERVALS).map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Intro + preview de acordes diatónicos */}
        <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
            <div>
              <h2 className="text-base font-medium text-white">
                Tonalidad: {rootNote}{" "}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Cada respuesta se mapea a un grado de esta escala. Al final
                escuchas la &ldquo;banda sonora&rdquo; de tu sprint.
              </p>
            </div>
          </div>

          {/* Chips de acordes diatónicos */}
          <div className="flex flex-wrap gap-2">
            {diatonicChords.map((ch, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs"
              >
                <span className="font-mono font-semibold text-zinc-200">
                  {ch.symbol}
                </span>
                <span className="text-zinc-500">({ch.degree})</span>
              </div>
            ))}
          </div>
        </section>

        {/* Cuestionario */}
        <section className="space-y-6">
          {QUESTIONS.map((question, qIdx) => {
            const isCurrentPlaying = playingIndex === qIdx;
            const selected = answers[qIdx];

            return (
              <article
                key={qIdx}
                className={`rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${
                  isCurrentPlaying
                    ? "border-cyan-400/70 bg-cyan-950/30 glow-cyan chord-playing"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Pregunta {qIdx + 1} de 7
                    </span>
                    <h3 className="text-base font-medium text-zinc-100 sm:text-lg">
                      {question}
                    </h3>
                  </div>
                  {selected !== null && (
                    <span className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-1 font-mono text-sm text-cyan-300">
                      {diatonicChords[selected]?.symbol}
                    </span>
                  )}
                </div>

                {/* Likert musical: 7 botones de grado */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {DEGREE_EMOTIONS.map((emo, degIdx) => {
                    const Icon = emo.icon;
                    const isSelected = selected === degIdx;
                    const base =
                      "group relative flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 sm:py-3 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60";
                    const cls = isSelected
                      ? `${base} ${selectedColorMap[emo.color]}`
                      : `${base} border-zinc-700/80 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200`;

                    return (
                      <button
                        key={degIdx}
                        type="button"
                        onClick={() => selectAnswer(qIdx, degIdx)}
                        className={cls}
                        aria-label={`${emo.degree}: ${emo.label}`}
                        aria-pressed={isSelected}
                      >
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-[10px] font-semibold sm:text-xs">
                          {emo.degree}
                        </span>

                        {/* Tooltip */}
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-40 -translate-x-1/2 rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-2 text-center text-[11px] leading-snug text-zinc-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                          <strong className="block text-zinc-50">
                            {emo.label}
                          </strong>
                          {emo.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        {/* Secuenciador — El Gran Final */}
        <section className="mt-12 mb-16">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-6 text-center sm:p-8">
            <div className="mb-4 flex justify-center">
              <Volume2 className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">
              Escuchar nuestro Sprint
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              {allAnswered
                ? "Tu progresión de 7 acordes está lista. Dale play."
                : `Responde las ${7 - answers.filter((a) => a !== null).length} pregunta(s) restantes para desbloquear.`}
            </p>

            {/* Preview de la progresión */}
            {allAnswered && (
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                {progression.map((ch, i) => (
                  <span
                    key={i}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-sm transition-all ${
                      playingIndex === i
                        ? "border-cyan-400 bg-cyan-500/30 text-cyan-100 scale-110 glow-cyan"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {ch?.symbol}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={playProgression}
                disabled={!allAnswered || isPlaying}
                className={`inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold transition-all ${
                  allAnswered && !isPlaying
                    ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-500"
                }`}
              >
                <Play className="h-5 w-5 fill-current" />
                {isPlaying ? "Reproduciendo…" : "Escuchar nuestro Sprint"}
              </button>

              {isPlaying && (
                <button
                  type="button"
                  onClick={stopPlayback}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-600 bg-zinc-800 px-5 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Detener
                </button>
              )}
            </div>

            {!audioReady && (
              <p className="mt-4 text-xs text-zinc-500">
                El audio se inicializa con tu primera interacción (política del
                navegador).
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600">
        Sprint Soundtrack · Teoría de modos griegos + dimensiones emocionales ·
        Tone.js
      </footer>
    </div>
  );
}
