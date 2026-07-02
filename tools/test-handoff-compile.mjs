#!/usr/bin/env node
/** Compile the current handoff session segments with Ollama 14B for quality check. */
import { buildCompilePrompt } from './compile-prompt.mjs';

const segments = [
    "I think clicking clear session is pretty clear I don't think you need to pop up a notification for that I hope that the UI is responsive so if someone kind of shrinks it down that can work for them I imagine that people might work on this on a half screen or a quarter screen and I want it to be reasonable for them to use just because I mean not everybody has multiple monitors so really kind of prioritize that I'm thinking laying off Fuse support if people want to I know I probably want it actually don't that's probably bloat I mean all right no go go back to it go back to it all right look advise me is it bloat I don't know you you tell me okay that's a question not a not a do I'm not going to deal with user editable prompts they can look at it if they want to the question around hosted inference is something to the effect of you know charging a monthly fee if I have to host it myself or maybe charging the user what it costs to host it potentially I mean I don't want to have to I just figured that it might end up useless if a user doesn't have an API key maybe we can provide some extensive instruction on here's how you get one and I would hope maybe and I don't know if I got the answer earlier how in the heck can I use well no you you did answer it I was going to ask how could you handle leveraging the harnesses stuff but it ain't going to do that so whatever Ollama for 14B and then also have it take the thought processes your thought process that comes with this run it against it and see how the outcome looks",
    "at the top of the screen on the right hand side when corrections are made it has some green text about the corrections but we already have that green text not green but it has the autocorrected section underneath the included piece also I almost wonder if we should you know shrink autocorrect it to just what it is kind of seems like the kind of thing somebody could you know open or close but I don't know if there's a clean way to do that within the UI so if there isn't a clean way to just you know expand or track that one I'd leave it just because we already kind of have a way to expand and contract the whole block so just my thinking there",
    "when I press the double arrow button on agent prompts it moves it into the chat appropriately and it even you know has a header section which says teacher agent handoff with some prompting instructions but when I copy the prompt it does not have that extra bit of prompting instructions at the top also I don't personally think that the your word section needs to necessarily go into the cursor prompt but nah leave it as it is I don't want to mess with it this is fine",
    "I don't think you need to mention the things that I'm telling you to leave unchanged and I was saying advise whether adding Langfuse support would be unnecessary bloat versus a useful addition",
    "honestly I think we probably need to because I see that you autocorrected Langfuse without highlighting it under yellow so that was a kind of a problem it was stated as Langfuse when I sent it to you so that's what's going on there and it just should be strictly optional I'm assuming that you know people probably aren't going to necessarily want the setup to go with it"
];

const ctx = { targetFiles: ['media/teacher-app.html', 'src/providers/compile/CompileService.ts'] };
const { system, user } = buildCompilePrompt(segments, ctx, '');

const model = process.argv[2] || 'qwen2.5-coder:14b';
const base = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

const started = Date.now();
const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
        options: { temperature: 0.2 }
    }),
    signal: AbortSignal.timeout(180_000)
});
const ms = Date.now() - started;

if (!res.ok) {
    console.error(`Ollama failed: ${res.status} ${await res.text()}`);
    process.exit(1);
}

const json = await res.json();
const text = json.message?.content?.trim() ?? '';
console.log(`Model: ${model}`);
console.log(`Latency: ${ms}ms`);
console.log(`Has ## Goal: ${text.includes('## Goal')}`);
console.log(`Has ## Session: ${text.includes('## Session')}`);
console.log(`Mentions Langfuse: ${/langfuse/i.test(text)}`);
console.log('\n--- OUTPUT ---\n');
console.log(text);
