import * as path from 'path';
import * as vscode from 'vscode';
import { readWorkspaceCodewords } from '../config/CodewordsManager';
import { basenameTerm, parsePackageJsonDeps } from './lexicalScan';
import {
    applyUtteranceBoost,
    buildSttPromptFromTerms,
    isUsefulContextTerm,
    rankAndCapTerms,
    TermCandidate
} from './contextIndexRank';
import { emptyVoiceSessionContext, VoiceSessionContext } from './VoiceSessionContext';

export interface RebuildOptions {
    /** Latest utterance text — boosts basename matches (post-first STT pass). */
    recentUtterance?: string;
    /** Full workspace scan including cold-tier seed. Default true for rebuild(), false for refresh(). */
    full?: boolean;
}

interface SymbolCacheEntry {
    terms: string[];
    relPath: string;
    lastAccess: number;
}

interface BasenameCacheEntry {
    term: string;
    lastSeen: number;
}

const MAX_WARM_SYMBOL_FILES = 150;
const MAX_COLD_BASENAMES = 2000;
const COLD_SEED_LIMIT = 120;
const SAVE_DEBOUNCE_MS = 200;
const RANK_DEBOUNCE_MS = 75;
const BULK_EVENT_THRESHOLD = 100;
const BULK_RECONCILE_MS = 500;

export class WorkspaceContextIndex {
    private context: VoiceSessionContext = emptyVoiceSessionContext();
    private workChain: Promise<VoiceSessionContext> = Promise.resolve(emptyVoiceSessionContext());

    private readonly openUris = new Set<string>();
    private readonly symbolByUri = new Map<string, SymbolCacheEntry>();
    private readonly basenameByUri = new Map<string, BasenameCacheEntry>();

    private dependencyTerms: string[] = [];
    private codewordTerms: string[] = [];

    private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private rankTimer: ReturnType<typeof setTimeout> | undefined;
    private bulkEventCount = 0;
    private bulkTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingUtterance: string | undefined;

    public getContext(): VoiceSessionContext {
        return this.context;
    }

    /** Full rebuild: refresh globals, scan open files, optionally seed cold tier. */
    public rebuild(options: RebuildOptions = {}): Promise<VoiceSessionContext> {
        return this.enqueueWork(() => this.doRefresh({ ...options, full: true }));
    }

    /** Light refresh: globals + open-file rescan + re-rank (no workspace globs). */
    public refresh(options: RebuildOptions = {}): Promise<VoiceSessionContext> {
        return this.enqueueWork(() => this.doRefresh({ ...options, full: false }));
    }

    public async initialize(): Promise<VoiceSessionContext> {
        this.syncOpenDocuments();
        return this.rebuild();
    }

