import React from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

/**
 * Animated glassy background with drifting blobs + soft spotlight that
 * follows the cursor (sprung for smoothness). Pointer events are off,
 * so it never blocks clicks.
 */
export default function GlassBG() {
  const mx = useMotionValue(50); // %
  const my = useMotionValue(0);  // %
  const sx = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 60, damping: 20, mass: 0.5 });

  const spotlight = useMotionTemplate`
    radial-gradient(900px 420px at ${sx}% ${sy}%,
      rgba(139, 92, 246, .30), transparent 60%)
  `;

  function onMove(e) {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    mx.set(x);
    my.set(y);
  }

  return (
    <div className="fx-wrap" onMouseMove={onMove}>
      {/* soft cursor spotlight */}
      <motion.div className="fx-spotlight" style={{ backgroundImage: spotlight }} />

      {/* drifting blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* subtle grain/grid for glass effect */}
      <div className="grain" />
    </div>
  );
}
