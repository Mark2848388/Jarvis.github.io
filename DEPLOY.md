# VEKTOR Cloud Router — deployment

1. Cloudflare Dashboard → Workers & Pages → Create Worker → Edit code → вставьте `worker.js`.
2. Settings → Variables and Secrets → добавьте Secrets:
   - `GROQ_KEYS` — один или несколько Groq API keys через запятую.
   - `OPENROUTER_KEY` — optional; включите только если выбранная модель имеет бесплатный тариф.
   - `GEMINI_API_KEY` — optional; доступность бесплатной квоты зависит от региона и аккаунта.
3. (Optional) Добавьте Workers AI binding с именем `AI` для Cloudflare Workers AI.
4. (Optional) Добавьте KV binding `RL` для почасового ограничения.
5. Проверьте Worker URL в браузере: он вернёт `mode: FREE_ONLY` и список подключённых провайдеров (без ключей).
6. В `ui/config.js` укажите публичный URL Worker. Секреты в frontend не помещать.

Worker сам выбирает доступный провайдер и перебирает модели из allowlist. Не включайте оплату/платный fallback. Условия free-tier меняются — проверяйте официальные тарифы до подключения.

## Голос (распознавание речи)
Worker → Settings → Bindings → Add → **Workers AI** → переменная `AI`. Бесплатная суточная квота Cloudflare; без привязки голос работает только там, где браузер сам умеет распознавать речь.

## Голос ассистента (Edge TTS)
Отдельная настройка не нужна: маршрут `/tts` уже в `worker.js`. После деплоя откройте голосовой экран → ⚙ → «Проверить голос». Если голос Дмитрия не звучит — выберите «Google ♀ (тест)» или «Голос устройства».
