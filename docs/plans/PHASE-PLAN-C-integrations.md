# Phase C: Integration Backends - Implementation Plan

**Phase:** 9 (TDD Build)
**Features:** FEAT-006 (Claude API), FEAT-007 (WebSocket Bridge), FEAT-008 (MCP Server)
**Branch:** feature/FEAT-006-claude-api, feature/FEAT-007-ws-bridge, feature/FEAT-008-mcp-server
**Status:** planned
**Depends on:** Phase A complete

---

## Objective
Implement three distinct backends for delivering transcribed text to Claude Code.

---

## FEAT-006: Claude API Direct

### Design
Standalone voice-to-Claude interface. Transcribed text sent directly to Claude API.

### Sub-tasks
1. Anthropic SDK integration in backend
2. API key management (from .env, never exposed to frontend)
3. Conversation history management (in-memory per session)
4. REST endpoint `POST /chat` - send message, receive response
5. WebSocket streaming for Claude response
6. Frontend: Conversation display component
7. SIT: Full transcribe -> Claude -> response flow

### Key Decisions
- Model: configurable (default: claude-sonnet-4-5)
- System prompt: configurable via settings
- Max tokens: configurable (default: 4096)

---

## FEAT-007: WebSocket Bridge to Claude Code

### Design (CRITICAL FINDING from research)
Claude Code has a `--sdk-url` flag that connects to a WebSocket server using NDJSON protocol. Community project "Companion" has reverse-engineered this protocol.

### Approach Options
1. **Claude Agent SDK (Official)** - Use the official Python/TypeScript SDK to launch and control Claude Code sessions programmatically
2. **--sdk-url WebSocket Server** - Run a WebSocket server that Claude Code connects to, inject user messages
3. **Clipboard + OS automation** - Fallback: copy text to clipboard, simulate paste into terminal

### Sub-tasks
1. Research claude-agent-sdk-python for programmatic session control
2. Implement WebSocket server that accepts Claude Code connections
3. Message injection via NDJSON protocol
4. Connection status monitoring
5. Frontend: Connection indicator, bridge status
6. SIT: Transcribe -> bridge -> Claude Code receives text

### Risks
- Protocol may change between Claude Code versions
- SDK may not support all interaction patterns
- Fallback to clipboard injection if protocol approach fails

---

## FEAT-008: MCP Server Integration

### Design
Build an MCP server tool that Claude Code can call to receive voice input.

### Approach
1. MCP tool `voice_input` - when called by Claude, starts recording session
2. Returns transcribed text as tool result
3. Claude uses the text as if user typed it

### Sub-tasks
1. MCP server with `get_voice_input` tool
2. WebSocket connection to our backend for audio capture
3. Blocking wait for transcription result
4. Return text to Claude Code
5. SIT: Claude calls MCP tool -> user speaks -> text returned

### Integration with existing bacon-voice MCP
Consider extending the existing bacon-ai-voice-mcp rather than building from scratch.

---

## Gate: Phase C Complete

- [ ] At least one integration backend successfully delivers text to Claude
- [ ] Claude API direct: voice -> transcribe -> Claude response displayed
- [ ] WebSocket bridge: feasibility confirmed or documented as infeasible
- [ ] MCP server: voice_input tool callable from Claude Code
- [ ] SIT evidence for each working backend
