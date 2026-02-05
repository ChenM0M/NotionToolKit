import { Client } from "@notionhq/client";
import { HttpsProxyAgent } from "https-proxy-agent";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

/**
 * Create a Notion client with proxy support
 */
export function createNotionClient(token: string) {
  return new Client({
    auth: token,
    ...(PROXY_URL && { agent: new HttpsProxyAgent(PROXY_URL) }),
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
