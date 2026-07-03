import { useRef } from 'preact/hooks';
import { codewordsTerms, codewordsPath, setStatus } from '../state';
import { saveCodewords } from '../api';

export function GlossarySection() {
    const inputRef = useRef<HTMLInputElement>(null);
    const terms = codewordsTerms.value;

    const addTerm = async () => {
        const term = inputRef.current?.value?.trim();
        if (!term) return;
        if (terms.includes(term)) {
            setStatus('Term already in glossary.', 'warn');
            return;
        }
        await saveCodewords([...terms, term]);
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeTerm = (term: string) => {
        saveCodewords(terms.filter(t => t !== term))
            .catch(() => setStatus('Could not remove term.', 'warn'));
    };

    return (
        <details class="settings-section">
            <summary>
                <span>
                    Glossary
                    <span class="section-hint">Your codewords for STT correction</span>
                </span>
            </summary>
            <div class="settings-section-body">
                <div class="codewords-editor">
                    <span class="hint">
                        Saved to <code>{codewordsPath.value}</code>. Homonym pass matches mishears
                        to these terms.
                    </span>
                    {terms.length === 0 && (
                        <p class="codewords-empty">No terms yet.</p>
                    )}
                    {terms.length > 0 && (
                        <ul class="codewords-list" role="list" aria-label="Glossary terms">
                            {terms.map(term => (
                                <li key={term}>
                                    <span>{term}</span>
                                    <button
                                        type="button"
                                        title="Remove term"
                                        onClick={() => removeTerm(term)}
                                        aria-label={`Remove ${term}`}
                                    >
                                        −
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div class="codewords-add">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Add term (e.g. Groq)"
                            spellcheck={false}
                            autocomplete="off"
                            aria-label="New glossary term"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTerm().catch(() => setStatus('Could not add term.', 'warn'));
                                }
                            }}
                        />
                        <button
                            type="button"
                            title="Add term"
                            aria-label="Add term"
                            onClick={() => addTerm().catch(() => setStatus('Could not add term.', 'warn'))}
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
        </details>
    );
}
