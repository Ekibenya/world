export function buildChatRequest(config, messages) {
  return {
    model: config.model,
    messages,
    temperature: Number(config.temperature ?? 0.8),
    max_tokens: Number(config.maxTokens ?? 1600),
  };
}

export function responseText(body) {
  const choice = body?.choices?.[0]?.message?.content;
  if (typeof choice === 'string') return choice;
  if (Array.isArray(choice)) return choice.map((item) => item.text || item.content || '').join('');
  if (typeof body?.output_text === 'string') return body.output_text;
  const output = body?.output
    ?.flatMap((item) => item.content || [])
    .map((item) => item.text || '')
    .join('');
  return output || '';
}

export async function requestChatCompletion(config, messages, fetchImpl = fetch) {
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(buildChatRequest(config, messages)),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `接口请求失败（${response.status}）`);
  const content = responseText(body);
  if (!content) throw new Error('接口返回成功，但没有可显示的文本。');
  return content;
}
