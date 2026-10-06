import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Parses simple YAML frontmatter from a markdown file.
 * Returns { metadata: Object, content: String }
 */
function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, content: fileContent };
  }

  const rawMeta = match[1];
  const content = match[2];
  const metadata = {};

  const lines = rawMeta.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (!isNaN(val) && val !== '') {
        val = Number(val);
      } else if (val === 'true') {
        val = true;
      } else if (val === 'false') {
        val = false;
      }
      metadata[key] = val;
    }
  }

  return { metadata, content };
}

/**
 * Loads and parses sprints.yml or fallback JSON/table
 */
function loadSprints(sprintsFilePath) {
  if (!fs.existsSync(sprintsFilePath)) {
    return {};
  }
  const raw = fs.readFileSync(sprintsFilePath, 'utf-8');
  const sprints = {};

  // Simple resilient parser for sprints YAML format
  const sprintBlocks = raw.split(/\n\s*(\d+):/);
  if (sprintBlocks.length > 1) {
    for (let i = 1; i < sprintBlocks.length; i += 2) {
      const sprintNumber = parseInt(sprintBlocks[i], 10);
      const blockContent = sprintBlocks[i + 1] || '';
      const startMatch = blockContent.match(/start:\s*["']?([^"'\n\r]+)["']?/);
      const endMatch = blockContent.match(/end:\s*["']?([^"'\n\r]+)["']?/);
      const nameMatch = blockContent.match(/name:\s*["']?([^"'\n\r]+)["']?/);
      sprints[sprintNumber] = {
        name: nameMatch ? nameMatch[1].trim() : `Sprint ${sprintNumber}`,
        start: startMatch ? startMatch[1].trim() : null,
        end: endMatch ? endMatch[1].trim() : null
      };
    }
  }
  return sprints;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractCode(text) {
  if (!text) return null;
  const match = text.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)*-\d+)/i) || text.match(/^([A-Z]{2,}(?:-[A-Z]+)?-\d{1,3})/i);
  return match ? match[1].toUpperCase() : null;
}

async function waitForRateLimit() {
  console.warn(`\n⚠️  [Rate limit detected] Querying exact reset timestamp from GitHub API...`);
  let waitSeconds = 120;
  try {
    const res = spawnSync('gh', ['api', '-i', 'graphql', '-f', 'query=query { viewer { login } }'], { encoding: 'utf-8' });
    const output = (res.stdout || '') + '\n' + (res.stderr || '');
    const match = output.match(/x-ratelimit-reset:\s*(\d+)/i);
    if (match) {
      const resetEpoch = parseInt(match[1], 10);
      const diff = resetEpoch - Math.floor(Date.now() / 1000);
      if (diff > 0) {
        waitSeconds = diff + 15;
      }
    }
  } catch (e) {
    console.error('Error querying reset header:', e.message);
  }

  const resetTarget = new Date(Date.now() + waitSeconds * 1000).toLocaleTimeString();
  console.warn(`⏳ Rate limit reached. Pausing execution for ${waitSeconds}s (~${Math.ceil(waitSeconds / 60)} min). Will resume at ~${resetTarget}...`);
  await sleep(waitSeconds * 1000);
  console.log('✅ Resuming execution after rate limit reset...');
}

async function runGh(args, input = null, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = spawnSync('gh', args, {
      input,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status === 0) {
      return res.stdout.trim();
    }

    const err = (res.stderr || res.stdout || '').toLowerCase();
    const isRateLimit = err.includes('rate limit') ||
      err.includes('too quickly') ||
      err.includes('was submitted too quickly');

    if (isRateLimit && attempt < maxRetries) {
      await waitForRateLimit();
      continue;
    }

    throw new Error(`gh ${args.join(' ')} failed:\n${res.stderr || res.stdout}`);
  }
}

