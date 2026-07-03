import * as path from 'path';
import * as vscode from 'vscode';
import { readWorkspaceCodewords } from '../config/CodewordsManager';
import { basenameTerm, parsePackageJsonDeps } from './lexicalScan';
import { emptyVoiceSessionContext, VoiceSessionContext } from './VoiceSessionContext';

interface TermCandidate {
    term: string;
    score: number;
    source: 'symbol' | 'dependency' | 'basename' | 'codeword' | 'open_file';
}

export interface RebuildOptions {
    /** Latest utterance text — boosts basename matches (post-first STT pass). */
    recentUtterance?: string;
}

export class WorkspaceContextIndex {
    private context: VoiceSessionContext = emptyVoiceSessionContext();
    private rebuildPromise: Promise<VoiceSessionContext> | undefined;

    public getContext(): VoiceSessionContext {
        return this.context;
    }

    public rebuild(options: RebuildOptions = {}): Promise<VoiceSessionContext> {
        if (!this.rebuildPromise) {
            this.rebuildPromise = this.doRebuild(options).finally(() => {
                this.rebuildPromise = undefined;
            });
        }
        return this.rebuildPromise;
    }

    private async doRebuild(options: RebuildOptions): Promise<VoiceSessionContext> {
        const config = vscode.workspace.getConfiguration('teacher.context');
        const maxTerms = config.get<number>('maxTerms', 200);
        const excludeGlobs = config.get<string[]>('excludeGlobs', [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/out/**',
            '**/.env*'
        ]);
        const excludePattern = `{${excludeGlobs.join(',')}}`;

        const activeUri = vscode.window.activeTextEditor?.document.uri;
        const openUris = new Set(
            vscode.workspace.textDocuments
                .filter((doc) => !doc.isUntitled && doc.uri.scheme === 'file')
                .map((doc) => doc.uri.toString())
        );

        const candidates: TermCandidate[] = [];
        const targetFiles = new Set<string>();

        if (activeUri) {
            targetFiles.add(this.relativePath(activeUri));
        }
        for (const uriStr of openUris) {
            targetFiles.add(this.relativePath(vscode.Uri.parse(uriStr)));
        }

        await this.collectSymbols(activeUri, openUris, candidates);
        await this.collectDependencies(candidates);
        await this.collectBasenames(excludePattern, candidates);
        await this.collectCodewords(candidates);
        this.collectEnvSymbols(candidates);

        const utterance = (options.recentUtterance ?? '').toLowerCase();
        if (utterance) {
            for (const candidate of candidates) {
                if (utterance.includes(candidate.term.toLowerCase())) {
                    candidate.score += 40;
                }
            }
        }

        const dictionary_context = this.rankAndCap(candidates, maxTerms);
        const stt_prompt = this.buildSttPrompt(dictionary_context);

        this.context = {
            dictionary_context,
            targetFiles: [...targetFiles].slice(0, 12),
            stt_prompt,
            builtAt: Date.now()
        };

        return this.context;
    }

    private async collectSymbols(
        activeUri: vscode.Uri | undefined,
        openUris: Set<string>,
        candidates: TermCandidate[]
    ): Promise<void> {
        const seenUris = new Set<string>();
        const urisToScan: vscode.Uri[] = [];

        if (activeUri?.scheme === 'file') {
            urisToScan.push(activeUri);
            seenUris.add(activeUri.toString());
        }

        for (const uriStr of openUris) {
            if (!seenUris.has(uriStr)) {
                urisToScan.push(vscode.Uri.parse(uriStr));
                seenUris.add(uriStr);
            }
        }

        const folders = vscode.workspace.workspaceFolders ?? [];
        for (const folder of folders.slice(0, 3)) {
            const extra = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.{ts,tsx,js,jsx,py,go,rs}'),
                '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}',
                40
            );
            for (const uri of extra) {
                const key = uri.toString();
                if (!seenUris.has(key)) {
                    urisToScan.push(uri);
                    seenUris.add(key);
                }
            }
        }

