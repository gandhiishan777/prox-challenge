"use client";

import * as React from "react";

import {
  GAS_OPTIONS,
  PROCESS_LABEL,
  PROCESS_OPTIONS,
  VOLTAGE_OPTIONS,
  WIRE_OPTIONS,
  isGasless,
  machineChips,
  type MachineContext,
  type ProcessId,
  type Voltage,
} from "@/lib/machineContext";
import { useChat } from "@/lib/store";

/**
 * The setup strip: the user tells the agent what the welder is wired and spooled
 * for, once, instead of answering the same two clarifying questions all session.
 *
 * Two things make this honest rather than a silent default. It is always
 * visible, so an answer scoped to 240V flux-cored never reads as a general
 * claim. And the options are constrained by the machine's own reality — wire
 * sizes follow the selected process, and the gas chip disappears entirely for
 * flux-cored and stick, because offering a shielding gas there would be wrong
 * advice dressed up as a setting.
 */

type ChipKey = keyof MachineContext;

interface Option {
  value: string;
  label: string;
}

/** Choices for a chip, already labelled the way the manual writes them. */
function optionsFor(key: ChipKey, process: ProcessId | null): Option[] {
  switch (key) {
    case "voltage":
      return VOLTAGE_OPTIONS.map((v) => ({ value: v, label: `${v} V` }));
    case "process":
      return PROCESS_OPTIONS.map((p) => ({ value: p, label: PROCESS_LABEL[p] }));
    case "wire":
      return process ? WIRE_OPTIONS[process].map((w) => ({ value: w, label: w })) : [];
    case "gas":
      return GAS_OPTIONS.map((g) => ({ value: g, label: g }));
  }
}

export function MachineContextBar() {
  const machine = useChat((s) => s.machine);
  const setMachine = useChat((s) => s.setMachine);

  const [open, setOpen] = React.useState<ChipKey | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // A dropdown that survives a click elsewhere in the page feels stuck, and the
  // user's next move is usually the composer.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * One place where the string coming off an option list is narrowed back to
   * its field type. Safe because every value originates in the typed option
   * arrays above.
   */
  const choose = (key: ChipKey, value: string | null) => {
    switch (key) {
      case "voltage":
        setMachine({ voltage: value as Voltage | null });
        break;
      case "process":
        setMachine({ process: value as ProcessId | null });
        break;
      case "wire":
        setMachine({ wire: value });
        break;
      case "gas":
        setMachine({ gas: value });
        break;
    }
    setOpen(null);
  };

  const chips = machineChips(machine);
  // Gas only counts as "set" when the process can actually use one.
  const anySet = Boolean(
    machine.voltage ||
      machine.process ||
      machine.wire ||
      (machine.gas && !isGasless(machine.process)),
  );

  return (
    <div
      ref={rootRef}
      className="flex items-stretch border-t border-ink-700 bg-ink-800"
    >
      <div className="flex items-center border-r border-ink-700 px-4 font-mono text-[10.5px] tracking-[.14em] text-muted-dark whitespace-nowrap">
        MACHINE SET TO
      </div>

      {chips.map((chip) => {
        const key = chip.key;
        const current = machine[key];
        const isSet = current !== null;
        // No process means no honest wire list, so the chip sits inert.
        const inert = key === "wire" && !machine.process;
        const options = optionsFor(key, machine.process);

        const tone = inert
          ? "cursor-default bg-transparent text-muted-dark"
          : isSet
            ? key === "process"
              ? "bg-ink-700 text-rust-light"
              : "bg-ink-700 text-paper"
            : "bg-transparent text-muted-dark hover:text-paper";

        return (
          <div key={key} className="relative flex">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open === key}
              onClick={() => {
                if (inert) return;
                setOpen((prev) => (prev === key ? null : key));
              }}
              className={`border-0 border-r border-ink-800 px-3.5 py-[9px] font-mono text-[12px] tracking-[.06em] transition-colors ${tone}`}
            >
              {chip.label}
            </button>

            {open === key && !inert && (
              <div
                role="listbox"
                className="absolute left-0 top-full z-30 flex min-w-full flex-col border border-ink-700 bg-ink-800 animate-rise"
              >
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={current === option.value}
                    onClick={() => choose(key, option.value)}
                    className={`px-3.5 py-2 text-left font-mono text-[12px] tracking-[.06em] whitespace-nowrap transition-colors hover:bg-ink-700 ${
                      current === option.value ? "text-rust-light" : "text-paper"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => choose(key, null)}
                  className="border-t border-ink-700 px-3.5 py-2 text-left font-mono text-[12px] tracking-[.06em] whitespace-nowrap text-muted-dark transition-colors hover:bg-ink-700 hover:text-paper"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex-1" />

      <div className="hidden items-center px-4 font-mono text-[10.5px] tracking-[.1em] text-muted-dark whitespace-nowrap md:flex">
        {anySet ? "ANSWERS FILTERED TO THIS SETUP" : "SET YOUR SETUP TO SKIP THE QUESTIONS"}
      </div>
    </div>
  );
}