async function runGraphql(query, variables = {}, maxRetries = 15) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const payload = JSON.stringify({ query, variables });
    const res = spawnSync('gh', ['api', 'graphql', '--input', '-'], {
      input: payload,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (res.status !== 0) {
      const err = (res.stderr || res.stdout || '').toLowerCase();
      if (err.includes('rate limit') && attempt < maxRetries) {
        await waitForRateLimit();
        continue;
      }
      throw new Error(`gh api graphql failed:\n${res.stderr || res.stdout}`);
    }

    const data = JSON.parse(res.stdout.trim());
    if (data.errors && data.errors.length > 0) {
      const errMsg = data.errors.map(e => e.message).join('; ');
      if (errMsg.toLowerCase().includes('rate limit') && attempt < maxRetries) {
        await waitForRateLimit();
        continue;
      }
      // Sub-issue might already be linked
      if (errMsg.includes('already a sub-issue')) {
        return data.data;
      }
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }
    return data.data;
  }
}

// Global caches of issues to prevent redundant lookups
const issuesCache = new Map();
const issuesByCode = new Map();

async function loadExistingIssues(repo) {
  console.log(`Loading existing repository issues into cache for [${repo}]...`);
  try {
    const out = await runGh(['issue', 'list', '-R', repo, '--state', 'all', '--limit', '500', '--json', 'id,number,title,url,projectItems']);
    const list = JSON.parse(out);
    for (const item of list) {
      issuesCache.set(item.title.trim().toLowerCase(), item);
      const code = extractCode(item.title);
      if (code) {
        issuesByCode.set(code, item);
      }
    }
    console.log(`Loaded ${list.length} issues into cache (${issuesByCode.size} indexed by code).`);
  } catch (err) {
    console.warn(`Notice: Could not pre-fetch issues: ${err.message}. Starting with empty cache.`);
  }
}

function findExistingIssue(title, code = null) {
  if (code && issuesByCode.has(code.toUpperCase())) {
    return issuesByCode.get(code.toUpperCase());
  }
  return issuesCache.get(title.trim().toLowerCase()) || null;
}

