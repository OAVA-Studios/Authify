import { describe, it, expect } from 'vitest';
import app from '../index.js';

describe('openapi docs', () => {
  it('serves the openapi.json spec', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Authify API');
    expect(body.paths).toBeDefined();
    expect(body.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(body.components?.securitySchemes?.apiKey).toBeDefined();
  });

  it('serves swagger ui html', async () => {
    const res = await app.request('/docs');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('swagger-ui');
    expect(text).toContain('/openapi.json');
    expect(text).toContain('Authify API Docs');
  });

  it('serves swagger ui css', async () => {
    const res = await app.request('/docs/swagger-ui.css');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
  });

  it('serves swagger ui bundle js', async () => {
    const res = await app.request('/docs/swagger-ui-bundle.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
  });

  it('rejects path traversal via normalization', async () => {
    const res = await app.request('/docs/../package.json');
    // Hono normalizes the path before routing; traversal lands at /package.json (404)
    expect(res.status).toBe(404);
  });

  it('rejects direct traversal in param', async () => {
    const res = await app.request('/docs/..package.json');
    expect(res.status).toBe(400);
  });
});
