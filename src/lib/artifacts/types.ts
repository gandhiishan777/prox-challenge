/**
 * Artifact types, mirroring the MIME vocabulary claude.ai uses.
 *
 * Matching it exactly is a deliberate choice: the model has extensive training
 * on emitting `<antArtifact type="application/vnd.ant.react">`, so reusing the
 * same contract means well-formed artifacts come essentially for free, and our
 * job is limited to rendering them.
 */
export const ARTIFACT_TYPES = {
  react: "application/vnd.ant.react",
  html: "text/html",
  svg: "image/svg+xml",
  mermaid: "application/vnd.ant.mermaid",
  code: "application/vnd.ant.code",
  markdown: "text/markdown",
} as const;

export type ArtifactMime = (typeof ARTIFACT_TYPES)[keyof typeof ARTIFACT_TYPES];

export interface ArtifactVersion {
  code: string;
  complete: boolean;
}

export interface Artifact {
  identifier: string;
  type: string;
  title: string;
  language: string | null;
  versions: ArtifactVersion[];
  streaming: boolean;
}

export function isKnownArtifactType(type: string): type is ArtifactMime {
  return (Object.values(ARTIFACT_TYPES) as string[]).includes(type);
}

/** Short human label for the artifact chip. */
export function artifactKindLabel(type: string, language?: string | null): string {
  switch (type) {
    case ARTIFACT_TYPES.react:
      return "Interactive";
    case ARTIFACT_TYPES.html:
      return "Web page";
    case ARTIFACT_TYPES.svg:
      return "Diagram";
    case ARTIFACT_TYPES.mermaid:
      return "Flowchart";
    case ARTIFACT_TYPES.markdown:
      return "Document";
    case ARTIFACT_TYPES.code:
      return language ? language : "Code";
    default:
      return "Artifact";
  }
}