export async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const updateExistingBodies = process.argv.includes('--update-bodies');
  const targetEpicArg = process.argv.find(arg => arg.startsWith('--epic='));
  const targetEpic = targetEpicArg ? targetEpicArg.split('=')[1].toUpperCase() : null;
  const configArg = process.argv.find(arg => arg.startsWith('--config='));
  const configPath = configArg ? configArg.split('=')[1] : 'config.json';

  // Load configuration
  let config = {
    repository: 'jh-ecomp/gitautoissue',
    projectNumber: 1,
    projectOwner: 'jh-ecomp',
    defaultMilestone: 'v1.0.0 - MVP',
    docsDir: './docs/user-stories',
    sprintsFile: './docs/sprints.yml',
    labels: { epic: 'Epic', story: 'User Story' }
  };

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...config, ...fileConfig };
      console.log(`Loaded configuration from ${configPath}`);
    } catch (e) {
      console.warn(`Could not parse config file at ${configPath}: ${e.message}. Using defaults.`);
    }
  }

  const { repository: REPO, projectNumber: PROJECT_NUMBER, projectOwner: PROJECT_OWNER } = config;
  const docsDir = path.resolve(config.docsDir);
  const sprintsFile = path.resolve(config.sprintsFile);
  const SPRINTS = loadSprints(sprintsFile);

  console.log(`\n============================================================`);
  console.log(`🚀 GitAutoIssue Sync Engine ${isDryRun ? '[DRY RUN]' : ''}`);
  console.log(`Repository: ${REPO} | Project: #${PROJECT_NUMBER} (@${PROJECT_OWNER})`);
  console.log(`Docs Directory: ${docsDir}`);
  console.log(`Sprints file: ${sprintsFile} (${Object.keys(SPRINTS).length} sprints loaded)`);
  console.log(`============================================================\n`);

  await loadExistingIssues(REPO);

  if (!fs.existsSync(docsDir)) {
    console.error(`Error: Documentation directory not found at ${docsDir}`);
    process.exit(1);
  }

  const epicDirs = fs.readdirSync(docsDir).filter(f => {
    return fs.statSync(path.join(docsDir, f)).isDirectory();
  }).sort();

  console.log(`Found ${epicDirs.length} epic folders in ${docsDir}.`);

  for (const dirName of epicDirs) {
    const epicDirPath = path.join(docsDir, dirName);
    const files = fs.readdirSync(epicDirPath).filter(f => f.endsWith('.md'));
    
    // Find the main epic file (matches folder name or has 'epic' in name)
    let epicFile = files.find(f => f.toLowerCase().includes('epic') || f.toLowerCase().includes('epico'));
    if (!epicFile && files.length > 0) {
      epicFile = files[0];
    }

    if (!epicFile) {
      console.warn(`Skipping folder ${dirName}: no markdown file found.`);
      continue;
    }

    const epicFilePath = path.join(epicDirPath, epicFile);
    const epicRaw = fs.readFileSync(epicFilePath, 'utf-8');
    const { metadata: epicMeta, content: epicBody } = parseFrontmatter(epicRaw);

    const firstLine = epicBody.split('\n').find(l => l.trim().startsWith('#'))?.replace(/^#\s*/, '').trim() 
      || epicMeta.name 
      || dirName;

    const epicCode = (epicMeta.code || extractCode(firstLine) || dirName).toUpperCase();

    if (targetEpic && epicCode !== targetEpic) {
      continue;
    }

    const startDate = epicMeta.startDate || SPRINTS[1]?.start || '2026-10-06';
    const targetDate = epicMeta.targetDate || SPRINTS[1]?.end || '2026-10-20';
    const milestone = epicMeta.milestone || config.defaultMilestone;

    console.log(`\n============================================================`);
    console.log(`📌 Epic [${epicCode}]: ${firstLine}`);
    console.log(`Dates: ${startDate} -> ${targetDate} | Milestone: ${milestone}`);

    let epicIssue = findExistingIssue(firstLine, epicCode);

    if (epicIssue) {
      console.log(`Found existing Epic issue: #${epicIssue.number} (${epicIssue.url})`);
    } else {
      if (!isDryRun) {
        console.log(`Creating Epic issue...`);
        const createArgs = [
          'issue', 'create',
          '-R', REPO,
          '--title', firstLine,
          '--body-file', epicFilePath,
          '--label', config.labels?.epic || 'Epic'
        ];
        if (milestone) createArgs.push('--milestone', milestone);
        
        try {
          const createEpicOutput = await runGh(createArgs);
          const epicUrl = createEpicOutput;
          const epicIssueNumber = epicUrl.split('/').pop();
          epicIssue = JSON.parse(await runGh(['issue', 'view', epicIssueNumber, '-R', REPO, '--json', 'id,number,title,url,projectItems']));
          issuesCache.set(firstLine.toLowerCase(), epicIssue);
          issuesByCode.set(epicCode, epicIssue);
          console.log(`Created Epic issue: #${epicIssue.number} (${epicIssue.url})`);
          await sleep(1500);
        } catch (e) {
          console.warn(`Could not create Epic issue: ${e.message}`);
        }
      } else {
        console.log(`[DRY RUN] Would create Epic: "${firstLine}"`);
        epicIssue = { id: 'mock-epic-id', number: 999, url: 'https://mock/epic' };
      }
    }

    // Process user story files inside this epic directory
    const storyFiles = files.filter(f => f !== epicFile && !f.toLowerCase().includes('progress') && !f.toLowerCase().includes('readme')).sort();
    console.log(`Processing ${storyFiles.length} user story files in ${dirName}...`);

    for (const storyFileName of storyFiles) {
      const storyPath = path.join(epicDirPath, storyFileName);
      const storyRaw = fs.readFileSync(storyPath, 'utf-8');
      const { metadata: storyMeta, content: storyBody } = parseFrontmatter(storyRaw);

      const titleLine = storyBody.split('\n').find(l => l.trim().startsWith('#'))?.replace(/^#\s*/, '').trim()
        || storyMeta.title
        || storyFileName.replace(/\.md$/, '');
      const cleanTitle = titleLine.replace(/`/g, '').trim();

      const storyCode = (storyMeta.code || extractCode(cleanTitle) || 'UNKNOWN').toUpperCase();
      const sprintNumber = storyMeta.sprint || 1;
      const sprintInfo = SPRINTS[sprintNumber] || { start: startDate, end: targetDate };
      const priority = storyMeta.priority || 'P1';
      const size = storyMeta.size || 'M';
      const estimate = storyMeta.estimate || 5;

      console.log(`\n  -> Story: [${storyCode}] ${cleanTitle}`);
      console.log(`     Sprint: ${sprintNumber} (${sprintInfo.start} to ${sprintInfo.end}) | ${priority} | ${size} (${estimate} pts)`);

      let storyIssue = findExistingIssue(cleanTitle, storyCode);

      if (storyIssue) {
        console.log(`     Status: ALREADY EXISTS -> #${storyIssue.number} (${storyIssue.title})`);
        if (updateExistingBodies) {
          if (!isDryRun) {
            console.log(`     [UPDATE] Updating issue body for #${storyIssue.number}...`);
            await runGh(['issue', 'edit', String(storyIssue.number), '-R', REPO, '--body-file', storyPath]);
            await sleep(1000);
          } else {
            console.log(`     [DRY RUN] Would update issue body for #${storyIssue.number}`);
          }
        }
      } else {
        console.log(`     Status: NOT REGISTERED -> Will create new issue`);
        if (!isDryRun) {
          console.log(`     [CREATE] Creating Story issue...`);
          const storyArgs = [
            'issue', 'create',
            '-R', REPO,
            '--title', cleanTitle,
            '--body-file', storyPath,
            '--label', config.labels?.story || 'User Story'
          ];
          if (milestone) storyArgs.push('--milestone', milestone);

          try {
            const storyOutput = await runGh(storyArgs);
            const storyUrl = storyOutput;
            const storyNumber = storyUrl.split('/').pop();
            storyIssue = JSON.parse(await runGh(['issue', 'view', storyNumber, '-R', REPO, '--json', 'id,number,title,url,projectItems']));
            issuesCache.set(cleanTitle.toLowerCase(), storyIssue);
            if (storyCode) issuesByCode.set(storyCode, storyIssue);
            console.log(`     Created Story issue: #${storyIssue.number}`);
            await sleep(1500);
          } catch (e) {
            console.warn(`     Error creating story issue: ${e.message}`);
          }
        } else {
          console.log(`     [DRY RUN] Would create issue: "${cleanTitle}"`);
          storyIssue = { id: 'mock-story-id', number: 888, url: 'https://mock/story' };
        }
      }

      // Link as Sub-issue to parent Epic
      if (!isDryRun && epicIssue && storyIssue && epicIssue.id && storyIssue.id && epicIssue.id !== 'mock-epic-id') {
        try {
          console.log(`     Linking as sub-issue to Epic #${epicIssue.number}...`);
          const addSubIssueMutation = `
            mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
              addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId }) {
                issue { id number }
                subIssue { id number }
              }
            }
          `;
          await runGraphql(addSubIssueMutation, {
            issueId: epicIssue.id,
            subIssueId: storyIssue.id
          });
          await sleep(500);
        } catch (e) {
          console.log(`     Notice on sub-issue link: ${e.message.split('\n')[0]}`);
        }
      }
    }
  }

  console.log(`\n🎉 Finished ${isDryRun ? '[DRY RUN] ' : ''}process successfully! All epics, user stories, and sub-issues synced.`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
