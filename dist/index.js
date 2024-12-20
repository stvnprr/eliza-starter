// src/index.ts
import { PostgresDatabaseAdapter } from "@ai16z/adapter-postgres";
import { SqliteDatabaseAdapter } from "@ai16z/adapter-sqlite";
import { DirectClientInterface } from "@ai16z/client-direct";
import { DiscordClientInterface } from "@ai16z/client-discord";
import { AutoClientInterface } from "@ai16z/client-auto";
import { TelegramClientInterface } from "@ai16z/client-telegram";
import { TwitterClientInterface } from "@ai16z/client-twitter";
import {
  DbCacheAdapter,
  defaultCharacter,
  FsCacheAdapter,
  stringToUuid,
  AgentRuntime,
  CacheManager,
  ModelProviderName as ModelProviderName2,
  elizaLogger,
  settings,
  validateCharacterConfig
} from "@ai16z/eliza";
import { bootstrapPlugin } from "@ai16z/plugin-bootstrap";
import { solanaPlugin } from "@ai16z/plugin-solana";
import { nodePlugin } from "@ai16z/plugin-node";
import Database from "better-sqlite3";
import fs2 from "fs";
import readline from "readline";
import yargs from "yargs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/character.ts
import { ModelProviderName } from "@ai16z/eliza";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
dotenv.config();
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var characterPath = path.join(__dirname, "../characters/trump.character.json");
var character;
try {
  const characterData = fs.readFileSync(characterPath, "utf8");
  character = JSON.parse(characterData);
  character.settings = {
    ...character.settings,
    secrets: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    }
  };
  character.modelProvider = ModelProviderName.OPENAI;
} catch (error) {
  console.error("Error loading trump.character.json:", error);
  throw new Error("Failed to load character file. Make sure trump.character.json exists in the characters folder.");
}

