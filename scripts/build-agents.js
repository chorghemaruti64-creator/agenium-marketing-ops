#!/usr/bin/env node
/**
 * Build all agent TypeScript files
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const agentsDir = join(projectRoot, 'agents');

// List of agents to build
const agents = readdirSync(agentsDir).filter(d => {
  const indexPath = join(agentsDir, d, 'index.ts');
  return existsSync(indexPath);
});

console.log('Building agents:', agents.join(', '));

// Build each agent
for (const agent of agents) {
  const agentDir = join(agentsDir, agent);
  console.log(`\n📦 Building ${agent}...`);
  
  try {
    execSync(
      `npx tsc ${join(agentDir, 'index.ts')} --outDir ${agentDir} --module NodeNext --moduleResolution NodeNext --esModuleInterop --target ES2022 --skipLibCheck --declaration`,
      { 
        cwd: projectRoot, 
        stdio: 'inherit' 
      }
    );
    console.log(`✅ ${agent} built successfully`);
  } catch (error) {
    console.error(`❌ Failed to build ${agent}`);
    // Don't fail the whole build, continue with other agents
  }
}

console.log('\n✅ Agent build complete');
