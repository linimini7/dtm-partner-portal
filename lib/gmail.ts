/**
 * Minimal Gmail API client for partnerships@deeptech.build. Most of this
 * file (message search/read) only ever needed gmail.readonly, used to
 * ingest partner-sent logos and contact info (see lib/email-ingestion.ts).
 *
 * createDraft() below is the one write operation and needs the broader
 * gmail.compose scope, which the currently-configured refresh token does
 * NOT have — it'll 403 until GMAIL_REFRESH_TOKEN is reissued via a fresh
 * OAuth consent that includes gmail.compose (readonly alone can't create
 * drafts). See lib/moat-intro.ts for the one caller.
 *
 * Auth is a plain OAuth refresh-token exchange (no googleapis dependency
 * needed for the handful of endpoints this uses) — see the conversation
 * this was set up in for how GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN were
 * obtained. The consent screen is Internal to the deeptech.build Workspace,
 * so the refresh token doesn't expire the way a Testing-mode app's would.
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN not configured.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${JSON.stringify(json)}`);
  }
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedAccessToken.token;
}

async function gmailFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status} on ${path}: ${await res.text().catch(() => "")}`);
  }
  return res.json() as Promise<T>;
}

export interface GmailMessagePart {
  filename?: string;
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number };
  parts?: GmailMessagePart[];
}

/** True for a real file attachment; false for an inline image (email-signature logos, headshots, tracking pixels) embedded in the body. */
export function isRealAttachment(part: GmailMessagePart): boolean {
  const disposition = part.headers?.find((h) => h.name.toLowerCase() === "content-disposition")?.value ?? "";
  return disposition.toLowerCase().startsWith("attachment");
}

export interface GmailMessage {
  id: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: GmailMessagePart[];
  };
}

export async function searchMessageIds(query: string, maxResults = 50): Promise<string[]> {
  const res = await gmailFetch<{ messages?: { id: string }[] }>(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
  );
  return (res.messages ?? []).map((m) => m.id);
}

export async function getMessage(id: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(`/messages/${id}?format=full`);
}

export async function getAttachmentBytes(messageId: string, attachmentId: string): Promise<Buffer> {
  const res = await gmailFetch<{ data: string }>(`/messages/${messageId}/attachments/${attachmentId}`);
  // Gmail attachment bytes are base64url, not standard base64.
  return Buffer.from(res.data, "base64url");
}

/** Flattens a message's MIME tree — attachments can be nested under multipart/* parts. */
export function flattenParts(parts: GmailMessagePart[] | undefined): GmailMessagePart[] {
  if (!parts) return [];
  return parts.flatMap((p) => [p, ...flattenParts(p.parts)]);
}

function headerValue(message: GmailMessage, name: string): string | null {
  return message.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

/**
 * Creates a Gmail draft in partnerships@deeptech.build — requires
 * gmail.compose, see this file's header comment. Throws on any failure
 * (including insufficient scope) so callers can decide how to degrade —
 * see lib/moat-intro.ts, which still logs the request even when the draft
 * itself couldn't be created.
 */
export async function createDraft(options: {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}): Promise<void> {
  const token = await getAccessToken();
  const lines = [
    `To: ${options.to.join(", ")}`,
    ...(options.cc && options.cc.length > 0 ? [`Cc: ${options.cc.join(", ")}`] : []),
    `Subject: ${options.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    options.body,
  ];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const res = await fetch(`${GMAIL_BASE}/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    throw new Error(`Gmail draft creation failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

/** Parses "Name <email@x.com>, other@y.com" style header values into individual addresses. */
export function parseAddressList(headerRaw: string | null): { name: string | null; email: string }[] {
  if (!headerRaw) return [];
  return headerRaw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^"?([^"<]*)"?\s*<(.+)>$/);
      if (match) {
        const name = match[1].trim();
        return { name: name || null, email: match[2].trim().toLowerCase() };
      }
      return { name: null, email: part.replace(/[<>]/g, "").trim().toLowerCase() };
    })
    .filter((a) => a.email.includes("@"));
}

export function getFrom(message: GmailMessage): { name: string | null; email: string } | null {
  return parseAddressList(headerValue(message, "From"))[0] ?? null;
}

export function getAllRecipients(message: GmailMessage): { name: string | null; email: string }[] {
  return [
    ...parseAddressList(headerValue(message, "To")),
    ...parseAddressList(headerValue(message, "Cc")),
  ];
}
