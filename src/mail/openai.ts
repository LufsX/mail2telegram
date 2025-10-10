export async function sendOpenAIRequest(key: string, endpoint: string, model: string, prompt: string): Promise<string> {
  if (!key || !endpoint || !model) {
    return "Sorry, the OpenAI API is not configured properly.";
  }
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是一位专业的电子邮件摘要助手，负责完美的将各个类别的电子邮件进行摘要总结，你会完美的遵循格式规范，比如中英文之间空格，链接与文本之间空格。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI API request failed: ${resp.status}`);
  }
  const body = (await resp.json()) as any;
  return body?.choices?.[0]?.message?.content || "";
}
