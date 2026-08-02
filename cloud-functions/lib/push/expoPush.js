"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExpoPushToTokens = sendExpoPushToTokens;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;
async function sendExpoPushToTokens(tokens, payload) {
    const uniqueTokens = [...new Set(tokens.filter((token) => token.startsWith('ExponentPushToken')))];
    if (!uniqueTokens.length) {
        return;
    }
    for (let index = 0; index < uniqueTokens.length; index += CHUNK_SIZE) {
        const chunk = uniqueTokens.slice(index, index + CHUNK_SIZE);
        const messages = chunk.map((to) => ({
            to,
            sound: 'default',
            title: payload.title,
            body: payload.body,
            priority: 'high',
            data: payload.data ?? {},
            ...(payload.channelId ? { channelId: payload.channelId } : {}),
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
//# sourceMappingURL=expoPush.js.map