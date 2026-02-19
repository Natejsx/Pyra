import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a mock sharp pipeline with chainable methods and configurable metadata. */
function createMockPipeline(metadata = { width: 800, height: 600, format: 'webp' as string }) {
  const instance: Record<string, ReturnType<typeof vi.fn>> = {};
  instance.resize   = vi.fn(() => instance);
  instance.webp     = vi.fn(() => instance);
  instance.avif     = vi.fn(() => instance);
  instance.jpeg     = vi.fn(() => instance);
  instance.png      = vi.fn(() => instance);
  instance.metadata = vi.fn().mockResolvedValue(metadata);
  instance.toBuffer = vi.fn().mockResolvedValue(Buffer.from('fake-compressed-image-bytes'));
  return instance;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let tmpFile: string;
let mockPipeline: ReturnType<typeof createMockPipeline>;

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `pyra-opt-test-${Date.now()}.jpg`);
  fs.writeFileSync(tmpFile, 'fake-jpeg-data');

  // Fresh module state + fresh mock pipeline for every test
  vi.resetModules();
  mockPipeline = createMockPipeline();
  vi.doMock('sharp', () => ({ default: vi.fn(() => mockPipeline) }));
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  vi.doUnmock('sharp');
});

// ─── isSharpAvailable() ───────────────────────────────────────────────────────

describe('isSharpAvailable()', () => {
  it('returns true when sharp can be imported', async () => {
    const { isSharpAvailable } = await import('../image-optimizer.js');
    expect(await isSharpAvailable()).toBe(true);
  });

  it('caches the result after the first call', async () => {
    const { isSharpAvailable } = await import('../image-optimizer.js');
    const first  = await isSharpAvailable();
    const second = await isSharpAvailable();
    expect(first).toBe(second);
  });
});

// ─── getImageMetadata() ───────────────────────────────────────────────────────

describe('getImageMetadata()', () => {
  it('returns width, height, and format from the sharp metadata', async () => {
    mockPipeline.metadata.mockResolvedValue({ width: 1920, height: 1080, format: 'jpeg' });
    const { getImageMetadata } = await import('../image-optimizer.js');
    const meta = await getImageMetadata(tmpFile);
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.format).toBe('jpeg');
  });

  it('defaults width and height to 0 when sharp returns undefined', async () => {
    mockPipeline.metadata.mockResolvedValue({ width: undefined, height: undefined, format: 'png' });
    const { getImageMetadata } = await import('../image-optimizer.js');
    const meta = await getImageMetadata(tmpFile);
    expect(meta.width).toBe(0);
    expect(meta.height).toBe(0);
  });

  it('defaults format to "unknown" when sharp returns undefined', async () => {
    mockPipeline.metadata.mockResolvedValue({ width: 100, height: 100, format: undefined });
    const { getImageMetadata } = await import('../image-optimizer.js');
    const meta = await getImageMetadata(tmpFile);
    expect(meta.format).toBe('unknown');
  });

  it('returns all three fields from the metadata object', async () => {
    const { getImageMetadata } = await import('../image-optimizer.js');
    const meta = await getImageMetadata(tmpFile);
    expect(meta).toHaveProperty('width');
    expect(meta).toHaveProperty('height');
    expect(meta).toHaveProperty('format');
  });
});

// ─── optimizeImage() ─────────────────────────────────────────────────────────

describe('optimizeImage()', () => {
  // ── Return shape ────────────────────────────────────────────────────────────

  it('returns a Buffer', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, { format: 'webp' });
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it('size equals buffer.length', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, { format: 'webp' });
    expect(result.size).toBe(result.buffer.length);
  });

  it('buffer has non-zero length', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, { format: 'webp' });
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('format in the result matches the requested format', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, { format: 'avif' });
    expect(result.format).toBe('avif');
  });

  it('width and height come from the post-compress sharp metadata call', async () => {
    mockPipeline.metadata.mockResolvedValue({ width: 400, height: 300, format: 'webp' });
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, { format: 'webp' });
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  // ── Default values ───────────────────────────────────────────────────────────

  it('defaults format to "webp" when not specified', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    const result = await optimizeImage(tmpFile, {});
    expect(result.format).toBe('webp');
  });

  it('defaults quality to 80', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp' });
    expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 80 });
  });

  // ── Format routing ───────────────────────────────────────────────────────────

  it('calls .webp() for webp format with the given quality', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', quality: 75 });
    expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 75 });
  });

  it('calls .avif() for avif format', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'avif', quality: 60 });
    expect(mockPipeline.avif).toHaveBeenCalledWith({ quality: 60 });
  });

  it('calls .jpeg() for jpeg format', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'jpeg', quality: 85 });
    expect(mockPipeline.jpeg).toHaveBeenCalledWith({ quality: 85 });
  });

  it('calls .png() for png format', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'png', quality: 90 });
    expect(mockPipeline.png).toHaveBeenCalledWith({ quality: 90 });
  });

  it('does not call any non-requested format methods', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp' });
    expect(mockPipeline.avif).not.toHaveBeenCalled();
    expect(mockPipeline.jpeg).not.toHaveBeenCalled();
    expect(mockPipeline.png).not.toHaveBeenCalled();
  });

  // ── Resize ───────────────────────────────────────────────────────────────────

  it('calls .resize() when a width is provided', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', width: 640 });
    expect(mockPipeline.resize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 640, withoutEnlargement: true }),
    );
  });

  it('does not call .resize() when no width is given', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp' });
    expect(mockPipeline.resize).not.toHaveBeenCalled();
  });

  it('passes withoutEnlargement: true to prevent upscaling', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', width: 9999 });
    expect(mockPipeline.resize).toHaveBeenCalledWith(
      expect.objectContaining({ withoutEnlargement: true }),
    );
  });

  it('defaults resize fit to "inside"', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', width: 640 });
    expect(mockPipeline.resize).toHaveBeenCalledWith(
      expect.objectContaining({ fit: 'inside' }),
    );
  });

  it('passes a custom fit value through to resize', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', width: 400, fit: 'cover' });
    expect(mockPipeline.resize).toHaveBeenCalledWith(
      expect.objectContaining({ fit: 'cover' }),
    );
  });

  // ── Quality clamping ─────────────────────────────────────────────────────────

  it('clamps quality below 1 to 1', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', quality: -10 });
    expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 1 });
  });

  it('clamps quality above 100 to 100', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'jpeg', quality: 999 });
    expect(mockPipeline.jpeg).toHaveBeenCalledWith({ quality: 100 });
  });

  it('passes quality 1 through unchanged', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'webp', quality: 1 });
    expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 1 });
  });

  it('passes quality 100 through unchanged', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await optimizeImage(tmpFile, { format: 'avif', quality: 100 });
    expect(mockPipeline.avif).toHaveBeenCalledWith({ quality: 100 });
  });

  // ── Error paths ───────────────────────────────────────────────────────────────

  it('throws when the source file does not exist', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await expect(
      optimizeImage('/nonexistent/path/no-image.jpg', { format: 'webp' }),
    ).rejects.toThrow('source image not found');
  });

  it('error for missing file includes the path', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await expect(
      optimizeImage('/no/such/file.png', { format: 'webp' }),
    ).rejects.toThrow('/no/such/file.png');
  });

  it('error for missing file includes the [pyra:images] prefix', async () => {
    const { optimizeImage } = await import('../image-optimizer.js');
    await expect(
      optimizeImage('/no/such/file.png', { format: 'webp' }),
    ).rejects.toThrow('[pyra:images]');
  });
});
