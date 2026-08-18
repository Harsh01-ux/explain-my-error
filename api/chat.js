export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  // Support both variable names for flexibility in Vercel settings
  const apiKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ message: "NVIDIA API Key is not set in Vercel environment variables." });
  }

  try {
    const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(request.body)
    });

    if (!nvidiaResponse.ok) {
      const errorData = await nvidiaResponse.json().catch(() => ({}));
      return response.status(nvidiaResponse.status).json({ 
        message: errorData.message || `API request failed with status ${nvidiaResponse.status}` 
      });
    }

    const data = await nvidiaResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
}
