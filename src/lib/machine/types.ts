/**
 * Shared types for the interactive machine diagram.
 *
 * Kept dependency-free and in its own module because both the chat app and the
 * bundled artifact runner import the map and the component, and the runner
 * bundle must not drag in anything server-side.
 */
export interface MachinePart {
  id: string;
  label: string;
  shape: "circle" | "rect";
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  keywords: string[];
  note: string;
}

export interface MachineView {
  title: string;
  image: string;
  page: string;
  caption: string;
  px: [number, number];
  parts: MachinePart[];
}

export interface MachineMap {
  views: Record<string, MachineView>;
}
