export type ArtifactUrlAdapter = {
  create(value: Blob): string;
  revoke(url: string): void;
};

export function createNativeArtifactUrlAdapter(): ArtifactUrlAdapter {
  return {
    create(value) {
      return URL.createObjectURL(value);
    },
    revoke(url) {
      URL.revokeObjectURL(url);
    },
  };
}
