import { api } from "../api/client";

/** Calls the server-side AI provider so credentials never enter the browser bundle. */
export async function callAiText(prompt: string): Promise<string> {
  const result = await api.generateText(prompt);
  return result.text.trim();
}
