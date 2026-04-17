import { getConfig, TaskKey, SYSTEM_PROMPTS, Config } from './config';

/**
 * Validates whether a material description is meaningful (not garbage data).
 */
export function isValidDescription(text: string | undefined | null): boolean {
  if (!text) return false;
  const cleaned = String(text).trim();
  if (cleaned.length < 5) return false;
  const words = cleaned.split(/\s+/);
  if (words.length < 2) return false;
  if (!/[A-Za-z]/.test(cleaned)) return false;
  // Reject if mostly random characters (no vowels = likely garbage)
  const alphaOnly = cleaned.replace(/[^a-zA-Z]/g, '');
  if (alphaOnly.length > 0) {
    const vowelRatio = (alphaOnly.match(/[aeiouAEIOU]/g) || []).length / alphaOnly.length;
    if (vowelRatio < 0.05) return false; // Almost no vowels = garbage
  }
  return true;
}

/**
 * Filters out invalid/garbage records from data.
 * Checks common description field names.
 */
export function filterInvalidRecords(data: any[]): { valid: any[]; removed: any[] } {
  const descriptionFields = [
    'Material description', 'material_description', 'Description',
    'description', 'service_description', 'Material Description',
    'MATERIAL_DESCRIPTION', 'Name', 'name', 'Short Text'
  ];

  const valid: any[] = [];
  const removed: any[] = [];

  for (const record of data) {
    let descValue = '';
    for (const field of descriptionFields) {
      if (record[field]) {
        descValue = String(record[field]);
        break;
      }
    }

    if (isValidDescription(descValue)) {
      valid.push(record);
    } else {
      removed.push(record);
    }
  }

  return { valid, removed };
}

/**
 * Parses LLM response text into structured JSON.
 * Handles markdown blocks, thinking blocks, and extracts clean JSON only.
 */
function parseLLMResponse(rawContent: string): any {
  let text = rawContent;

  // Remove markdown code fences
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Remove thinking blocks (some models include these)
  text = text.replace(/"type"\s*:\s*"thinking".*?}]\s*}/gs, '');

  text = text.trim();

  // Try to parse the whole thing first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fall through to regex extraction
  }

  // Extract JSON object or array
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Failed to extract JSON from LLM response. Raw: ${text.substring(0, 200)}...`);
  }

  return JSON.parse(match[0]);
}

/**
 * Extracts the records array from a parsed LLM response.
 * Handles both direct arrays and wrapped objects like { "records": [...] }
 */
function extractRecords(parsed: any): any[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  // Check common wrapper keys
  if (parsed.records && Array.isArray(parsed.records)) {
    return parsed.records;
  }
  if (parsed.data && Array.isArray(parsed.data)) {
    return parsed.data;
  }
  if (parsed.results && Array.isArray(parsed.results)) {
    return parsed.results;
  }

  // For duplicate detection, return the whole object (it has special structure)
  return [parsed];
}

export async function callAgent(taskKey: TaskKey, data: any) {
  const CONFIG = getConfig();
  const systemPrompt = SYSTEM_PROMPTS[taskKey];

  const response = await fetch(CONFIG.ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Process this data and return ONLY the JSON object as specified. No markdown, no explanations, no thinking.\n\n${JSON.stringify(data)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }

  const apiResponse = await response.json();

  if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message) {
    throw new Error(`Invalid API response structure: ${JSON.stringify(apiResponse).substring(0, 200)}`);
  }

  const rawContent = apiResponse.choices[0].message.content || "";
  const parsed = parseLLMResponse(rawContent);

  // For duplicate detection, return the full structured object
  if (taskKey === 'DUPLICATE_DETECTION') {
    return parsed;
  }

  // For other tasks, extract the records array
  return extractRecords(parsed);
}

export async function retryCall<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 60000)
      )
    ]);
  } catch (err: any) {
    if (retries === 0) throw err;

    if (
      err.message.includes("429") ||
      err.message.includes("Timeout") ||
      err.message.includes("API Error")
    ) {
      await new Promise(r => setTimeout(r, delay));
    }

    return retryCall(fn, retries - 1, delay * 2);
  }
}

export function createBatches<T>(data: T[], size = 30): T[][] {
  let batches: T[][] = [];
  for (let i = 0; i < data.length; i += size) {
    batches.push(data.slice(i, i + size));
  }
  return batches;
}

export async function processBatches<T, R>(
  taskKey: TaskKey,
  batches: T[][],
  limit = 4,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[][] = new Array(batches.length);
  const executing: Promise<void>[] = [];
  let completed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const p = retryCall(() => callAgent(taskKey, batch)).then(res => {
      results[i] = Array.isArray(res) ? res : [res];
      completed++;
      if (onProgress) onProgress(completed, batches.length);
    });

    const e: Promise<void> = p.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });

    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results.flat();
}
