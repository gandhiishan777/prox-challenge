import { describe, expect, it } from "vitest";

import { stripForSpeech } from "./use-voice";

describe("stripForSpeech", () => {
  it("drops markdown notation but keeps the words", () => {
    expect(stripForSpeech("**25% at 200A** on `240V`")).toBe("25% at 200A on 240V");
  });

  it("keeps link labels, not targets", () => {
    expect(stripForSpeech("[p. 7](#page-om-07)")).toBe("page 7");
  });

  it("skips parenthesised citations entirely", () => {
    expect(stripForSpeech("It is 25% (p. 7, p. 19).")).toBe("It is 25% .");
    expect(stripForSpeech("hookups (Quick Start p. 2)")).toBe("hookups");
  });

  it("reads bare page references as words", () => {
    expect(stripForSpeech("see p. 24 for the setup")).toBe("see page 24 for the setup");
  });
});
