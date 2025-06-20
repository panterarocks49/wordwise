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

// Function definition for OpenAI function calling
const grammarCheckFunction = {
  name: "grammar_check",
  description: "Identify grammar, spelling, and style mistakes in a paragraph",
  parameters: {
    type: "object",
    properties: {
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Error category (e.g., 'subject-verb agreement', 'spelling', 'punctuation', 'clarity', 'word choice')"
            },
            description: {
              type: "string",
              description: "Detailed explanation of the error"
            },
            start: {
              type: "integer",
              description: "Character position where the error starts (0-based)"
            },
            end: {
              type: "integer",
              description: "Character position where the error ends (0-based)"
            },
            suggestion: {
              type: "string",
              description: "Suggested replacement text"
            }
          },
          required: ["type", "description", "start", "end", "suggestion"]
        }
      }
    },
    required: ["errors"]
  }
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
          content: `You are an expert English grammar and style assistant. Your task is to identify grammar mistakes, spelling errors, punctuation issues, and style improvements in the given text.

Focus on:
- Grammar errors (subject-verb agreement, tense consistency, etc.)
- Spelling mistakes
- Punctuation errors
- Clarity and conciseness issues
- Word choice improvements

Be precise with character positions (0-based indexing). Only flag genuine errors, not stylistic preferences unless they significantly impact clarity.`
        },
        {
          role: "user",
          content: `Please check the following text for grammar, spelling, and style issues:\n\n"${text}"`
        }
      ],
      functions: [grammarCheckFunction],
      function_call: { name: "grammar_check" },
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 1000
    })

    const functionCall = completion.choices[0]?.message?.function_call
    if (!functionCall || functionCall.name !== 'grammar_check') {
      console.warn('🤖 AI Grammar: No function call in response')
      return []
    }

    try {
      const args = JSON.parse(functionCall.arguments)
      return args.errors || []
    } catch (parseError) {
      console.error('🤖 AI Grammar: Failed to parse function call arguments:', parseError)
      return []
    }

  } catch (error) {
    console.error('🤖 AI Grammar: OpenAI API error:', error)
    return []
  }
} 