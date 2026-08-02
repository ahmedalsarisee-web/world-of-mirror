const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
}

export async function sendExpoPushToTokens(
  tokens: string[],
  payload: ExpoPushPayload,
): Promise<void> {
  const uniqueTokens = [...new Set(tokens.filter((token) => token.startsWith('ExponentPushToken')))];
  if (!uniqueTokens.length) {
    return;
  }

  for (let index = 0; index < uniqueTokens.length; index += CHUNK_SIZE) {
    const chunk = uniqueTokens.slice(index, index + CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      priority: 'high' as const,
      data: payload.data ?? {},
      ...(payload.channelId ? {channelId: payload.channelId} : {}),
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[expoPush] Request failed', response.status, text);
    }
  }
}