    public dispose(): void {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer);
        }
        this.saveTimers.clear();
        if (this.rankTimer) {
            clearTimeout(this.rankTimer);
        }
        if (this.bulkTimer) {
            clearTimeout(this.bulkTimer);
        }
    }

    public onDocumentOpened(uri: vscode.Uri): void {
        if (!this.isFileUri(uri)) {
            return;
        }
        const key = uri.toString();
        this.openUris.add(key);
        void this.enqueueWork(async () => {
            await this.ensureSymbolsForUri(uri);
            this.evictWarmSymbols();
            this.applyRank();
            return this.context;
        });
    }

    public onDocumentClosed(uri: vscode.Uri): void {
        if (!this.isFileUri(uri)) {
            return;
        }
        const key = uri.toString();
        this.openUris.delete(key);
        const entry = this.symbolByUri.get(key);
        if (entry) {
            entry.lastAccess = Date.now();
        }
        this.scheduleRankRefresh();
    }

    public onDocumentSaved(uri: vscode.Uri): void {
        if (!this.isFileUri(uri)) {
            return;
        }
        const key = uri.toString();
        const existing = this.saveTimers.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        this.saveTimers.set(
            key,
            setTimeout(() => {
                this.saveTimers.delete(key);
                void this.enqueueWork(async () => {
                    await this.ensureSymbolsForUri(uri, true);
                    this.applyRank();
                    return this.context;
                });
            }, SAVE_DEBOUNCE_MS)
        );
    }

    public onFilesCreated(files: readonly vscode.Uri[]): void {
        for (const uri of files) {
            if (!this.isFileUri(uri)) {
                continue;
            }
            this.noteBulkEvent();
            this.addColdBasename(uri);
        }
        if (this.bulkEventCount === 0) {
            this.scheduleRankRefresh();
        }
    }

    public onFilesDeleted(files: readonly vscode.Uri[]): void {
        for (const uri of files) {
            if (!this.isFileUri(uri)) {
                continue;
            }
            this.noteBulkEvent();
            const key = uri.toString();
            this.symbolByUri.delete(key);
            this.basenameByUri.delete(key);
            this.openUris.delete(key);
        }
        if (this.bulkEventCount === 0) {
            this.scheduleRankRefresh();
        }
    }

    public onFilesRenamed(oldUri: vscode.Uri, newUri: vscode.Uri): void {
        if (!this.isFileUri(oldUri) && !this.isFileUri(newUri)) {
            return;
        }
        this.noteBulkEvent();
        const oldKey = oldUri.toString();
        const newKey = newUri.toString();
        const wasOpen = this.openUris.delete(oldKey);
        if (wasOpen && this.isFileUri(newUri)) {
            this.openUris.add(newKey);
        }
        this.symbolByUri.delete(oldKey);
        this.basenameByUri.delete(oldKey);
        if (this.isFileUri(newUri)) {
            this.addColdBasename(newUri);
            if (wasOpen) {
                void this.enqueueWork(async () => {
                    await this.ensureSymbolsForUri(newUri, true);
                    this.applyRank();
                    return this.context;
                });
            }
        }
        if (this.bulkEventCount === 0) {
            this.scheduleRankRefresh();
        }
    }

    public onWorkspaceFoldersChanged(): void {
        this.symbolByUri.clear();
        this.basenameByUri.clear();
        this.openUris.clear();
        this.syncOpenDocuments();
        void this.rebuild();
    }

    public scheduleRankRefresh(utterance?: string): void {
        if (utterance) {
            this.pendingUtterance = utterance;
        }
        if (this.rankTimer) {
            clearTimeout(this.rankTimer);
        }
        this.rankTimer = setTimeout(() => {
            this.rankTimer = undefined;
            const recent = this.pendingUtterance;
            this.pendingUtterance = undefined;
            this.applyRank(recent);
        }, RANK_DEBOUNCE_MS);
    }

    private enqueueWork(task: () => Promise<VoiceSessionContext>): Promise<VoiceSessionContext> {
        const next = this.workChain.then(task, task);
        this.workChain = next.catch(() => this.context);
        return next;
    }

    private async doRefresh(options: RebuildOptions): Promise<VoiceSessionContext> {
        this.syncOpenDocuments();
        await this.refreshGlobalSlices();
        await this.rescanOpenDocuments();
        if (options.full) {
            await this.seedColdTier();
        }
        this.applyRank(options.recentUtterance);
        return this.context;
    }

    private syncOpenDocuments(): void {
        this.openUris.clear();
        for (const doc of vscode.workspace.textDocuments) {
            if (!doc.isUntitled && doc.uri.scheme === 'file') {
                this.openUris.add(doc.uri.toString());
            }
        }
    }

    private async refreshGlobalSlices(): Promise<void> {
        this.dependencyTerms = await this.loadDependencyTerms();
        this.codewordTerms = await this.loadCodewordTerms();
    }

    private async rescanOpenDocuments(): Promise<void> {
        for (const uriStr of this.openUris) {
            await this.ensureSymbolsForUri(vscode.Uri.parse(uriStr), true);
        }
        this.evictWarmSymbols();
    }

    private async seedColdTier(): Promise<void> {
        const excludePattern = this.getExcludePattern();
        const folders = vscode.workspace.workspaceFolders ?? [];
        if (!folders.length) {
            return;
        }

        const files = await vscode.workspace.findFiles('**/*', excludePattern, COLD_SEED_LIMIT);
        for (const uri of files) {
            this.addColdBasename(uri);
        }
        this.evictColdBasenames();
    }

    private applyRank(recentUtterance?: string): void {
        const config = vscode.workspace.getConfiguration('teacher.context');
        const maxTerms = config.get<number>('maxTerms', 200);
        const candidates = this.buildCandidates(recentUtterance);
        const dictionary_context = rankAndCapTerms(candidates, maxTerms);
        const targetFiles = this.buildTargetFiles();

        this.context = {
            dictionary_context,
            targetFiles,
            stt_prompt: buildSttPromptFromTerms(dictionary_context),
            builtAt: Date.now()
        };
    }

    private buildCandidates(recentUtterance?: string): TermCandidate[] {
        const activeUri = vscode.window.activeTextEditor?.document.uri;
        const activeKey = activeUri?.scheme === 'file' ? activeUri.toString() : undefined;
        const candidates: TermCandidate[] = [];

        for (const [uriStr, entry] of this.symbolByUri) {
            const inActive = uriStr === activeKey;
            const inOpen = this.openUris.has(uriStr);
            if (inActive || inOpen) {
                entry.lastAccess = Date.now();
            }

            for (const name of entry.terms) {
                if (!isUsefulContextTerm(name)) {
                    continue;
                }
                let score = 30;
                if (inActive) {
                    score += 100;
                }
                if (inOpen) {
                    score += 50;
                }
                candidates.push({ term: name, score, source: 'symbol' });
            }

            if (inActive || inOpen) {
                const base = basenameTerm(entry.relPath);
                if (isUsefulContextTerm(base)) {
                    candidates.push({ term: base, score: inActive ? 70 : 45, source: 'open_file' });
                }
            }
        }

        for (const entry of this.basenameByUri.values()) {
            if (isUsefulContextTerm(entry.term)) {
                candidates.push({ term: entry.term, score: 5, source: 'basename' });
            }
        }

        for (const dep of this.dependencyTerms) {
            candidates.push({ term: dep, score: 20, source: 'dependency' });
        }

        for (const word of this.codewordTerms) {
            candidates.push({ term: word, score: 60, source: 'codeword' });
        }

        for (const term of ['INFERENCE_API_KEY', 'OPENAI_API_KEY', 'DEEPGRAM_API_KEY']) {
            candidates.push({ term, score: 55, source: 'env' });
        }

        if (recentUtterance) {
            applyUtteranceBoost(candidates, recentUtterance);
        }

        return candidates;
    }

    private buildTargetFiles(): string[] {
        const activeUri = vscode.window.activeTextEditor?.document.uri;
        const targetFiles = new Set<string>();

        if (activeUri?.scheme === 'file') {
            targetFiles.add(this.relativePath(activeUri));
        }
        for (const uriStr of this.openUris) {
            targetFiles.add(this.relativePath(vscode.Uri.parse(uriStr)));
        }

        return [...targetFiles].slice(0, 12);
    }

    private async ensureSymbolsForUri(uri: vscode.Uri, force = false): Promise<void> {
        if (!this.isFileUri(uri)) {
            return;
        }

        const key = uri.toString();
        if (!force && this.symbolByUri.has(key)) {
            const entry = this.symbolByUri.get(key)!;
            entry.lastAccess = Date.now();
            return;
        }

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            uri
        );

        const relPath = this.relativePath(uri);
        const terms: string[] = [];
        if (symbols?.length) {
            for (const name of flattenSymbolNames(symbols)) {
                if (isUsefulContextTerm(name)) {
                    terms.push(name);
                }
            }
        }

        this.symbolByUri.set(key, {
            terms,
            relPath,
            lastAccess: Date.now()
        });
        this.addColdBasename(uri);
    }

    private addColdBasename(uri: vscode.Uri): void {
        if (!this.isFileUri(uri)) {
            return;
        }
        const rel = this.relativePath(uri);
        const term = basenameTerm(rel);
        if (!isUsefulContextTerm(term)) {
            return;
        }
        this.basenameByUri.set(uri.toString(), { term, lastSeen: Date.now() });
        this.evictColdBasenames();
    }

    private evictWarmSymbols(): void {
        const maxTotal = MAX_WARM_SYMBOL_FILES + this.openUris.size;
        if (this.symbolByUri.size <= maxTotal) {
            return;
        }

        const evictable = [...this.symbolByUri.entries()]
            .filter(([key]) => !this.openUris.has(key))
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

        while (this.symbolByUri.size > maxTotal && evictable.length) {
            const [key] = evictable.shift()!;
            this.symbolByUri.delete(key);
        }
    }

    private evictColdBasenames(): void {
        if (this.basenameByUri.size <= MAX_COLD_BASENAMES) {
            return;
        }
        const sorted = [...this.basenameByUri.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
        const removeCount = this.basenameByUri.size - MAX_COLD_BASENAMES;
        for (let i = 0; i < removeCount; i++) {
            this.basenameByUri.delete(sorted[i][0]);
        }
    }

    private noteBulkEvent(): void {
        this.bulkEventCount++;
        if (this.bulkTimer) {
            clearTimeout(this.bulkTimer);
        }
        this.bulkTimer = setTimeout(() => {
            this.bulkTimer = undefined;
            const count = this.bulkEventCount;
            this.bulkEventCount = 0;
            if (count >= BULK_EVENT_THRESHOLD) {
                void this.reconcileAfterBulk();
            }
        }, BULK_RECONCILE_MS);
    }

    private async reconcileAfterBulk(): Promise<void> {
        for (const key of [...this.symbolByUri.keys()]) {
            if (!this.openUris.has(key)) {
                this.symbolByUri.delete(key);
            }
        }
        this.basenameByUri.clear();
        await this.rescanOpenDocuments();
        this.applyRank();
    }

    private async loadDependencyTerms(): Promise<string[]> {
        const terms = new Set<string>();
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const pkgUri = vscode.Uri.joinPath(folder.uri, 'package.json');
            try {
                const raw = await vscode.workspace.fs.readFile(pkgUri);
                const pkg = JSON.parse(Buffer.from(raw).toString('utf8')) as Record<string, unknown>;
                for (const dep of parsePackageJsonDeps(pkg)) {
                    terms.add(dep);
                    if (dep.startsWith('@')) {
                        const scoped = dep.split('/').pop();
                        if (scoped) {
                            terms.add(scoped);
                        }
                    }
                }
            } catch {
                // no package.json
            }
        }
        return [...terms];
    }

    private async loadCodewordTerms(): Promise<string[]> {
        const terms = new Set<string>();
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const words = await readWorkspaceCodewords(folder);
            for (const word of words) {
                terms.add(word);
            }
        }
        return [...terms];
    }

    private getExcludePattern(): string {
        const excludeGlobs = vscode.workspace.getConfiguration('teacher.context').get<string[]>('excludeGlobs', [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/out/**',
            '**/.env*'
        ]);
        return `{${excludeGlobs.join(',')}}`;
    }

    private isFileUri(uri: vscode.Uri): boolean {
        return uri.scheme === 'file';
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
