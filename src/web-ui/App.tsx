import { useEffect } from 'preact/hooks';
import { refreshHealth, loadSession } from './api';
import { setStatus } from './state';
import { TopBar } from './components/TopBar';
import { SettingsPanel } from './components/SettingsPanel';
import { CapturePanel } from './components/CapturePanel';
import { TranscriptPane } from './components/TranscriptPane';
import { BriefPane } from './components/BriefPane';
import { FixPopover } from './components/FixPopover';

export function App() {
    useEffect(() => {
        refreshHealth()
            .then(() => loadSession())
            .catch(() => setStatus('Cannot reach Teacher server', 'warn'));
    }, []);

    return (
        <>
            <TopBar />
            <SettingsPanel />
            <main class="layout">
                <CapturePanel />
                <TranscriptPane />
                <BriefPane />
            </main>
            <FixPopover />
        </>
    );
}