// src/index.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename);
var wait = (minTime = 1e3, maxTime = 3e3) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};
function parseArguments() {
  try {
    return yargs(process.argv.slice(2)).option("character", {
      type: "string",
      description: "Path to the character JSON file"
    }).option("characters", {
      type: "string",
      description: "Comma separated list of paths to character JSON files"
    }).parseSync();
  } catch (error) {
    console.error("Error parsing arguments:", error);
    return {};
  }
}
async function loadCharacters(charactersArg) {
  let characterPaths = charactersArg?.split(",").map((filePath) => {
    if (path2.basename(filePath) === filePath) {
      filePath = "../characters/" + filePath;
    }
    return path2.resolve(process.cwd(), filePath.trim());
  });
  const loadedCharacters = [];
  if (characterPaths?.length > 0) {
    for (const path3 of characterPaths) {
      try {
        const character2 = JSON.parse(fs2.readFileSync(path3, "utf8"));
        validateCharacterConfig(character2);
        loadedCharacters.push(character2);
      } catch (e) {
        console.error(`Error loading character from ${path3}: ${e}`);
        process.exit(1);
      }
    }
  }
  if (loadedCharacters.length === 0) {
    console.log("No characters found, using default character");
    loadedCharacters.push(defaultCharacter);
  }
  return loadedCharacters;
}
function getTokenForProvider(provider, character2) {
  switch (provider) {
    case ModelProviderName2.OPENAI:
      return character2.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY;
    case ModelProviderName2.LLAMACLOUD:
      return character2.settings?.secrets?.LLAMACLOUD_API_KEY || settings.LLAMACLOUD_API_KEY || character2.settings?.secrets?.TOGETHER_API_KEY || settings.TOGETHER_API_KEY || character2.settings?.secrets?.XAI_API_KEY || settings.XAI_API_KEY || character2.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY;
    case ModelProviderName2.ANTHROPIC:
      return character2.settings?.secrets?.ANTHROPIC_API_KEY || character2.settings?.secrets?.CLAUDE_API_KEY || settings.ANTHROPIC_API_KEY || settings.CLAUDE_API_KEY;
    case ModelProviderName2.REDPILL:
      return character2.settings?.secrets?.REDPILL_API_KEY || settings.REDPILL_API_KEY;
    case ModelProviderName2.OPENROUTER:
      return character2.settings?.secrets?.OPENROUTER || settings.OPENROUTER_API_KEY;
    case ModelProviderName2.GROK:
      return character2.settings?.secrets?.GROK_API_KEY || settings.GROK_API_KEY;
    case ModelProviderName2.HEURIST:
      return character2.settings?.secrets?.HEURIST_API_KEY || settings.HEURIST_API_KEY;
    case ModelProviderName2.GROQ:
      return character2.settings?.secrets?.GROQ_API_KEY || settings.GROQ_API_KEY;
  }
}
function initializeDatabase(dataDir) {
  if (process.env.POSTGRES_URL) {
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL
    });
    return db;
  } else {
    const filePath = process.env.SQLITE_FILE ?? path2.resolve(dataDir, "db.sqlite");
    const db = new SqliteDatabaseAdapter(new Database(filePath));
    return db;
  }
}
async function initializeClients(character2, runtime) {
  const clients = [];
  const clientTypes = character2.clients?.map((str) => str.toLowerCase()) || [];
  if (clientTypes.includes("auto")) {
    const autoClient = await AutoClientInterface.start(runtime);
    if (autoClient) clients.push(autoClient);
  }
  if (clientTypes.includes("discord")) {
    clients.push(await DiscordClientInterface.start(runtime));
  }
  if (clientTypes.includes("telegram")) {
    const telegramClient = await TelegramClientInterface.start(runtime);
    if (telegramClient) clients.push(telegramClient);
  }
  if (clientTypes.includes("twitter")) {
    const twitterClients = await TwitterClientInterface.start(runtime);
    clients.push(twitterClients);
  }
  if (character2.plugins?.length > 0) {
    for (const plugin of character2.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          clients.push(await client.start(runtime));
        }
      }
    }
  }
  return clients;
}
function createAgent(character2, db, cache, token) {
  if (!character2 || !character2.name) {
    throw new Error("Character configuration is required");
  }
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character2.name
  );
  const plugins = [
    bootstrapPlugin,
    process.env.DISABLE_BROWSER ? null : nodePlugin,
    character2.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null
  ].filter(Boolean);
  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character2.modelProvider || ModelProviderName2.OPENAI,
    evaluators: [],
    character: character2,
    plugins,
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache
  });
}
function intializeDbCache(character2, db) {
  const cache = new CacheManager(new DbCacheAdapter(db, character2.id));
  return cache;
}
async function startAgent(character2, directClient) {
  try {
    if (!character2 || !character2.name) {
      throw new Error("Invalid character configuration");
    }
    if (!directClient) {
      throw new Error("DirectClient is required");
    }
    console.log("Starting agent with character:", {
      name: character2.name,
      id: character2.id,
      modelProvider: character2.modelProvider
    });
    character2.id ??= stringToUuid(character2.name);
    character2.username ??= character2.name;
    const token = getTokenForProvider(character2.modelProvider, character2);
    if (!token) {
      throw new Error(`No API token found for provider ${character2.modelProvider}`);
    }
    const dataDir = path2.join(__dirname2, "../data");
    if (!fs2.existsSync(dataDir)) {
      fs2.mkdirSync(dataDir, { recursive: true });
    }
    const db = initializeDatabase(dataDir);
    await db.init();
    const cache = intializeDbCache(character2, db);
    const runtime = createAgent(character2, db, cache, token);
    await runtime.initialize();
    const clients = await initializeClients(character2, runtime);
    directClient.registerAgent(runtime);
    return clients;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character2?.name}:`, error);
    console.error("Full error details:", error);
    throw error;
  }
}
var startAgents = async () => {
  try {
    let chat = function() {
      const agentId = characters[0].name ?? "Agent";
      rl.question("You: ", async (input) => {
        await handleUserInput(input, agentId);
        if (input.toLowerCase() !== "exit") {
          chat();
        }
      });
    };
    process.env.DISABLE_BROWSER = "true";
    const directClient = await DirectClientInterface.start();
    if (!directClient) {
      throw new Error("Failed to initialize DirectClientInterface");
    }
    const args = parseArguments();
    let charactersArg = args.characters || args.character;
    let characters = [character];
    console.log("Starting with characters:", {
      charactersArg,
      defaultCharacter: character.name
    });
    if (charactersArg) {
      characters = await loadCharacters(charactersArg);
    }
    if (!characters || characters.length === 0) {
      throw new Error("No valid characters to start");
    }
    for (const char of characters) {
      console.log(`Starting agent for character: ${char.name}`);
      await startAgent(char, directClient);
    }
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    chat();
  } catch (error) {
    elizaLogger.error("Error starting agents:", {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};
startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.on("SIGINT", () => {
  rl.close();
  process.exit(0);
});
async function handleUserInput(input, agentId) {
  if (input.toLowerCase() === "exit") {
    rl.close();
    process.exit(0);
    return;
  }
  try {
    const serverPort = parseInt(settings.SERVER_PORT || "3000");
    const response = await fetch(
      `http://localhost:${serverPort}/${agentId}/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          userId: "user",
          userName: "User"
        })
      }
    );
    const data = await response.json();
    data.forEach((message) => console.log(`${"Agent"}: ${message.text}`));
  } catch (error) {
    console.error("Error fetching response:", error);
  }
}
export {
  createAgent,
  getTokenForProvider,
  initializeClients,
  loadCharacters,
  parseArguments,
  wait
};
