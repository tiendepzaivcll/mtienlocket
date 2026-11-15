import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_REACTION_PARTICLES = 40;
const PARTICLES_PER_REACTION = 5;

const isReactionEmoji = (value) =>
  typeof value === "string" && value.trim().length > 0;

const FlyingEmojiEffect = ({
  active = false,
  emojis = [],
  momentId = null,
  maxCount = MAX_REACTION_PARTICLES,
}) => {
  const [particles, setParticles] = useState([]);
  const playedMomentRef = useRef(null);
  const cleanupTimerRef = useRef(null);

  const reactionEmojis = useMemo(
    () => emojis.filter(isReactionEmoji).slice(-maxCount),
    [emojis, maxCount],
  );

  useEffect(() => {
    if (!active) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      playedMomentRef.current = null;
      setParticles([]);
      return;
    }

    const playbackKey = momentId || reactionEmojis.join("|");
    if (!reactionEmojis.length || playedMomentRef.current === playbackKey) {
      return;
    }

    playedMomentRef.current = playbackKey;

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const iconSize = 70;
    const availableWidth = Math.max(0, viewportWidth - iconSize);
    const nextParticles = reactionEmojis.flatMap((emoji, reactionIndex) =>
      Array.from({ length: PARTICLES_PER_REACTION }, (_, particleIndex) => {
        const startX = Math.random() * availableWidth;
        const driftX = Math.random() * 180 - 90;
        const startY = -(Math.random() * 180 + 70);
        const delay = Math.random() * 0.65;
        const duration = Math.random() * 1.25 + 2.8;
        const startRotation = Math.random() * 70 - 35;
        const endRotation = startRotation + (Math.random() * 180 - 90);

        return {
          delay,
          driftX,
          duration,
          emoji,
          endY: viewportHeight + iconSize + 50,
          endRotation,
          id: `${momentId || "moment"}:${reactionIndex}:${particleIndex}:${emoji}`,
          opacity: Math.random() * 0.22 + 0.76,
          startRotation,
          startX,
          startY,
        };
      }),
    );

    setParticles(nextParticles);

    const longestAnimation = Math.max(
      ...nextParticles.map((particle) => particle.delay + particle.duration),
    );
    window.clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = window.setTimeout(
      () => setParticles([]),
      (longestAnimation + 0.2) * 1000,
    );
  }, [active, momentId, reactionEmojis]);

  useEffect(
    () => () => {
      window.clearTimeout(cleanupTimerRef.current);
    },
    [],
  );

  if (!particles.length || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[99] overflow-hidden"
      aria-hidden="true"
      data-testid="moment-reaction-effect"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="fixed left-0 top-0 select-none text-[70px] leading-none will-change-transform"
          style={{
            "--reaction-delay": `${particle.delay}s`,
            "--reaction-drift-x": `${particle.driftX}px`,
            "--reaction-duration": `${particle.duration}s`,
            "--reaction-end-rotation": `${particle.endRotation}deg`,
            "--reaction-end-y": `${particle.endY}px`,
            "--reaction-opacity": particle.opacity,
            "--reaction-start-rotation": `${particle.startRotation}deg`,
            "--reaction-start-x": `${particle.startX}px`,
            "--reaction-start-y": `${particle.startY}px`,
            animation:
              "t97-reaction-rain var(--reaction-duration) cubic-bezier(0.2, 0.65, 0.35, 1) var(--reaction-delay) forwards",
          }}
        >
          {particle.emoji}
        </span>
      ))}

      <style>{`
        @keyframes t97-reaction-rain {
          0% {
            opacity: 0;
            transform: translate3d(
                var(--reaction-start-x),
                var(--reaction-start-y),
                0
              )
              rotate(var(--reaction-start-rotation)) scale(0.86);
          }
          10% {
            opacity: var(--reaction-opacity);
          }
          96% {
            opacity: var(--reaction-opacity);
          }
          100% {
            opacity: 0;
            transform: translate3d(
                calc(var(--reaction-start-x) + var(--reaction-drift-x)),
                var(--reaction-end-y),
                0
              )
              rotate(var(--reaction-end-rotation)) scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-testid="moment-reaction-effect"] {
            display: none;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default FlyingEmojiEffect;
