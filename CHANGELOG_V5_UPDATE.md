# VEKTOR 5.0 — update notes

## Added
- Multi-AI Router with FREE_ONLY allowlists for Groq, OpenRouter free models, Gemini free-tier models, and Cloudflare Workers AI / Worker proxy.
- Provider fallback on quota, authorization, network, and service errors.
- SQLite daily usage/error tracking and configurable local guardrails.
- Router status screen in the chat drawer.
- Safe Markdown renderer for headings, bold/italic, tables, lists, blockquotes, links, and fenced code blocks.
- Response footer with measured elapsed time, action label, and selected provider.
- Stronger VKTR Code system instructions for readable, secure, testable code.
- Configurable local server port through VEKTOR_PORT.

## Safety notes
- No paid model is in the allowlist; unknown model IDs are rejected before a request.
- API credentials belong in server/Worker Secrets, never in browser JavaScript.
- Free-tier terms, model availability, and quotas can change. The allowlist is a local safety guard, not a guarantee that a vendor will never change its pricing. Keep billing disabled and verify official terms before enabling a provider.

- Fixed fatal JavaScript syntax error in the browser bridge.
- Added voice input (browser Web Speech API) and answer read-aloud (device SpeechSynthesis).
- Added multi-file picker for arbitrary file types; text/code formats are included in prompts.
- Added browser-side ZIP export for fenced code blocks from the latest assistant answer.

## Голосовой режим (отдельный экран, кнопка 🎧)
- Полноэкранный разговор как в ChatGPT: шар-индикатор (ожидание / слушаю / думаю / говорю), живой текст речи, перебивание нажатием, режим «без рук» (после ответа снова слушает), пауза, выход по Esc.
- Распознавание бесплатно: Web Speech API; если браузер его не умеет или не слышит (Яндекс.Браузер, WebView) — запись с микрофона и Whisper в Cloudflare Worker (`/stt`, нужна привязка Workers AI с именем `AI`). Порог тишины подстраивается под шум.
- Озвучка бесплатно голосами устройства по предложениям; выбор голоса (♂ помечены), скорость, тембр, «мужской тембр» (если мужского голоса нет — тон понижается). Markdown и код не зачитываются.
- Разговорный режим мышления (`voice`): короткие живые ответы. Весь разговор сохраняется в обычный чат.

## Обновление: интерфейс, чаты, рендер
- Исправлено: таблицы не имели стилей и не распознавались при коротких разделителях (`|:--|`); новый рендер `md.js`: таблицы с выравниванием и прокруткой, `\|` и код в ячейках, вложенные списки, задачи, формулы LaTeX → Unicode, безопасные символы и экранирование, `snake_case` и `2 * 3` больше не превращаются в курсив.
- Единый набор SVG-значков вместо эмодзи; убраны кнопки микрофона и ZIP из строки ввода. Справа в строке ввода — «волна» (голосовой режим), при наборе текста — стрелка отправки.
- Под ответом: Копировать, Поделиться, Озвучить, «ZIP с кодом» (только если в ответе есть код).
- Несколько чатов: обычные, VKTR Code, Учёба; поиск, удаление, пометки режима; режим «Учёба» с репетитором.
- Прикрепление ZIP: структура архива и текстовые файлы читаются прямо в браузере.
- Диагностика: 5 касаний по названию в шторке (движок, C++, Python-модули, облако, голос).
- Голос: тестовый нейроголос Piper (мужские русские голоса), выбирается в настройках голосового экрана.
