"use client";

import * as React from "react";

import { getView } from "@/lib/machine/map";

/**
 * Interactive overlay on the manual's own machine drawings.
 *
 * The image is the manual's line art; this adds a hotspot layer on top of it —
 * pulsing rings on the parts a caller wants to point at, faint dots on the rest,
 * and a hover label. It is deliberately self-contained (one image, one SVG, no
 * app dependencies beyond the map) because the same component is exposed inside
 * the artifact sandbox, so a generated troubleshooting flow can highlight the
 * exact part for each step.
 *
 * Coordinates in the map are normalized 0..1. The SVG uses a viewBox of
 * 100 x 100*(H/W) so that a radius expressed as a fraction of width stays a
 * circle regardless of the render size.
 *
 * Every colour here is written as a literal arbitrary value — bg-[#14120f]
 * rather than bg-ink — and the hard shadow as an inline style. That exposure to
 * the sandbox is the reason: the sandbox builds its CSS with the Tailwind Play
 * script and no config, so the app's paper/ink/rust tokens do not resolve there.
 * A missing font utility degrades to the inherited face and costs nothing; a
 * missing colour utility would leave the caption bar unpainted, which is why the
 * palette is spelled out in this file and nowhere else.
 */

export interface MachineDiagramProps {
  view: string;
  /** Part ids to highlight. */
  highlight?: string[];
  /** Base URL for the images. Defaults to the app's knowledge route. */
  imageBase?: string;
  /** Show faint markers on the parts that are not highlighted. */
  showAll?: boolean;
  className?: string;
}

export function MachineDiagram({
  view,
  highlight = [],
  imageBase = "/api/knowledge",
  showAll = true,
  className,
}: MachineDiagramProps) {
  const v = getView(view);
  const [hover, setHover] = React.useState<string | null>(null);

  if (!v) {
    return (
      <div className="border border-[#cdc5b8] bg-[#f4f1ec] p-3 font-mono text-[11px] uppercase tracking-[.1em] text-[#8b8579]">
        Unknown machine view: {view}
      </div>
    );
  }

  const [W, H] = v.px;
  const vh = (100 * H) / W;
  const highlighted = new Set(highlight);
  const active = hover ?? (highlight.length === 1 ? highlight[0] : null);
  const activePart = v.parts.find((p) => p.id === active);

  // Normalized part geometry -> SVG user units (x in 0..100, y in 0..vh).
  const toUnits = (p: (typeof v.parts)[number]) => {
    if (p.shape === "circle") {
      return { cx: (p.cx ?? 0) * 100, cy: (p.cy ?? 0) * vh, r: (p.r ?? 0.04) * 100 };
    }
    return {
      x: (p.x ?? 0) * 100,
      y: (p.y ?? 0) * vh,
      w: (p.w ?? 0) * 100,
      h: (p.h ?? 0) * vh,
    };
  };

  return (
    <figure
      className={`overflow-hidden border border-[#14120f] bg-white ${className ?? ""}`}
      style={{ boxShadow: "6px 6px 0 #e0dacd" }}
    >
      <div className="relative">
        <img
          src={`${imageBase}/${v.image}`}
          alt={v.title}
          className="block w-full select-none"
          draggable={false}
        />
        <svg
          viewBox={`0 0 100 ${vh}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {v.parts.map((p) => {
            const isOn = highlighted.has(p.id);
            const isHover = hover === p.id;
            if (!isOn && !showAll) return null;
            const u = toUnits(p);
            // rust / muted, spelled literally for the same reason as the caption
            // bar below: these must paint inside the sandbox, where the tokens
            // do not resolve.
            const stroke = isOn ? "#c24000" : "#8b8579";
            const opacity = isOn ? 1 : isHover ? 0.9 : 0.35;

            return (
              <g
                key={p.id}
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                style={{ opacity }}
              >
                {p.shape === "circle" ? (
                  <>
                    {isOn && (
                      <circle cx={u.cx} cy={u.cy} r={u.r} fill="none" stroke={stroke} strokeWidth={0.8}>
                        <animate attributeName="r" values={`${u.r};${u.r! * 1.5};${u.r}`} dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Halo first, ring on top. Rust alone disappears against the
                        black socket panel on page 8 — and the sockets are the most
                        important thing this diagram ever points at, since a ring on
                        the wrong one is a polarity error. The pale underlay means
                        the marker survives whatever the line art puts behind it. */}
                    {isOn && (
                      <circle
                        cx={u.cx}
                        cy={u.cy}
                        r={u.r}
                        fill="none"
                        stroke="#f4f1ec"
                        strokeWidth={2.6}
                      />
                    )}
                    <circle
                      cx={u.cx}
                      cy={u.cy}
                      r={u.r}
                      fill={isOn ? "rgba(194,64,0,0.18)" : "transparent"}
                      stroke={stroke}
                      strokeWidth={isOn ? 1.3 : 0.6}
                    />
                  </>
                ) : (
                  <>
                    {isOn && (
                      <rect
                        x={u.x}
                        y={u.y}
                        width={u.w}
                        height={u.h}
                        fill="none"
                        stroke="#f4f1ec"
                        strokeWidth={2.6}
                      />
                    )}
                    <rect
                      x={u.x}
                      y={u.y}
                      width={u.w}
                      height={u.h}
                      // Square corners: the marker is the one place a stray rx
                      // would sneak a rounded edge into a design that has none.
                      fill={isOn ? "rgba(194,64,0,0.14)" : "transparent"}
                      stroke={stroke}
                      strokeWidth={isOn ? 1.3 : 0.6}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <figcaption className="border-t border-[#14120f] bg-[#14120f] px-3 py-2 text-[#f4f1ec]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[13px] font-bold uppercase tracking-[.02em]">
            {v.title}
          </span>
          <span className="font-mono text-[10.5px] tracking-[.1em] text-[#ffb283]">
            {v.page.replace(/^om-0?/, "P. ")}
          </span>
        </div>
        {activePart ? (
          <p className="mt-1 text-[12px] leading-snug text-[#8d8779]">
            <span className="font-medium text-[#ff8a4d]">{activePart.label}.</span>{" "}
            {activePart.note}
          </p>
        ) : (
          <p className="mt-1 text-[12px] leading-snug text-[#8d8779]">
            {v.caption} Hover a marker for detail.
          </p>
        )}
      </figcaption>
    </figure>
  );
}
