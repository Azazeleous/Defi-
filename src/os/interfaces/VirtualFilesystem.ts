export interface VNode {
  readonly path: string;
  readonly name: string;
  readonly type: 'file' | 'directory' | 'block' | 'character';
  readonly size: number;
  readonly modifiedAt: string; // UTC ISO-8601
  readonly permissions: string;
}

export interface VirtualFilesystem {
  mount(mountPoint: string, filesystemType: string, options?: Record<string, string>): Promise<boolean>;
  unmount(mountPoint: string): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array | string>;
  writeFile(path: string, content: Uint8Array | string): Promise<void>;
  listDirectory(path: string): Promise<readonly VNode[]>;
  stat(path: string): Promise<VNode>;
  exists(path: string): Promise<boolean>;
}
