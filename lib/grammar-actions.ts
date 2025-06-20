'use server'

import OpenAI from 'openai'

// Define the grammar error interface matching OpenAI's response
interface GrammarError {
  type: string
  description: string
  start: number
  end: number
  suggestion: string
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// JSON Schema for structured outputs
const grammarCheckSchema = {
  name: "grammar_check_response",
  description: "Grammar and style checking response with precise character positions",
  schema: {
    type: "object",
    properties: {
      errors: {
        type: "array",
        description: "Array of grammar, spelling, and style errors found in the text",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Error category (e.g., 'subject-verb agreement', 'spelling', 'punctuation')"
            },
            description: {
              type: "string",
              description: "Brief explanation of the error"
            },
            start: {
              type: "integer",
              description: "0-based character position where error starts (inclusive)"
            },
            end: {
              type: "integer",
              description: "0-based character position where error ends (exclusive)"
            },
            suggestion: {
              type: "string",
              description: "Corrected text to replace the error"
            }
          },
          required: ["type", "description", "start", "end", "suggestion"],
          additionalProperties: false
        }
      }
    },
    required: ["errors"],
    additionalProperties: false
  },
  strict: true
}

export async function checkGrammarWithAI(text: string): Promise<GrammarError[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('🤖 AI Grammar: OpenAI API key not configured')
      return []
    }

    if (!text.trim()) {
      return []
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `You are GrammarlyAI, an expert copy-editor tasked with detecting and fixing objective writing errors.

GOAL
Return every sentence that contains at least one grammar, spelling, punctuation, or clear-word-choice error, together with the fully corrected sentence and its character span in the original text.

OUTPUT (MUST MATCH PROVIDED JSON SCHEMA ONLY)
If errors exist:
  {"errors":[ErrorObj, ErrorObj, ...]}
If the text is perfectly fine:
  {"errors":[]}
No code fences, no additional keys, no commentary.

ErrorObj fields:
• type        – one of "grammar", "spelling", "punctuation", "word-choice", or "multiple" (if several kinds occur)
• description – short human explanation
• start       – 0-based index of the first character of the sentence (inclusive)
• end         – 0-based index AFTER the last character of that sentence (exclusive)
• suggestion  – the fully corrected form of the whole sentence

HOW TO WORK
1. Split the input into sentences using common punctuation (.!?). Include trailing punctuation with the sentence.
2. For each sentence, decide if it has any objective mistakes:
   a. Grammar (subject-verb agreement, tense, plurality, pronouns, articles)
   b. Spelling (misspelled words)
   c. Punctuation (missing comma before conjunction joining two independent clauses, missing apostrophe in contractions, doubled punctuation, etc.)
   d. Word choice that creates a clear error (their/there, affect/effect, your/you're, etc.)
3. If a sentence has at least one mistake, classify the main category (or "multiple") and craft a corrected version that fixes ALL mistakes while preserving style and meaning.
4. Calculate start & end indices in the ORIGINAL text:
   • start = index of the sentence's first character (inclusive)
   • end   = index AFTER its final character (exclusive) – usually 1 past the period, exclamation, or question mark. If there is immediate trailing whitespace (spaces, tabs, line-breaks) that belongs to that sentence in the original text, INCLUDE it so that slice(start,end) exactly matches the source substring.
5. Double-check: text.slice(start, end) must equal the exact original sentence INCLUDING any such trailing whitespace.
6. Build the ErrorObj. Repeat for every faulty sentence.

RULES & GUARDRAILS
• 0-based character indexing only.
• Count EVERY character: letters, digits, spaces, line breaks, tabs, punctuation.
• Be objective: do NOT suggest stylistic rephrasing unless it directly fixes an error.
• Do NOT add or remove sentences.
• If no errors are present, return {"errors":[]}. Do NOT fabricate issues.

EXAMPLES
Input: He go to store. I am happy
Output:
{"errors":[
  {"type":"grammar","description":"Singular subject 'He' requires 'goes'.","start":0,"end":16,"suggestion":"He goes to store."}
]}

Input: She walk fast! They is late.
Output:
{"errors":[
  {"type":"grammar","description":"Singular subject 'She' requires 'walks'.","start":0,"end":15,"suggestion":"She walks fast!"},
  {"type":"grammar","description":"Plural subject 'They' requires 'are'.","start":16,"end":30,"suggestion":"They are late."}
]}

REMEMBER
Return one ErrorObj per faulty sentence. Highlight the full sentence span. Preserve meaning. No extra keys or explanations.`
        },
        {
          role: "user",
          content: `Check this text and provide exact 0-based character positions for any errors:

"${text}"`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: grammarCheckSchema
      },
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 1000
    })

    const responseContent = completion.choices[0]?.message?.content
    if (!responseContent) {
      console.warn('🤖 AI Grammar: No content in response')
      return []
    }

    try {
      const parsedResponse = JSON.parse(responseContent)
      const errors = parsedResponse.errors || []
      
      // Filter out invalid errors and other malformed responses
      const validErrors = errors.filter((error: any) => {
        // Skip "none" type errors
        if (error.type === 'none' || error.type === 'no errors' || error.type === 'no error') {
          return false
        }
        
        // Skip errors with empty or whitespace-only suggestions
        if (!error.suggestion || !error.suggestion.trim()) {
          return false
        }
        
        // Skip errors with invalid positions
        if (error.start < 0 || error.end <= error.start) {
          return false
        }
        
        // Skip errors with empty descriptions
        if (!error.description || !error.description.trim()) {
          return false
        }
        
        return true
      })
      
      return validErrors
    } catch (parseError) {
      console.error('🤖 AI Grammar: Failed to parse response content:', parseError)
      return []
    }

  } catch (error) {
    console.error('🤖 AI Grammar: OpenAI API error:', error)
    return []
  }
} 