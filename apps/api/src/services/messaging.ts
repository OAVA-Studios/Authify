import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { BadRequestError, InternalError } from '@authify/shared';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => variables[key] ?? '');
}

export function renderTemplate(
  template: { body: string; htmlBody: string | null; subject: string | null },
  variables: Record<string, string>
): { body: string; htmlBody: string | null; subject: string | null } {
  return {
    body: substituteVariables(template.body, variables),
    htmlBody: template.htmlBody ? substituteVariables(template.htmlBody, variables) : null,
    subject: template.subject ? substituteVariables(template.subject, variables) : null,
  };
}

export async function sendEmailSmtp(
  config: SmtpConfig,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Use Node.js net/tls for SMTP handshake
    const connection = await Bun.connect({
      hostname: config.host,
      port: config.port,
      tls: config.secure ?? config.port === 465,
    });

    // Simple SMTP conversation
    const encoder = new TextEncoder();
    const send = (cmd: string) => connection.write(encoder.encode(cmd + '\r\n'));

    await send(`EHLO authify`);
    await send(`AUTH LOGIN`);
    await send(Buffer.from(config.user).toString('base64'));
    await send(Buffer.from(config.pass).toString('base64'));
    await send(`MAIL FROM:<${options.from}>`);
    await send(`RCPT TO:<${options.to}>`);
    await send(`DATA`);

    const boundary = `----AuthifyBoundary${Date.now()}`;
    let message = `From: ${options.from}\r\n`;
    message += `To: ${options.to}\r\n`;
    message += `Subject: ${options.subject}\r\n`;
    message += `MIME-Version: 1.0\r\n`;

    if (options.html) {
      message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
      message += `${options.text ?? ''}\r\n\r\n`;
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
      message += `${options.html}\r\n\r\n`;
      message += `--${boundary}--\r\n`;
    } else {
      message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
      message += `${options.text ?? ''}\r\n`;
    }

    message += `\r\n.\r\n`;

    await send(message);
    await send(`QUIT`);
    connection.end();

    return { success: true, messageId: `${Date.now()}` };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err: error }, 'SMTP send failed');
    return { success: false, error };
  }
}

export async function sendWebhookRequest(
  url: string,
  payload: Record<string, unknown>,
  secret?: string
): Promise<{ success: boolean; statusCode?: number; responseBody?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Authify/1.0',
    };

    if (secret) {
      const sig = await signPayload(payload, secret);
      headers['X-Authify-Signature'] = sig;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseBody = await res.text();
    return {
      success: res.ok,
      statusCode: res.status,
      responseBody,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

async function signPayload(payload: Record<string, unknown>, secret: string): Promise<string> {
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Buffer.from(signature).toString('hex');
}
