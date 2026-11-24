export interface InitramfsImage {
  readonly imageId: string;
  readonly architecture: string;
  readonly kernelVersion: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly modulesLoaded: readonly string[];
  readonly initScriptPath: string;
}

export interface InitramfsProvider {
  loadInitramfs(imagePath: string): Promise<InitramfsImage>;
  verifyIntegrity(image: InitramfsImage): Promise<boolean>;
  extractEarlyCpio(targetDir: string): Promise<number>;
}
