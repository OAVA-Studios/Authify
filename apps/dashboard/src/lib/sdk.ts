import { AuthifyClient } from '@authify/sdk';

const baseUrl = import.meta.env.VITE_AUTHIFY_API_URL ?? 'http://localhost:4000';
const projectId = import.meta.env.VITE_AUTHIFY_PROJECT_ID ?? '';

export const client = new AuthifyClient({ baseUrl, projectId });

client.onRefresh((token, refreshToken) => {
  localStorage.setItem('authify_token', token);
  localStorage.setItem('authify_refresh', refreshToken);
});

const savedToken = localStorage.getItem('authify_token');
const savedRefresh = localStorage.getItem('authify_refresh');
if (savedToken) {
  client.setToken(savedToken, savedRefresh ?? undefined);
}