        for (const uri of urisToScan) {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            if (!symbols?.length) {
                continue;
            }

            const inActive = activeUri?.toString() === uri.toString();
            const inOpen = openUris.has(uri.toString());
            const rel = this.relativePath(uri);

            for (const name of flattenSymbolNames(symbols)) {
                if (!isUsefulTerm(name)) {
                    continue;
                }
                let score = 0;
                if (inActive) {
                    score += 100;
                }
                if (inOpen) {
                    score += 50;
                }
                score += 30;
                candidates.push({ term: name, score, source: 'symbol' });
            }

            if (inActive || inOpen) {
                candidates.push({ term: basenameTerm(rel), score: inActive ? 70 : 45, source: 'open_file' });
            }
        }
    }

    private async collectDependencies(candidates: TermCandidate[]): Promise<void> {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const pkgUri = vscode.Uri.joinPath(folder.uri, 'package.json');
            try {
                const raw = await vscode.workspace.fs.readFile(pkgUri);
                const pkg = JSON.parse(Buffer.from(raw).toString('utf8')) as Record<string, unknown>;
                for (const dep of parsePackageJsonDeps(pkg)) {
                    candidates.push({ term: dep, score: 20, source: 'dependency' });
                    if (dep.startsWith('@')) {
                        const scoped = dep.split('/').pop();
                        if (scoped) {
                            candidates.push({ term: scoped, score: 15, source: 'dependency' });
                        }
                    }
                }
            } catch {
                // no package.json or invalid JSON
            }
        }
    }

    private async collectBasenames(
        excludePattern: string,
        candidates: TermCandidate[]
    ): Promise<void> {
        const folders = vscode.workspace.workspaceFolders ?? [];
        if (!folders.length) {
            return;
        }

        const files = await vscode.workspace.findFiles('**/*', excludePattern, 120);
        for (const uri of files) {
            const rel = this.relativePath(uri);
            const term = basenameTerm(rel);
            if (!isUsefulTerm(term)) {
                continue;
            }
            candidates.push({ term, score: 5, source: 'basename' });
        }
    }

    private collectEnvSymbols(candidates: TermCandidate[]): void {
        for (const term of ['INFERENCE_API_KEY', 'OPENAI_API_KEY', 'DEEPGRAM_API_KEY']) {
            candidates.push({ term, score: 55, source: 'codeword' });
        }
    }

    private async collectCodewords(candidates: TermCandidate[]): Promise<void> {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const words = await readWorkspaceCodewords(folder);
            for (const word of words) {
                candidates.push({ term: word, score: 60, source: 'codeword' });
            }
        }
    }

    private rankAndCap(candidates: TermCandidate[], maxTerms: number): string[] {
        const byTerm = new Map<string, number>();
        for (const { term, score } of candidates) {
            const normalized = term.trim();
            if (!normalized) {
                continue;
            }
            const prev = byTerm.get(normalized) ?? 0;
            byTerm.set(normalized, Math.max(prev, score));
        }

        return [...byTerm.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, maxTerms)
            .map(([term]) => term);
    }

    private buildSttPrompt(terms: string[]): string {
        if (!terms.length) {
            return '';
        }
        const priority = terms.slice(0, 40).join(', ');
        const more = terms.length > 40 ? `, ${terms.slice(40, 80).join(', ')}` : '';
        return (
            `Software development dictation. Terms: ${priority}${more}. ` +
            'Common corrections: VS Code, Cursor, GitHub, Whisper, Ollama, INFERENCE_API_KEY not croc/rock API key, ' +
            'design language not sign language, agent prompt.'
        );
    }

    private relativePath(uri: vscode.Uri): string {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (folder) {
            return path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        }
        return path.basename(uri.fsPath);
    }
}

function flattenSymbolNames(symbols: vscode.DocumentSymbol[]): string[] {
    const names: string[] = [];
    for (const sym of symbols) {
        names.push(sym.name);
        if (sym.children?.length) {
            names.push(...flattenSymbolNames(sym.children));
        }
    }
    return names;
}

function isUsefulTerm(term: string): boolean {
    if (term.length < 2 || term.length > 80) {
        return false;
    }
    if (/^[\d_]+$/.test(term)) {
        return false;
    }
    return true;
}
