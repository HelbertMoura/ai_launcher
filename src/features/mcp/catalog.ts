import { isValidMcpName, type McpTransport } from "./types";

/**
 * A pre-filled MCP server template the user can add with one click.
 *
 * The catalog only *populates* a CLI's config file — it never installs anything
 * over the network. `command`/`args` are the launch line a CLI would run; the
 * actual fetch (e.g. `npx -y <pkg>`) happens lazily when the CLI first starts
 * the server, not here.
 */
export interface McpCatalogEntry {
  /** Stable id used as React key and for lookups. */
  id: string;
  /** Default server name pre-filled into the add dialog (user can change it). */
  name: string;
  /** Short human label. */
  label: string;
  /** One-line description of what the server provides. */
  description: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  /** Env var keys this server typically needs (values left for the user). */
  envKeys?: string[];
  /** Optional homepage / docs link. */
  homepage?: string;
}

/**
 * Embedded catalog of popular MCP servers. Commands favour `npx -y` (Node) or
 * `uvx` (Python) so nothing is installed up-front.
 */
export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    id: "context7",
    name: "context7",
    label: "Context7",
    description: "Documentação atualizada de bibliotecas e frameworks.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@latest"],
    homepage: "https://github.com/upstash/context7",
  },
  {
    id: "github",
    name: "github",
    label: "GitHub",
    description: "Issues, PRs, repositórios e busca de código no GitHub.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    envKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "playwright",
    name: "playwright",
    label: "Playwright",
    description: "Automação de navegador para testes e scraping.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    homepage: "https://github.com/microsoft/playwright-mcp",
  },
  {
    id: "filesystem",
    name: "filesystem",
    label: "Filesystem",
    description: "Acesso de leitura/escrita a um diretório local.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "fetch",
    name: "fetch",
    label: "Fetch",
    description: "Busca conteúdo de URLs e converte para Markdown.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "sequential-thinking",
    name: "sequential-thinking",
    label: "Sequential Thinking",
    description: "Raciocínio passo-a-passo estruturado para o modelo.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "memory",
    name: "memory",
    label: "Memory",
    description: "Grafo de conhecimento persistente entre sessões.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "puppeteer",
    name: "puppeteer",
    label: "Puppeteer",
    description: "Automação de navegador via Puppeteer.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "brave-search",
    name: "brave-search",
    label: "Brave Search",
    description: "Busca na web via API do Brave Search.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    envKeys: ["BRAVE_API_KEY"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "postgres",
    name: "postgres",
    label: "PostgreSQL",
    description: "Consultas somente-leitura a um banco PostgreSQL.",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    envKeys: ["DATABASE_URL"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "sqlite",
    name: "sqlite",
    label: "SQLite",
    description: "Consultas e inspeção de um arquivo de banco SQLite.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "./database.db"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "time",
    name: "time",
    label: "Time",
    description: "Conversões de data/hora e fuso horário.",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-time"],
    homepage: "https://github.com/modelcontextprotocol/servers",
  },
];

/** Returns the catalog entry whose id matches, or `undefined`. */
export function findCatalogEntry(id: string): McpCatalogEntry | undefined {
  return MCP_CATALOG.find((e) => e.id === id);
}

/**
 * Validates that every catalog entry is internally consistent. Used by tests
 * and as a defensive guard if the catalog is ever edited by hand.
 */
export function isCatalogEntryValid(entry: McpCatalogEntry): boolean {
  if (!isValidMcpName(entry.name)) return false;
  if (entry.transport === "stdio") {
    return !!entry.command && entry.command.trim().length > 0;
  }
  return !!entry.url && entry.url.trim().length > 0;
}
