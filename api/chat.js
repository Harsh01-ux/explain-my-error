export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  // Support both variable names for flexibility in Vercel settings
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ message: "Gemini API Key is not set in Vercel environment variables." });
  }

  try {
    const apiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(request.body)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      return response.status(apiResponse.status).json({ 
        message: errorData?.error?.message || errorData.message || errorData.detail || `API request failed with status ${apiResponse.status}` 
      });
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
}


