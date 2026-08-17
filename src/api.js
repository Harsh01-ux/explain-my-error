export const explainError = async (errorMessage, codeSnippet, language) => {
  // Triggering HMR to load the new .env variable
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA API Key is not set in environment variables (.env file). Please set VITE_NVIDIA_API_KEY.");
  }

  const systemPrompt = `You are an expert debugging assistant. Your task is to explain the user's error and help them fix it.
You MUST format your response into exactly three sections with the following exact headers (using Markdown H3 '### '):
### What Went Wrong
### Why This Happens
### How to Fix It

Do not add any other sections or headers. Keep your explanations concise, accurate, and easy to understand. Provide code snippets in the "How to Fix It" section if applicable.`;

  const userPrompt = `Language: ${language}
Error Message:
${errorMessage}

Code Snippet:
${codeSnippet || "(No code provided)"}`;

  const response = await fetch("/api/nvidia/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1024,
    })
  });

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
