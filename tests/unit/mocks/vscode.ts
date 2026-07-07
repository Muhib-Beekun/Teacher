export enum ProgressLocation {
    Notification = 15
}

export class Uri {
    public readonly fsPath: string;

    private constructor(fsPath: string) {
        this.fsPath = fsPath;
    }

    public static file(fsPath: string): Uri {
        return new Uri(fsPath);
    }
}

export const extensions = {
    getExtension: () => undefined,
    onDidChange: (_listener: () => void) => ({ dispose: () => undefined })
};

export const window = {
    showWarningMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    withProgress: async <T>(_opts: unknown, task: () => Promise<T>) => task()
};

export const commands = {
    executeCommand: async () => undefined
};
