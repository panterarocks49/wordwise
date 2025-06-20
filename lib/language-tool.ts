// LanguageTool API integration for grammar checking

// Define the shape of the JSON response based on actual API response
export interface LTMatch {
  message: string;
  shortMessage: string;
  replacements: { 
    value: string;
    shortDescription?: string;
  }[];
  offset: number;
  length: number;
  context: { text: string; offset: number; length: number };
  sentence: string;
  type: {
    typeName: string;
  };
  rule: { 
    id: string; 
    subId?: string;
    sourceFile?: string;
    description: string;
    issueType: string;
    urls?: { value: string }[];
    category: {
      id: string;
      name: string;
    };
  };
  ignoreForIncompleteSentence: boolean;
  contextForSureMatch: number;
}

export interface LTResponse {
  software: { 
    name: string; 
    version: string;
    buildDate: string;
    apiVersion: number;
    premium: boolean;
    premiumHint: string;
    status: string;
  };
  warnings: {
    incompleteResults: boolean;
  };
  language: { 
    code: string; 
    name: string;
    detectedLanguage: {
      name: string;
      code: string;
      confidence: number;
      source: string;
    };
  };
  matches: LTMatch[];
  sentenceRanges: number[][];
  extendedSentenceRanges: {
    from: number;
    to: number;
    detectedLanguages: {
      language: string;
      rate: number;
    }[];
  }[];
}

// A helper that does a POST form-encoded check
export async function checkGrammar(
  text: string,
  language: string = "en-US"
): Promise<LTResponse> {
  const url = "https://language-tool-731522c86492.herokuapp.com/v2/check";

  // Build form data - basic free version parameters only
  const body = new URLSearchParams();
  body.append("language", language);
  body.append("text", text);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      // LanguageTool expects url-encoded forms
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`LanguageTool error: ${res.status} ${res.statusText}`);
  }

  // Parse JSON into our typed interface
  return (await res.json()) as LTResponse;
} 