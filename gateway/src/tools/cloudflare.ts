/**
 * NESTeq Gateway — Cloudflare API Tools
 * Direct access to Cloudflare account — workers, D1, R2, Pages
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Env } from '../env'

const CF_BASE = 'https://api.cloudflare.com/client/v4'

async function cfFetch(path: string, apiToken: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CF API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] }
}

export function registerCloudflareTools(server: McpServer, env: Env) {
  const token = env.CLOUDFLARE_API_TOKEN
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !accountId) return // Skip if not configured

  // ── Workers ──
  server.tool('cf_workers_list', 'List all deployed Cloudflare Workers', {}, async () => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/workers/scripts`, token)
      const workers = (data.result || []).map((w: any) => ({
        name: w.id,
        modified: w.modified_on,
        routes: w.routes?.length ?? 0,
      }))
      return ok(workers)
    } catch (e) { return err(e) }
  })

  server.tool('cf_worker_get', 'Get details about a specific Worker', {
    name: z.string().describe('Worker script name'),
  }, async ({ name }) => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/workers/scripts/${name}`, token)
      return ok(data.result)
    } catch (e) { return err(e) }
  })

  // ── D1 ──
  server.tool('cf_d1_list', 'List all D1 databases in the account', {}, async () => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/d1/database`, token)
      const dbs = (data.result || []).map((d: any) => ({
        name: d.name,
        id: d.uuid,
        created: d.created_at,
        file_size: d.file_size,
      }))
      return ok(dbs)
    } catch (e) { return err(e) }
  })

  server.tool('cf_d1_query', 'Run a SQL query against a D1 database', {
    database_name: z.string().describe('D1 database name (e.g. ai-mind, fox-mind)'),
    sql: z.string().describe('SQL query to run'),
    params: z.array(z.string()).optional().describe('Query parameters'),
  }, async ({ database_name, sql, params }) => {
    try {
      // First resolve name to ID
      const list = await cfFetch(`/accounts/${accountId}/d1/database`, token)
      const db = (list.result || []).find((d: any) => d.name === database_name)
      if (!db) return err(`Database "${database_name}" not found`)

      const data = await cfFetch(`/accounts/${accountId}/d1/database/${db.uuid}/query`, token, {
        method: 'POST',
        body: JSON.stringify({ sql, params: params || [] }),
      })
      return ok(data.result)
    } catch (e) { return err(e) }
  })

  // ── R2 ──
  server.tool('cf_r2_list', 'List all R2 buckets', {}, async () => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/r2/buckets`, token)
      const buckets = (data.result?.buckets || []).map((b: any) => ({
        name: b.name,
        created: b.creation_date,
      }))
      return ok(buckets)
    } catch (e) { return err(e) }
  })

  server.tool('cf_r2_list_objects', 'List objects in an R2 bucket', {
    bucket: z.string().describe('Bucket name'),
    prefix: z.string().optional().describe('Filter by key prefix'),
    limit: z.number().optional().describe('Max results (default 100)'),
  }, async ({ bucket, prefix, limit }) => {
    try {
      let path = `/accounts/${accountId}/r2/buckets/${bucket}/objects?per_page=${limit ?? 100}`
      if (prefix) path += `&prefix=${encodeURIComponent(prefix)}`
      const data = await cfFetch(path, token)
      return ok(data.result)
    } catch (e) { return err(e) }
  })

  // ── Pages ──
  server.tool('cf_pages_list', 'List all Cloudflare Pages projects and recent deployments', {}, async () => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/pages/projects`, token)
      const projects = (data.result || []).map((p: any) => ({
        name: p.name,
        domain: p.subdomain,
        latest_deployment: p.latest_deployment?.created_on,
        latest_url: p.latest_deployment?.url,
      }))
      return ok(projects)
    } catch (e) { return err(e) }
  })

  server.tool('cf_pages_deployments', 'Get recent deployments for a Pages project', {
    project: z.string().describe('Pages project name (e.g. nesteq)'),
    limit: z.number().optional(),
  }, async ({ project, limit }) => {
    try {
      const data = await cfFetch(
        `/accounts/${accountId}/pages/projects/${project}/deployments?per_page=${limit ?? 5}`,
        token
      )
      const deployments = (data.result || []).map((d: any) => ({
        id: d.id,
        url: d.url,
        created: d.created_on,
        status: d.latest_stage?.status,
        branch: d.deployment_trigger?.metadata?.branch,
      }))
      return ok(deployments)
    } catch (e) { return err(e) }
  })

  // ── KV ──
  server.tool('cf_kv_list', 'List all KV namespaces', {}, async () => {
    try {
      const data = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces`, token)
      const ns = (data.result || []).map((n: any) => ({ name: n.title, id: n.id }))
      return ok(ns)
    } catch (e) { return err(e) }
  })

  // ── Account Overview ──
  server.tool('cf_status', 'Quick overview — workers count, D1 databases, Pages projects, R2 buckets', {}, async () => {
    try {
      const [workers, d1, pages, r2] = await Promise.all([
        cfFetch(`/accounts/${accountId}/workers/scripts`, token),
        cfFetch(`/accounts/${accountId}/d1/database`, token),
        cfFetch(`/accounts/${accountId}/pages/projects`, token),
        cfFetch(`/accounts/${accountId}/r2/buckets`, token),
      ])
      return ok({
        workers: (workers.result || []).length,
        d1_databases: (d1.result || []).map((d: any) => d.name),
        pages_projects: (pages.result || []).map((p: any) => p.name),
        r2_buckets: (r2.result?.buckets || []).map((b: any) => b.name),
      })
    } catch (e) { return err(e) }
  })
}
