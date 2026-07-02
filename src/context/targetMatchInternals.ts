export function looksLikeResolvableSymbol(term: string): boolean {
    return term.length >= 4 && /[A-Z]/.test(term) && !term.includes('/');
}

export function linkSymbolToOpenFile(symbol: string, targetFiles: string[]): string | undefined {
    const symLower = symbol.toLowerCase();
    const stem = symLower.replace(/service$|adapter$|manager$|compiler$|bridge$/i, '');
    for (const file of targetFiles) {
        const pathLower = file.toLowerCase();
        if (pathLower.includes(symLower) || (stem.length >= 4 && pathLower.includes(stem))) {
            return file;
        }
        const base = (file.split(/[/\\]/).pop() ?? '').toLowerCase();
        if (stem.length >= 4 && base.includes(stem)) {
            return file;
        }
    }
    return undefined;
}
