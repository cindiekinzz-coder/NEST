/**
 * NESTeq Gateway — Proxy Layer
 * Adapted from Nexus Gateway (Apache 2.0, amarisaster/Nexus-Gateway)
 * Handles both REST and MCP backends transparently
 */

/**
 * Parse MCP response — handles both JSON and SSE (text/event-stream) formats
 */
async function parseMcpResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('Content-Type') || ''
  const text = await res.text()

  try {
    if (contentType.includes('text/event-stream')) {
      const lines = text.split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('data: ')) {
          return JSON.parse(lines[i].slice(6))
        }
      }
      return { error: { message: 'No data in SSE response' } }
    }

    return JSON.parse(text)
  } catch (e) {
    const preview = text.length > 200 ? text.slice(0, 200) + '...' : text
    return { error: { message: `Failed to parse MCP response: ${(e as Error).message}. Preview: ${preview}` } }
  }
}

/**
 * Forward a tool call to a REST endpoint and return MCP-formatted result
 */
export async function proxyRest(
  url: string,
  body: Record<string, unknown> = {},
  method: string = 'POST',
  extraHeaders: Record<string, string> = {}
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  let result: string
  try {
    const json = JSON.parse(text)
    result = JSON.stringify(json, null, 2)
  } catch {
    result = text
  }

  if (!response.ok) {
    return { content: [{ type: 'text', text: `Error ${response.status}: ${result}` }] }
  }
  return { content: [{ type: 'text', text: result }] }
}

/**
 * Forward a tool call via MCP JSON-RPC protocol (path-based auth variant)
 * Use this when the MCP endpoint is a full URL like https://host/mcp/SECRET
 */
export async function proxyMcpDirect(
  mcpEndpoint: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const mcpHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }

  // Initialize session
  const initRes = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nesteq-gateway', version: '1.0' }
      }
    })
  })

  const sessionId = initRes.headers.get('Mcp-Session-Id')
  await initRes.text()

  // Call the tool
  const callRes = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: {
      ...mcpHeaders,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  })

  const data = await parseMcpResponse(callRes)
  if (data.error) {
    return { content: [{ type: 'text', text: `MCP Error: ${data.error.message}` }] }
  }

  if (data.result?.content) {
    return data.result
  }

  return { content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }] }
}

/**
 * Forward a tool call via MCP JSON-RPC protocol
 */
export async function proxyMcp(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  authHeader?: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const mcpHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }
  if (authHeader) mcpHeaders['Authorization'] = authHeader

  // Initialize session
  const initRes = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: mcpHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nesteq-gateway', version: '1.0' }
      }
    })
  })

  const sessionId = initRes.headers.get('Mcp-Session-Id')
  await initRes.text()

  // Call the tool
  const callRes = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      ...mcpHeaders,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  })

  const data = await parseMcpResponse(callRes)
  if (data.error) {
    return { content: [{ type: 'text', text: `MCP Error: ${data.error.message}` }] }
  }

  if (data.result?.content) {
    return data.result
  }

  return { content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }] }
}
