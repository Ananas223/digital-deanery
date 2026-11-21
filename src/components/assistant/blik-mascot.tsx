"use client";

import { useEffect, useRef, type RefObject } from "react";

import { cn } from "@/lib/utils";

import styles from "./blik-mascot.module.css";

export type BlikState = "static" | "idle" | "thinking" | "success" | "error";

/** Geometry and character colours are taken from the supplied blik.json frame 0. */
export function BlikMascot({
  state = "static",
  className,
  trackingSurfaceRef,
}: {
  state?: BlikState;
  className?: string;
  trackingSurfaceRef?: RefObject<HTMLElement | null>;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const surface = trackingSurfaceRef?.current ?? svg;
    if (state !== "idle" || !svg || !surface) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function resetGaze() {
      svg!.style.setProperty("--blik-look-x", "0px");
      svg!.style.setProperty("--blik-look-y", "0px");
      svg!.removeAttribute("data-blik-following");
    }

    function followPointer(event: Event) {
      if (
        !(event instanceof PointerEvent) ||
        event.pointerType === "touch" ||
        reducedMotion.matches
      )
        return;
      const bounds = svg!.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const centerX = bounds.left + (bounds.width * 131.5) / 256;
      const centerY = bounds.top + (bounds.height * 123) / 256;
      const x = Math.max(-0.5, Math.min(0.5, (event.clientX - centerX) / bounds.width)) * 20;
      const y = Math.max(-0.5, Math.min(0.5, (event.clientY - centerY) / bounds.height)) * 14;
      svg!.style.setProperty("--blik-look-x", `${x.toFixed(2)}px`);
      svg!.style.setProperty("--blik-look-y", `${y.toFixed(2)}px`);
      svg!.setAttribute("data-blik-following", "true");
    }

    surface.addEventListener("pointerenter", followPointer, { passive: true });
    surface.addEventListener("pointermove", followPointer, { passive: true });
    surface.addEventListener("pointerleave", resetGaze);
    surface.addEventListener("pointercancel", resetGaze);
    reducedMotion.addEventListener("change", resetGaze);
    return () => {
      surface.removeEventListener("pointerenter", followPointer);
      surface.removeEventListener("pointermove", followPointer);
      surface.removeEventListener("pointerleave", resetGaze);
      surface.removeEventListener("pointercancel", resetGaze);
      reducedMotion.removeEventListener("change", resetGaze);
      resetGaze();
    };
  }, [state, trackingSurfaceRef]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 256 256"
      className={cn(styles.mascot, "shrink-0", className)}
      data-blik-state={state}
    >
      <g className={styles.pose} data-blik-pose="">
        <path
          data-blik-body=""
          fill="#eca363"
          d="M112 86C119 69 137 31 147 29C161 26 152 70 150 89C168 83 195 65 202 73C212 84 183 106 172 119C190 123 220 123 220 135C221 148 181 150 166 154C166 170 184 190 174 197C165 204 149 177 139 173C131 185 118 214 107 211C97 208 107 178 103 167C88 170 60 193 52 182C44 170 71 151 79 144C65 136 34 131 37 119C40 107 72 115 88 110C83 95 65 72 74 64C84 55 103 83 112 86Z"
        />
        <g className={styles.pointerGaze} data-blik-gaze="">
          <g className={styles.autoGaze} data-blik-auto-gaze="">
            <g className={styles.eyes} fill="#1c304f" data-blik-eyes="">
              <ellipse className={styles.rightEye} cx="143" cy="122" rx="4.3" ry="7.5" />
              <ellipse className={styles.leftEye} cx="120" cy="124" rx="4.3" ry="7.5" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
