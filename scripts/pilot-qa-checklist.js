const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const docsPath = path.join(rootDir, 'docs', 'commercial', 'MANUAL_QA_PLAN.md');
const demoScriptPath = path.join(rootDir, 'docs', 'commercial', 'DEMO_SCRIPT.md');
const pilotChecklistPath = path.join(rootDir, 'docs', 'commercial', 'PILOT_CHECKLIST.md');

process.stdout.write(
  [
    'CleanPrompt Pilot QA Checklist',
    'repo_root=' + rootDir,
    'manual_qa_plan=' + docsPath,
    'demo_script=' + demoScriptPath,
    'pilot_checklist=' + pilotChecklistPath,
    '',
    'Recommended order',
    '1. npm run verify',
    '2. npm run demo:seed',
    '3. Start the local control plane',
    '4. Load the extension unpacked in Chrome or Edge',
    '5. In the popup Managed tab, click Prepare managed demo',
    '6. Run the managed flow on ChatGPT first, then Claude, Copilot, and Gemini',
    '7. Capture blockers, evidence, and owner-console results in the manual QA plan',
    '',
    'Priority scenarios',
    '- redact and send',
    '- justify with required reason',
    '- block without replay',
    '- strict mode keeps metadata upload off',
    '- local-only mode still cleans prompts safely',
    '- owner console shows metadata-only insight without raw prompt text',
    '',
  ].join('\n')
);
