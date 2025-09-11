import React from "react";
import { motion, useSpring } from "framer-motion";

/** 3D tilt with shine. Set disabled to true to freeze the effect (for forms). */
export default function Tilt3D({ children, max = 8, intensity = 6, className = "", disabled = false }) {
  const rx = useSpring(0, { stiffness: 220, damping: 18 });
  const ry = useSpring(0, { stiffness: 220, damping: 18 });
  const tx = useSpring(0, { stiffness: 260, damping: 20 });
  const ty = useSpring(0, { stiffness: 260, damping: 20 });

  function onMove(e) {
    if (disabled) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * -2 * max);
    rx.set((py - 0.5) *  2 * max);
    tx.set((px - 0.5) * intensity);
    ty.set((py - 0.5) * intensity);
    el.style.setProperty("--mx", `${px*100}%`);
    el.style.setProperty("--my", `${py*100}%`);
  }
  function onLeave(){ if (disabled) return; rx.set(0); ry.set(0); tx.set(0); ty.set(0); }

  return (
    <motion.div className={`relative ${className}`} style={{ perspective: 1200 }}>
      <motion.div
        className="relative shine"
        style={disabled ? {} : { rotateX: rx, rotateY: ry, x: tx, y: ty, transformStyle: "preserve-3d" }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
