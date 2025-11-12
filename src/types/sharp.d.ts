import type { Buffer } from 'node:buffer';

interface SharpMetadata {
  width?: number;
  height?: number;
}

interface SharpInfo {
  width: number;
  height: number;
  size: number;
  format?: string;
}

interface SharpResizeOptions {
  width?: number;
  height?: number;
  fit?: string;
  position?: string;
  withoutEnlargement?: boolean;
}

interface SharpWebpOptions {
  quality?: number;
}

interface SharpToBufferOptions {
  resolveWithObject: true;
}

interface SharpInstance {
  metadata(): Promise<SharpMetadata>;
  resize(options: SharpResizeOptions): SharpInstance;
  webp(options?: SharpWebpOptions): SharpInstance;
  toBuffer(options: SharpToBufferOptions): Promise<{ data: Buffer; info: SharpInfo }>;
}

type SharpFactory = (input: Buffer, options?: { failOnError?: boolean }) => SharpInstance;

declare const sharp: SharpFactory;

export default sharp;

