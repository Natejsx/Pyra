import { describe, it, expect, beforeEach } from 'vitest';
import { RequestTracer, shouldTrace, resetTraceIdCounter } from '../tracer.js';

beforeEach(() => {
  resetTraceIdCounter();
});

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('RequestTracer — construction', () => {
  it('assigns a unique id to each instance', () => {
    const a = new RequestTracer('GET', '/a');
    const b = new RequestTracer('GET', '/b');
    const ta = a.finalize(200);
    const tb = b.finalize(200);
    expect(ta.id).not.toBe(tb.id);
  });

  it('stores the method and pathname', () => {
    const tracer = new RequestTracer('POST', '/api/users');
    const trace = tracer.finalize(201);
    expect(trace.method).toBe('POST');
    expect(trace.pathname).toBe('/api/users');
  });

  it('records a timestamp on creation', () => {
    const before = Date.now();
    const tracer = new RequestTracer('GET', '/');
    const trace = tracer.finalize(200);
    expect(trace.timestamp).toBeGreaterThanOrEqual(before);
    expect(trace.timestamp).toBeLessThanOrEqual(Date.now());
  });
});

// ─── Stage recording ──────────────────────────────────────────────────────────

describe('RequestTracer — start / end', () => {
  it('records a stage with a non-negative duration', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('render');
    tracer.end();
    const trace = tracer.finalize(200);
    expect(trace.stages).toHaveLength(1);
    expect(trace.stages[0].name).toBe('render');
    expect(trace.stages[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records multiple sequential stages', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('compile');
    tracer.end();
    tracer.start('render');
    tracer.end();
    tracer.start('inject-assets');
    tracer.end();
    const trace = tracer.finalize(200);
    expect(trace.stages.map(s => s.name)).toEqual(['compile', 'render', 'inject-assets']);
  });

  it('stores stage detail when provided', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('render', 'react SSR');
    tracer.end();
    expect(tracer.finalize(200).stages[0].detail).toBe('react SSR');
  });

  it('auto-closes an open stage when start() is called again', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('stage-one');
    tracer.start('stage-two'); // should close stage-one first
    tracer.end();
    const trace = tracer.finalize(200);
    expect(trace.stages).toHaveLength(2);
    expect(trace.stages[0].name).toBe('stage-one');
    expect(trace.stages[1].name).toBe('stage-two');
  });

  it('end() is a no-op when no stage is open', () => {
    const tracer = new RequestTracer('GET', '/');
    expect(() => tracer.end()).not.toThrow();
    expect(tracer.finalize(200).stages).toHaveLength(0);
  });
});

// ─── endWithError ─────────────────────────────────────────────────────────────

describe('RequestTracer — endWithError', () => {
  it('records the error message on the stage', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('load');
    tracer.endWithError('db connection refused');
    const trace = tracer.finalize(500);
    expect(trace.stages[0].error).toBe('db connection refused');
  });

  it('records a top-level error on the trace', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('load');
    tracer.endWithError('unexpected');
    const trace = tracer.finalize(500);
    expect(trace.error).toBe('unexpected');
  });

  it('is a no-op when no stage is open', () => {
    const tracer = new RequestTracer('GET', '/');
    expect(() => tracer.endWithError('oops')).not.toThrow();
  });
});

// ─── setDetail ────────────────────────────────────────────────────────────────

describe('RequestTracer — setDetail', () => {
  it('annotates the most recently closed stage', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('route-match');
    tracer.end();
    tracer.setDetail('/blog/[slug]');
    expect(tracer.finalize(200).stages[0].detail).toBe('/blog/[slug]');
  });

  it('is a no-op when no stages have been recorded', () => {
    const tracer = new RequestTracer('GET', '/');
    expect(() => tracer.setDetail('noop')).not.toThrow();
  });
});

// ─── finalize ─────────────────────────────────────────────────────────────────

