export const generatePrompts = (errorMessage, codeSnippet, language, explanationStyle = 'English') => {
  let systemPrompt = `You are an expert debugging assistant. Your task is to explain the user's error and help them fix it.
You MUST format your response into exactly three sections with the following exact headers (using Markdown H3 '### '):
### What Went Wrong
### Why This Happens
### How to Fix It

Do not add any other sections or headers. Keep your explanations concise, accurate, and easy to understand. Provide code snippets in the "How to Fix It" section if applicable.`;

  if (explanationStyle === 'Hinglish') {
    systemPrompt = `You are a debugging assistant for a computer science student in India. Respond in casual Hinglish (a natural mix of Hindi and English, written in Roman/English script, the way Indian students actually talk to each other while debugging) — NOT pure Hindi and NOT formal English. Keep it simple, friendly, and easy to understand, like explaining to a friend. Still respond in exactly three sections with these headers: '### What Went Wrong', '### Why This Happens', and '### How to Fix It'. Keep each section short and beginner-friendly.`;
  }

  const userPrompt = `Language: ${language}
Error Message:
${errorMessage}

Code Snippet:
${codeSnippet || "(No code provided)"}`;

  return { systemPrompt, userPrompt };
};

const makeApiRequest = async (requestBody) => {
  let response;

  // In local development, we use Vite's proxy and provide the key directly.
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("VITE_GEMINI_API_KEY is:", apiKey ? "SET (length: " + apiKey.length + ")" : "UNDEFINED");
    if (!apiKey) {
      throw new Error("Gemini API Key is not set in environment variables (.env file). Please set VITE_GEMINI_API_KEY.");
    }
    response = await fetch("/api/gemini/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
  } else {
    // In production, we call the Vercel serverless function which hides the API key
    response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  }

  if (!response.ok) {
    let errorData = {};
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      errorData = await response.json().catch(() => ({}));
    }
    const errorMessage = errorData?.error?.message || errorData.message || errorData.detail;
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    
    if (response.status === 404 && !import.meta.env.DEV) {
      throw new Error("API endpoint not found. If you are running locally, make sure to use 'npm run dev' instead of preview, or deploy to Vercel for the backend functions to work.");
    }
    
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response generated.";
};

export const explainError = async (errorMessage, codeSnippet, language, explanationStyle = 'English') => {
  const { systemPrompt, userPrompt } = generatePrompts(errorMessage, codeSnippet, language, explanationStyle);

  const requestBody = {
    model: "gemini-3.6-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 4096,
  };

  return await makeApiRequest(requestBody);
};

export const sendFollowUpChat = async (messages) => {
  const requestBody = {
    model: "gemini-3.6-flash",
    messages: messages,
    temperature: 0.2,
    max_tokens: 4096,
  };

  return await makeApiRequest(requestBody);
};

export const parseResponse = (text) => {
  // Remove <think>...</think> reasoning blocks, even if unclosed. Replace with a newline to prevent concatenating surrounding lines.
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '\n');
  
  if (text.trim() === "") {
    text = "The AI model was still thinking and ran out of time/tokens before it could write the final answer. Please try again.";
  }

  const sections = {
    whatWentWrong: "",
    whyThisHappens: "",
    howToFixIt: ""
  };

  const lines = text.split("\n");
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    
    // Check for headers (extremely tolerant: if line contains the phrase and is short, it's a header)
    if (lowerTrimmed.includes("what went wrong") && lowerTrimmed.length < 40) {
      currentSection = "whatWentWrong";
      continue;
    } else if (lowerTrimmed.includes("why this happens") && lowerTrimmed.length < 40) {
      currentSection = "whyThisHappens";
      continue;
    } else if (lowerTrimmed.includes("how to fix it") && lowerTrimmed.length < 40) {
      currentSection = "howToFixIt";
      continue;
    }

    if (currentSection) {
      sections[currentSection] += line + "\n";
    } else if (trimmed !== "") {
      // If it hasn't matched a header yet, just put it in what went wrong
      currentSection = "whatWentWrong";
      sections[currentSection] += line + "\n";
    }
  }

  // Fallback if the model didn't perfectly follow headers
  if (!sections.whatWentWrong.trim() && !sections.whyThisHappens.trim() && !sections.howToFixIt.trim()) {
    sections.whatWentWrong = text;
  }

  return sections;
};
