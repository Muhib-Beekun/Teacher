#!/usr/bin/env node
/**
 * Compile quality gate — PickAI value-gate pattern for Teacher brief generation.
 * Usage:
 *   node tools/eval-compile.mjs --provider grok
 *   node tools/eval-compile.mjs --provider ollama --model qwen2.5:7b-instruct
 *   node tools/eval-compile.mjs --compare   # cloud vs ollama baselines, write outputs/compile-eval-report.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCompilePrompt } from './compile-prompt.mjs';
import { loadGrokKey, loadGrokModel } from './load-grok-key.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'data', 'compile-eval-fixtures.jsonl');
const EVAL_DOC = path.join(ROOT, 'outputs', 'compile-eval-report.md');

const args = process.argv.slice(2);
const compare = args.includes('--compare');
const providerArg = args.find((a) => a.startsWith('--provider='))?.split('=')[1]
    ?? (args.includes('--provider') ? args[args.indexOf('--provider') + 1] : 'grok');
const modelArg = args.find((a) => a.startsWith('--model='))?.split('=')[1]
    ?? (args.includes('--model') ? args[args.indexOf('--model') + 1] : undefined);
const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

function loadFixtures() {
    const lines = fs.readFileSync(FIXTURES, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.map((l) => JSON.parse(l)).slice(0, limit);
}

function parseSections(markdown) {
    const goal = (markdown.match(/## Goal\s*\n([\s\S]*?)(?=\n##|$)/)?.[1] ?? '').trim();
    const hasConstraints = /## Constraints\b/.test(markdown);
    const hasVerification = /## Verification\b/.test(markdown);
    const verification = (markdown.match(/## Verification\s*\n([\s\S]*?)(?=\n##|$)/)?.[1] ?? '').trim();
    const hasHrInVerification = /-{3,}/.test(verification);
    return { goal, hasConstraints, hasVerification, hasHrInVerification };
}

function scoreFixture(fixture, markdown, latencyMs) {
    const latest = fixture.segments[fixture.segments.length - 1];
    const { goal, hasConstraints, hasVerification, hasHrInVerification } = parseSections(markdown);
    const exp = fixture.expect ?? {};
    const checks = [];
    let passed = 0;
    let total = 0;

    function check(name, ok) {
        total++;
        if (ok) passed++;
        checks.push({ name, ok });
    }

    check('has_goal', markdown.includes('## Goal') && goal.length > 0);
    if (exp.hasGoal !== undefined) check('expect_has_goal', markdown.includes('## Goal') === exp.hasGoal);

    if (exp.goalNotVerbatim) {
        check('goal_not_verbatim', goal.toLowerCase() !== latest.toLowerCase());
    }

    if (exp.goalContainsAny?.length) {
        const g = goal.toLowerCase();
        check('goal_keywords', exp.goalContainsAny.some((k) => g.includes(k.toLowerCase())));
    }

    if (exp.goalNotContains?.length) {
        const g = goal.toLowerCase();
        check('goal_excludes', !exp.goalNotContains.some((k) => g.includes(k.toLowerCase())));
    }

    if (exp.hasConstraints) check('has_constraints', hasConstraints);
    if (exp.hasVerification) check('has_verification', hasVerification);

    check('no_hr_in_verification', !hasHrInVerification);

    if (exp.noInventedTask) {
        const invented = /\b(implement|refactor|add feature|create)\b/i.test(goal)
            && !/\b(no implementation|not requesting|evaluat|observ|no action)\b/i.test(goal);
        check('no_invented_task', !invented);
    }

    if (providerArg === 'grok') {
        check('remote_latency', latencyMs >= 500);
    }

    return { id: fixture.id, passed, total, score: total ? passed / total : 0, checks, latencyMs, goalPreview: goal.slice(0, 120) };
}

async function callGrok(system, user) {
    const key = loadGrokKey();
    if (!key) throw new Error('No Grok API key');
    const model = modelArg ?? loadGrokModel();
    const started = Date.now();
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.2
        })
    });
    const ms = Date.now() - started;
    if (!res.ok) throw new Error(`Grok ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content?.trim() ?? '', latencyMs: ms, model };
}

async function callOllama(system, user) {
    const base = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
    const model = modelArg ?? process.env.TEACHER_OLLAMA_MODEL ?? 'qwen2.5:7b-instruct';
    const prompt = `${system}\n\n${user}`;
    const started = Date.now();
    const res = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.2 } })
    });
    const ms = Date.now() - started;
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return { text: (json.response ?? '').trim(), latencyMs: ms, model };
}

async function runProvider(provider, modelOverride) {
    const ollamaModel = modelOverride ?? process.env.TEACHER_OLLAMA_MODEL ?? 'qwen2.5:7b-instruct';
    const fixtures = loadFixtures();
    const results = [];
    for (const fixture of fixtures) {
        const ctx = { targetFiles: fixture.targetFiles ?? [] };
        const { system, user } = buildCompilePrompt(fixture.segments, ctx, fixture.priorBrief ?? '');
        let out;
        try {
            if (provider === 'grok') {
                out = await callGrok(system, user);
            } else {
                const prev = process.env.TEACHER_OLLAMA_MODEL;
                process.env.TEACHER_OLLAMA_MODEL = ollamaModel;
                out = await callOllama(system, user);
                if (prev === undefined) delete process.env.TEACHER_OLLAMA_MODEL;
                else process.env.TEACHER_OLLAMA_MODEL = prev;
            }
        } catch (err) {
            results.push({ id: fixture.id, passed: 0, total: 1, score: 0, error: String(err.message), checks: [] });
            continue;
        }
        results.push(scoreFixture(fixture, out.text, out.latencyMs));
    }
    const aggregate = results.reduce((s, r) => s + r.score, 0) / (results.length || 1);
    const avgLatency = results.filter((r) => r.latencyMs).reduce((s, r) => s + r.latencyMs, 0)
        / (results.filter((r) => r.latencyMs).length || 1);
    return {
        provider,
        model: provider === 'grok' ? (modelOverride ?? loadGrokModel()) : ollamaModel,
        aggregate,
        avgLatency,
        results
    };
}

function formatReport(run) {
    const lines = [
        `# Teacher compile eval — ${run.provider}`,
        '',
        `**Model:** ${run.model}`,
        `**Aggregate score:** ${(run.aggregate * 100).toFixed(1)}%`,
        `**Avg latency:** ${Math.round(run.avgLatency)}ms`,
        `**Gate:** ${run.aggregate >= 0.85 ? 'PASS' : 'FAIL'} (threshold 85%)`,
        '',
        '| Fixture | Score | Latency | Goal preview |',
        '|---------|-------|---------|--------------|'
    ];
    for (const r of run.results) {
        const pct = `${Math.round(r.score * 100)}%`;
        const lat = r.latencyMs ? `${r.latencyMs}ms` : r.error ? 'ERR' : '—';
        const preview = (r.goalPreview ?? r.error ?? '').replace(/\|/g, '/').slice(0, 60);
        lines.push(`| ${r.id} | ${pct} | ${lat} | ${preview} |`);
    }
    return lines.join('\n');
}

async function main() {
    if (compare) {
        const runs = [];
        runs.push(await runProvider('grok'));
        for (const m of ['qwen2.5:7b-instruct', 'qwen2.5-coder:14b']) {
            try {
                runs.push(await runProvider('ollama', m));
            } catch (e) {
                runs.push({ provider: 'ollama', model: m, aggregate: 0, avgLatency: 0, results: [], error: String(e.message) });
            }
        }
        const best = runs.reduce((a, b) => (b.aggregate > a.aggregate ? b : a));
        const doc = [
            '# Teacher compile eval report',
            '',
            `Generated: ${new Date().toISOString()}`,
            '',
            '## Value gate',
            '',
            'Per PickAI pattern: promote a candidate only if aggregate score **exceeds** the production baseline on the same holdout fixtures.',
            '',
            '| Provider | Model | Aggregate | Avg latency | Gate |',
            '|----------|-------|-----------|-------------|------|'
        ];
        for (const r of runs) {
            const gate = r.aggregate >= 0.85 ? 'PASS' : 'FAIL';
            doc.push(`| ${r.provider} | ${r.model} | ${(r.aggregate * 100).toFixed(1)}% | ${Math.round(r.avgLatency)}ms | ${gate} |`);
        }
        doc.push('', `**Best:** ${best.provider} / ${best.model} (${(best.aggregate * 100).toFixed(1)}%)`, '');
        for (const r of runs) {
            doc.push('---', '', formatReport(r), '');
        }
        fs.mkdirSync(path.dirname(EVAL_DOC), { recursive: true });
        fs.writeFileSync(EVAL_DOC, doc.join('\n'), 'utf8');
        console.log(`Wrote ${EVAL_DOC}`);
        console.log(`Best: ${best.provider}/${best.model} @ ${(best.aggregate * 100).toFixed(1)}%`);
        const grokRun = runs.find((r) => r.provider === 'grok');
        if (grokRun && grokRun.aggregate < 0.85) process.exitCode = 1;
        return;
    }

    const run = await runProvider(providerArg, modelArg);
    console.log(formatReport(run));
    if (run.aggregate < 0.85) {
        console.error(`\nFAIL: aggregate ${(run.aggregate * 100).toFixed(1)}% < 85% gate`);
        process.exitCode = 1;
    } else {
        console.log(`\nPASS: aggregate ${(run.aggregate * 100).toFixed(1)}%`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