describe('RequestTracer — finalize', () => {
  it('sums stage durations into totalMs', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('a'); tracer.end();
    tracer.start('b'); tracer.end();
    const trace = tracer.finalize(200);
    const sum = trace.stages.reduce((acc, s) => acc + s.durationMs, 0);
    expect(trace.totalMs).toBeCloseTo(sum, 1);
  });

  it('records the HTTP status', () => {
    const tracer = new RequestTracer('GET', '/');
    expect(tracer.finalize(404).status).toBe(404);
  });

  it('auto-closes an open stage before finalizing', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('dangling');
    const trace = tracer.finalize(200); // should not throw
    expect(trace.stages).toHaveLength(1);
    expect(trace.stages[0].name).toBe('dangling');
  });

  it('extracts routeId from a route-match stage with detail', () => {
    const tracer = new RequestTracer('GET', '/blog/hello');
    tracer.start('route-match', '/blog/[slug]');
    tracer.end();
    expect(tracer.finalize(200).routeId).toBe('/blog/[slug]');
  });

  it('routeId is null when no route-match stage exists', () => {
    expect(new RequestTracer('GET', '/').finalize(200).routeId).toBeNull();
  });

  it('routeType is "page" when a render stage exists', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('render'); tracer.end();
    expect(tracer.finalize(200).routeType).toBe('page');
  });

  it('routeType is "api" when a handler stage exists', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('handler'); tracer.end();
    expect(tracer.finalize(200).routeType).toBe('api');
  });

  it('routeType is "static" when a static stage exists', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('static'); tracer.end();
    expect(tracer.finalize(200).routeType).toBe('static');
  });

  it('routeType is null when no known stage type exists', () => {
    expect(new RequestTracer('GET', '/').finalize(200).routeType).toBeNull();
  });
});

// ─── toServerTiming ───────────────────────────────────────────────────────────

describe('RequestTracer — toServerTiming', () => {
  it('produces a valid Server-Timing header for a single stage', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('render'); tracer.end();
    const header = tracer.toServerTiming();
    expect(header).toMatch(/^render;dur=\d+(\.\d+)?$/);
  });

  it('joins multiple stages with ", "', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('compile'); tracer.end();
    tracer.start('render'); tracer.end();
    const parts = tracer.toServerTiming().split(', ');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^compile;dur=/);
    expect(parts[1]).toMatch(/^render;dur=/);
  });

  it('includes desc when the stage has a detail string', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('render', 'react SSR'); tracer.end();
    expect(tracer.toServerTiming()).toContain('desc="react SSR"');
  });

  it('sanitizes stage names: spaces and colons become underscores', () => {
    const tracer = new RequestTracer('GET', '/');
    tracer.start('middleware:auth'); tracer.end();
    const header = tracer.toServerTiming();
    expect(header).toMatch(/^middleware_auth;dur=/);
  });

  it('returns an empty string when no stages exist', () => {
    const tracer = new RequestTracer('GET', '/');
    expect(tracer.toServerTiming()).toBe('');
  });
});

// ─── shouldTrace ──────────────────────────────────────────────────────────────

describe('shouldTrace', () => {
  const fakeReq = (headers: Record<string, string> = {}) => ({ headers });

  it('always returns true in development mode', () => {
    expect(shouldTrace(fakeReq(), undefined, 'development')).toBe(true);
    expect(shouldTrace(fakeReq(), { production: 'off' }, 'development')).toBe(true);
  });

  it('returns false in production when config is "off"', () => {
    expect(shouldTrace(fakeReq(), { production: 'off' }, 'production')).toBe(false);
  });

  it('returns false in production when no config is provided (defaults to "off")', () => {
    expect(shouldTrace(fakeReq(), undefined, 'production')).toBe(false);
  });

  it('returns true in production when config is "on"', () => {
    expect(shouldTrace(fakeReq(), { production: 'on' }, 'production')).toBe(true);
  });

  it('returns true in production when config is "header" and X-Pyra-Trace: 1 is present', () => {
    const req = fakeReq({ 'x-pyra-trace': '1' });
    expect(shouldTrace(req, { production: 'header' }, 'production')).toBe(true);
  });

  it('returns false in production when config is "header" and header is absent', () => {
    expect(shouldTrace(fakeReq(), { production: 'header' }, 'production')).toBe(false);
  });

  it('returns false in production when config is "header" and header value is not "1"', () => {
    const req = fakeReq({ 'x-pyra-trace': 'true' });
    expect(shouldTrace(req, { production: 'header' }, 'production')).toBe(false);
  });

  it('supports Web Request-style headers.get()', () => {
    const req = {
      headers: {
        get: (name: string) => name === 'x-pyra-trace' ? '1' : null,
      },
    };
    expect(shouldTrace(req, { production: 'header' }, 'production')).toBe(true);
  });
});
