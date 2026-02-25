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
