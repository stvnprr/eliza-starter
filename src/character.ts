import { Character, ModelProviderName } from "@ai16z/eliza";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get directory path in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Trump character file
const characterPath = path.join(__dirname, '../characters/trump.character.json');

let character: Character;
try {
    const characterData = fs.readFileSync(characterPath, 'utf8');
    character = JSON.parse(characterData);
    
    // Add API key to character settings
    character.settings = {
        ...character.settings,
        secrets: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        },
    };
    character.modelProvider = ModelProviderName.OPENAI;
    
} catch (error) {
    console.error('Error loading trump.character.json:', error);
    throw new Error('Failed to load character file. Make sure trump.character.json exists in the characters folder.');
}

export { character };
