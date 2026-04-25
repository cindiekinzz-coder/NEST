/**
 * NESTeq Gateway — Discord Tools
 * Uses service binding to call discord-mcp worker directly (avoids workers.dev loop detection)
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Env } from '../env'

async function callDiscord(
  env: Env,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const secret = env.DISCORD_MCP_SECRET
  if (!secret) return { content: [{ type: 'text', text: 'Discord not configured — DISCORD_MCP_SECRET missing.' }] }

  const res = await env.DISCORD_MCP_SERVICE.fetch(
    `${env.DISCORD_MCP_URL}/mcp/${secret}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    }
  )

  const text = await res.text()

  // Handle SSE
  if (text.includes('data: ')) {
    const lines = text.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('data: ')) {
        try {
          const data = JSON.parse(lines[i].slice(6))
          if (data.result?.content) return data.result
          if (data.error) return { content: [{ type: 'text', text: `Discord Error: ${JSON.stringify(data.error)}` }] }
        } catch { /* keep looking */ }
      }
    }
  }

  try {
    const data = JSON.parse(text)
    if (data.result?.content) return data.result
    if (data.error) return { content: [{ type: 'text', text: `Discord Error: ${JSON.stringify(data.error)}` }] }
    return { content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }] }
  } catch {
    return { content: [{ type: 'text', text: text.slice(0, 500) }] }
  }
}

export function registerDiscordTools(server: McpServer, env: Env) {
  if (!env.DISCORD_MCP_SECRET) return

  server.tool('discord_list_servers', 'List Discord servers the bot is in', {}, async () => {
    return callDiscord(env, 'discord_list_servers', {})
  })

  server.tool('discord_get_server_info', 'Get info about a Discord server', {
    guildId: z.string().describe('Discord server/guild ID'),
  }, async (args) => {
    return callDiscord(env, 'discord_get_server_info', args)
  })

  server.tool('discord_read_messages', 'Read recent messages from a Discord channel', {
    channelId: z.string().describe('Discord channel ID'),
    limit: z.number().optional().describe('Number of messages to fetch (default 50)'),
  }, async (args) => {
    return callDiscord(env, 'discord_read_messages', args)
  })

  server.tool('discord_send', 'Send a message to a Discord channel', {
    channelId: z.string().describe('Discord channel ID'),
    message: z.string().describe('Message content to send'),
  }, async (args) => {
    return callDiscord(env, 'discord_send', args)
  })

  server.tool('discord_search_messages', 'Search for messages in a Discord server', {
    guildId: z.string().describe('Discord server/guild ID'),
    content: z.string().describe('Search query'),
    limit: z.number().optional(),
  }, async (args) => {
    return callDiscord(env, 'discord_search_messages', args)
  })

  server.tool('discord_add_reaction', 'Add a reaction to a Discord message', {
    channelId: z.string().describe('Channel ID'),
    messageId: z.string().describe('Message ID'),
    emoji: z.string().describe('Emoji to react with'),
  }, async (args) => {
    return callDiscord(env, 'discord_add_reaction', args)
  })

  server.tool('discord_fetch_image', 'Fetch an image from a Discord message', {
    channelId: z.string().describe('Channel ID'),
    messageId: z.string().describe('Message ID'),
  }, async (args) => {
    return callDiscord(env, 'discord_fetch_image', args)
  })
}
