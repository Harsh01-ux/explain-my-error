const apiKey = "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";

fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "nvidia/llama-3.1-nemotron-70b-instruct",
    messages: [
      { role: "user", content: "Hello" }
    ]
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Response:", await res.text());
}).catch(console.error);
