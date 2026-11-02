/**
 * bundle-manager.ts
 *
 * Webpack entry bundle compilation & caching manager using @remotion/bundler.
 * Avoids redundant webpack compilations across render requests by caching and
 * reusing the bundle directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type * as BundlerModule from '@remotion/bundler';

function loadBundler(): typeof BundlerModule {
  const req = createRequire(import.meta.url);
  const pkg = ['@remotion', 'bundler'].join('/');
  return req(pkg);
}

export interface BundleOptions {
  entryPoint?: string;
  outDir?: string;
  forceRebundle?: boolean;
}

export class BundleManager {
  private inFlightPromise: Promise<string> | null = null;
  private cachedBundlePath: string | null = null;
  private readonly defaultEntryPoint: string;
  private readonly defaultOutDir: string;

  constructor() {
    this.defaultEntryPoint = path.resolve(process.cwd(), 'remotion/index.ts');
    this.defaultOutDir = path.resolve('/tmp', 'launtion-bundle-cache');
  }

  /**
   * Returns whether a valid bundle already exists on disk.
   */
  public isBundleReady(outDir = this.defaultOutDir): boolean {
    const htmlPath = path.join(outDir, 'index.html');
    const bundleJsPath = path.join(outDir, 'bundle.js');
    return fs.existsSync(htmlPath) && fs.existsSync(bundleJsPath);
  }

  /**
   * Retrieves an existing cached bundle or compiles a new one using @remotion/bundler.
   * Concurrently queued requests await the identical in-flight compilation promise.
   */
  public async getOrCreateBundle(options?: BundleOptions): Promise<string> {
    const entryPoint = options?.entryPoint ?? this.defaultEntryPoint;
    const outDir = options?.outDir ?? this.defaultOutDir;
    const force = options?.forceRebundle ?? false;

    // Fast-path: memory cache check
    if (!force && this.cachedBundlePath && this.cachedBundlePath === outDir && this.isBundleReady(outDir)) {
      return this.cachedBundlePath;
    }

    // Disk cache check: existing bundle on filesystem
    if (!force && this.isBundleReady(outDir)) {
      this.cachedBundlePath = outDir;
      return outDir;
    }

    // Concurrency lock: reuse in-flight bundle promise
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.inFlightPromise = (async () => {
      try {
        // Ensure parent directory exists
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const bundler = loadBundler();
        const bundleResult = await bundler.bundle({
          entryPoint,
          outDir,
        });

        this.cachedBundlePath = bundleResult;
        return bundleResult;
      } finally {
        this.inFlightPromise = null;
      }
    })();

    return this.inFlightPromise;
  }

  /**
   * Invalidates and deletes the cached bundle directory.
   */
  public clearBundleCache(outDir = this.defaultOutDir): void {
    this.cachedBundlePath = null;
    this.inFlightPromise = null;
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
}

export const bundleManager = new BundleManager();
export const getOrCreateBundle = (options?: BundleOptions) => bundleManager.getOrCreateBundle(options);
export const clearBundleCache = (outDir?: string) => bundleManager.clearBundleCache(outDir);
export const isBundleReady = (outDir?: string) => bundleManager.isBundleReady(outDir);
