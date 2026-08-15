# Lessons

Patterns from corrections, kept so the same mistake isn't made twice.

## Disabled controls read as broken, not as waiting

**What happened:** The machine strip rendered "SET WIRE" as a visible chip even
before a process was selected, but made it silently ignore clicks (`inert`),
because the wire list depends on the process. The user's read was "this isn't
wired into anything" — i.e. broken — and the report was to remove it.

**The pattern:** A control that renders but does nothing is indistinguishable
from a bug. If a control has no honest function in the current state, don't
render it disabled — don't render it at all, and let it appear when its
preconditions are met. The strip already did this correctly for the gas chip
(hidden for gasless processes); the wire chip should have followed the same
rule from the start.

**How to apply:** When a control's options depend on another selection, gate
its *existence* on that selection, not its clickability. If a disabled state is
genuinely needed, it must look disabled and say why.
