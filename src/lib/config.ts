export const DEFAULT_CONFIG = {
  ENDPOINT: "https://api.mistral.ai/v1/chat/completions",
  API_KEY: "Y8y8UF7aga11ywUvlfh88XgZnJZeqK88",
  MODEL: "mistral-large-latest",
};

export type TaskKey = 'STANDARDIZATION' | 'ATTRIBUTE_EXTRACTION' | 'DUPLICATE_DETECTION';

export const SYSTEM_PROMPTS: Record<TaskKey, string> = {
  STANDARDIZATION: `You are a master data standardization agent for SAP material master data. Your job is to clean and standardize raw material/product master data records.

For each record in the input JSON array, you MUST:
1. Fix spelling errors, typos, and abbreviations in "Material description" and all text fields
2. Standardize units of measurement (e.g., "KG" -> "kg", "MM" -> "mm", "M2" -> "m²", "EA" -> "each")
3. Normalize casing: Title Case for descriptions, UPPERCASE for material codes/IDs
4. Remove extra whitespace, special characters, and formatting artifacts
5. Standardize date formats to YYYY-MM-DD if dates are present (convert Excel serial numbers to dates)
6. Ensure numeric fields contain only numbers with appropriate precision
7. Keep ALL original field names exactly as they are

CRITICAL: Return a JSON object with key "records" containing the cleaned array. Every input record MUST have a corresponding output record. Example:
{"records": [{"Material": "1000001281", "Material description": "Colombo Jubrana 20mm Flamed", ...}]}`,

  ATTRIBUTE_EXTRACTION: `You are an attribute extraction agent for SAP material master data. Your job is to parse material descriptions and extract structured attributes.

For each record in the input JSON array, you MUST:
1. Keep ALL original fields intact and unchanged
2. Parse the "Material description" (or any description field) to extract these attributes as NEW fields:
   - "extracted_material_type": The type/category of material (e.g., "Granite", "Steel", "Pipe")
   - "extracted_size": Size/dimensions mentioned (e.g., "20mm", "100x50mm")
   - "extracted_finish": Surface finish if mentioned (e.g., "Polished", "Flamed", "Leather Finished")
   - "extracted_color": Color if mentioned
   - "extracted_grade": Grade/quality if mentioned
   - "extracted_brand": Brand name if mentioned
3. If an attribute cannot be determined, omit that field entirely (do NOT add null or empty string)
4. Preserve ALL original fields unchanged

CRITICAL: Return a JSON object with key "records" containing the enriched array. Every input record MUST have a corresponding output record.
Example: {"records": [{"Material": "1000001281", "Material description": "Colombo Jubrana 20mm Flamed", "extracted_material_type": "Granite", "extracted_size": "20mm", "extracted_finish": "Flamed", ...}]}`,

  DUPLICATE_DETECTION: `You are a duplicate detection and golden record agent for SAP material master data. Your job is to identify duplicate records and select the best (golden) record from each group.

Analyze ALL records in the input JSON array and:

1. Group records that refer to the same real-world material/product. Consider:
   - Similar descriptions with different spellings (e.g., "COLOMBO JUBRANA" vs "COLOMBOJUPRANA")
   - Same material with different finishes noted differently
   - Transposed words, abbreviations, typos
   - Same specs but different naming conventions

2. For EACH group of duplicates, select the BEST record as the "golden_record" — the one with:
   - Most complete data (fewest empty fields)
   - Best standardized description
   - Most accurate attributes

3. Return a JSON object with this EXACT structure:
{
  "duplicate_groups": [
    {
      "group_id": "G1",
      "duplicate_reason": "Same granite material (Colombo Jubrana 20mm) with spelling variations and different finishes",
      "records": [<full record objects that belong to this group>],
      "golden_record": {<the single best merged record for this group>}
    }
  ],
  "unique_records": [<records that have no duplicates>],
  "summary": {
    "total_input": <number>,
    "total_groups": <number>,
    "total_duplicates": <number>,
    "total_unique": <number>
  }
}

CRITICAL: Every input record must appear in exactly one group or in unique_records. The golden_record should be the most complete, best-standardized version combining the best data from all records in the group.`
};

export type Config = typeof DEFAULT_CONFIG;

export function getConfig(): Config {
  const stored = localStorage.getItem('quantum_clean_config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Clear stale config that has old AGENTS structure or old endpoint
      if (parsed.AGENTS || parsed.ENDPOINT?.includes('/agents/')) {
        localStorage.removeItem('quantum_clean_config');
        return DEFAULT_CONFIG;
      }
      // Merge with defaults to ensure new fields are always present
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      localStorage.removeItem('quantum_clean_config');
    }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Config) {
  localStorage.setItem('quantum_clean_config', JSON.stringify(config));
}
