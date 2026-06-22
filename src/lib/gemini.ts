export interface AIAnalysisResult {
  department: string;
  clientName: string;
  category: string;
  version: string;
  proposedProducts: string[];
  tags: string[];
  confidentiality: string;
  suggestedAccess: string;
  summary: string;
}

export const FALLBACK_RESULT: AIAnalysisResult = {
  department: 'Other',
  clientName: 'General',
  category: 'Other',
  version: '1',
  proposedProducts: [],
  tags: [],
  confidentiality: 'Internal',
  suggestedAccess: 'All Users',
  summary: '',
};

// Models to try in order (most available → newest)
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash-latest',
  'gemini-pro',
];

const PROMPT = `You are a document analyzer for a corporate document repository.
Analyze the document and return ONLY a JSON object — no markdown, no code blocks, just raw JSON.

Required schema:
{
  "department": "Sales | Technical | Finance | Legal | HR | Operations | Other",
  "clientName": "company or client name, or 'General' if unknown",
  "category": "Technical Proposal | Financial Proposal | Contract | RFP | Architecture | Report | Invoice | Other",
  "version": "detected version string, default '1'",
  "proposedProducts": ["items from: Web Portal, Mobile App, Cloud Hosting, Security Audit, OneID SSO, Custom Development"],
  "tags": ["3 to 6 relevant keyword tags"],
  "confidentiality": "Public | Internal | Confidential | Restricted",
  "suggestedAccess": "All Users | Sales & Technical Only | Finance & Legal Only | Admins Only",
  "summary": "1-2 sentence description for search indexing"
}`;

async function tryGeminiModel(
  apiKey: string,
  model: string,
  parts: any[],
  attempt = 1
): Promise<AIAnalysisResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, topK: 1, topP: 1 },
      }),
    });

    if (response.status === 429) {
      // Rate limited — retry after a pause (up to 2 attempts per model)
      console.warn(`Model ${model} rate limited (429), attempt ${attempt}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
        return tryGeminiModel(apiKey, model, parts, attempt + 1);
      }
      return null;
    }
    if (response.status === 503) {
      console.warn(`Model ${model} overloaded (503)`);
      return null;
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Model ${model} error ${response.status}:`, err?.error?.message);
      return null;
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;

    // Parse JSON — handle both raw JSON and markdown-wrapped JSON
    let parsed: AIAnalysisResult;
    try {
      parsed = JSON.parse(textOutput);
    } catch {
      const match = textOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match?.[1]) {
        parsed = JSON.parse(match[1].trim());
      } else {
        // Try to extract the first JSON object from the text
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          return null;
        }
      }
    }

    return { ...FALLBACK_RESULT, ...parsed };
  } catch (err) {
    console.warn(`Model ${model} threw:`, err);
    return null;
  }
}

export async function analyzeDocumentWithGemini(
  apiKey: string,
  documentText: string,
  fileData?: { mimeType: string; base64Data: string } | null,
  onProgress?: (msg: string) => void
): Promise<AIAnalysisResult> {
  if (!apiKey) {
    throw new Error('No Gemini API key configured. Set VITE_GEMINI_API_KEY in your .env file.');
  }

  const parts: any[] = [];
  if (fileData) {
    parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.base64Data } });
    parts.push({ text: `${PROMPT}\n\nAnalyze the attached file.` });
  } else {
    const textSnippet = documentText.substring(0, 25000);
    parts.push({ text: `${PROMPT}\n\nDocument text to analyze:\n---\n${textSnippet}\n---` });
  }

  // Try each model in order until one works
  for (const model of GEMINI_MODELS) {
    onProgress?.(`Trying ${model}...`);
    const result = await tryGeminiModel(apiKey, model, parts);
    if (result) {
      onProgress?.(`Success with ${model}`);
      return result;
    }
    // Small delay before trying next model
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(
    `All Gemini models failed. Check your API key and ensure the Generative Language API is enabled in Google Cloud Console.`
  );
}
