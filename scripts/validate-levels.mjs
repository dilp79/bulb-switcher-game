import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeLevel, validateLevel } from '../js/app/logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function main() {
    const manifestPath = path.join(projectRoot, 'levels', 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const problems = [];
    let levelCount = 0;

    for (const block of manifest.blocks ?? []) {
        const indexPath = path.join(projectRoot, block.directory, block.index);
        const fileList = JSON.parse(await readFile(indexPath, 'utf8'));

        for (const fileName of fileList) {
            const levelPath = path.join(projectRoot, block.directory, fileName);
            const rawLevel = JSON.parse(await readFile(levelPath, 'utf8'));
            const level = normalizeLevel(rawLevel, { block: block.id });
            const validation = validateLevel(level);

            levelCount += 1;

            if (!Array.isArray(rawLevel.connections) || rawLevel.connections.length === 0) {
                problems.push(`${block.id}/${fileName}: пустой список связей.`);
            }

            if (level.initial_states.length !== level.bulbs_count) {
                problems.push(`${block.id}/${fileName}: initial_states не совпадает с bulbs_count.`);
            }

            if (level.target_states.length !== level.bulbs_count) {
                problems.push(`${block.id}/${fileName}: target_states не совпадает с bulbs_count.`);
            }

            if (!validation.valid) {
                problems.push(`${block.id}/${fileName}: ${validation.errors.join(' | ')}`);
            }
        }
    }

    if (problems.length) {
        console.error('Level validation failed:');
        problems.forEach((problem) => console.error(`- ${problem}`));
        process.exitCode = 1;
        return;
    }

    console.log(`Validated ${levelCount} built-in levels successfully.`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
