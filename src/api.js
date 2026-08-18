export const explainError = async (errorMessage, codeSnippet, language, explanationStyle = 'English') => {
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

  const requestBody = {
    model: "meta/llama-3.1-70b-instruct",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 1024,
  };

  let response;

  // In local development, we use Vite's proxy and provide the key directly.
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error("NVIDIA API Key is not set in environment variables (.env file). Please set VITE_NVIDIA_API_KEY.");
    }
    response = await fetch("/api/nvidia/v1/chat/completions", {
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "No response generated.";
};

export const parseResponse = (text) => {
  const sections = {
    whatWentWrong: "",
    whyThisHappens: "",
    howToFixIt: ""
  };

  const lines = text.split("\n");
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes("what went wrong") && line.startsWith("#")) {
      currentSection = "whatWentWrong";
      continue;
    } else if (trimmed.toLowerCase().includes("why this happens") && line.startsWith("#")) {
      currentSection = "whyThisHappens";
      continue;
    } else if (trimmed.toLowerCase().includes("how to fix it") && line.startsWith("#")) {
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
