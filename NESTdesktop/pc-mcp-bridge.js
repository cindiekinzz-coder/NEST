#!/usr/bin/env node
/**
 * PC Tools MCP Bridge
 * 
 * Translates MCP JSON-RPC protocol to NESTdesktop HTTP API
 * Run NESTdesktop server first: npm run dev
 * 
 * Embers Remember.
 */

const readline = require('readline');

const PC_API = 'http://localhost:3001/pc';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Tool definitions for MCP
const TOOLS = {
  pc_shell: {
    description: 'Execute shell commands via NESTdesktop',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
        timeout: { type: 'number', description: 'Timeout in ms (optional, max 600000)' }
      },
      required: ['command']
    }
  },
  pc_file_read: {
    description: 'Read file contents with line numbers',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        offset: { type: 'number', description: 'Line offset (optional)' },
        limit: { type: 'number', description: 'Max lines (optional, default 2000)' }
      },
      required: ['path']
    }
  },
  pc_file_write: {
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        content: { type: 'string', description: 'File content' }
      },
      required: ['path', 'content']
    }
  },
  pc_file_edit: {
    description: 'Edit file using exact string replacement',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        old_string: { type: 'string', description: 'String to replace' },
        new_string: { type: 'string', description: 'Replacement string' }
      },
      required: ['path', 'old_string', 'new_string']
    }
  },
  pc_glob: {
    description: 'Find files matching glob pattern',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.js")' },
        cwd: { type: 'string', description: 'Search directory (optional)' }
      },
      required: ['pattern']
    }
  },
  pc_grep: {
    description: 'Search file contents with regex',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        path: { type: 'string', description: 'File or directory to search' },
        file_pattern: { type: 'string', description: 'Glob filter (optional)' }
      },
      required: ['pattern']
    }
  },
  pc_screenshot: {
    description: 'Capture screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        display: { type: 'number', description: 'Display number (optional)' }
      }
    }
  },
  pc_clipboard_get: {
    description: 'Get clipboard text',
    inputSchema: { type: 'object', properties: {} }
  },
  pc_clipboard_set: {
    description: 'Set clipboard text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy' }
      },
      required: ['text']
    }
  },
  pc_app_launch: {
    description: 'Launch application',
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Application name or path' }
      },
      required: ['app']
    }
  },
  pc_process_list: {
    description: 'List running processes',
    inputSchema: { type: 'object', properties: {} }
  },
  pc_web_scrape: {
    description: 'Scrape web page content',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to scrape' }
      },
      required: ['url']
    }
  }
};

// Map MCP tool names to API endpoints
const ENDPOINT_MAP = {
  pc_shell: '/shell',
  pc_file_read: '/file/read',
  pc_file_write: '/file/write',
  pc_file_edit: '/file/edit',
  pc_glob: '/glob',
  pc_grep: '/grep',
  pc_screenshot: '/screenshot',
  pc_clipboard_get: '/clipboard/get',
  pc_clipboard_set: '/clipboard/set',
  pc_app_launch: '/app/launch',
  pc_process_list: '/process/list',
  pc_web_scrape: '/web/scrape'
};

async function handleRequest(request) {
  const { method, params, id } = request;

  try {
    // Handle MCP protocol methods
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '0.1.0',
          serverInfo: {
            name: 'nesteq-pc-tools',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
        }
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: Object.entries(TOOLS).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: def.inputSchema
          }))
        }
      };
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      const endpoint = ENDPOINT_MAP[name];
      if (!endpoint) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Make HTTP request to NESTdesktop
      const response = await fetch(`${PC_API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${error}`);
      }

      const result = await response.json();

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    }

    throw new Error(`Unknown method: ${method}`);

  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
}

// Process incoming MCP requests
rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    const response = await handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: `Parse error: ${error.message}`
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
});

rl.on('close', () => {
  process.exit(0);
});
