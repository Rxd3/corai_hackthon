import OpenAI from "openai";
import { requireEnv } from "./http.js";

const DEFAULT_OPENAI_MODEL = "gpt-5";

let client;

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

export async function generateStructuredJson({ instructions, input, schema, name, description }) {
  const response = await getOpenAIClient().responses.create({
    model: getOpenAIModel(),
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name,
        description,
        schema,
        strict: true,
      },
    },
  });

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty structured response.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenAI returned invalid JSON for the requested structure.");
  }
}

export async function generateText({ instructions, input }) {
  const response = await getOpenAIClient().responses.create({
    model: getOpenAIModel(),
    instructions,
    input,
  });

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}
