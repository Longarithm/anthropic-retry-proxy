# anthropic-retry-proxy

Lightweight Node.js proxy that adds automatic retry with exponential backoff for Anthropic API 5xx errors. Zero dependencies.

## Usage

```bash
node proxy.mjs
```

The proxy listens on `http://127.0.0.1:3980` and forwards requests to `https://api.anthropic.com`. Point your Anthropic client at the proxy URL instead of the real API.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3980` | Proxy listen port |
| `MAX_RETRIES` | `3` | Max attempts per request |
| `BASE_DELAY` | `1000` | Base retry delay in ms (doubles each attempt) |

## Example output

```
2026-02-25T18:10:02.815Z [#81] POST /v1/messages/count_tokens?beta=true model=claude-opus-4-6
2026-02-25T18:10:03.611Z [#81] RETRY 500 attempt 1/3 (795ms), waiting 1000ms — {"type":"error","error":{"type":"api_error","message":"Internal server error"}}
2026-02-25T18:10:15.306Z [#81] RETRY 500 attempt 2/3 (10694ms), waiting 2000ms — {"type":"error","error":{"type":"api_error","message":"Internal server error"}}
2026-02-25T18:10:27.688Z [#81] 200 (10377ms) attempt 3/3
2026-02-25T18:10:27.725Z [#82] POST /v1/messages?beta=true model=claude-opus-4-6
2026-02-25T18:10:30.475Z [#82] 200 (2750ms) attempt 1/3
```

## Health check

```bash
curl http://127.0.0.1:3980/health
```

## macOS launchd service

A sample plist is included. Edit paths in `com.anthropic-retry-proxy.plist`, then:

```bash
cp com.anthropic-retry-proxy.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.anthropic-retry-proxy.plist
```
