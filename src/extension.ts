'use strict';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('vscode-mdn-reference.show-mdn-reference', maunchMDNReferenceURL));
}

export function deactivate() {
}

async function maunchMDNReferenceURL(editor: vscode.TextEditor) {
    const hovers: vscode.Hover[] | undefined = await getHoversAtCurrentPositionInEditor(editor);
    let FQNCopied = false;
    let mdnReferenceURL = '';
    if (hovers && hovers.length > 0) {
        const parts = (hovers)
            .flatMap(hover => hover.contents)
            .map(content => getMarkdown(content))
            .filter(content => content.length > 0);

        if (parts && parts.length > 0) {
            parts.forEach((part: string) => {
                const lines = part.split(/\r?\n/);
                lines.forEach((line) => {
                    if (line.startsWith('[MDN Reference](')) {
                        const to = line.length - 1;
                        mdnReferenceURL = line.substring(16, to);
                        FQNCopied = true;
                    }
                });
            });
        }
    }
    if (FQNCopied) {
        vscode.env.openExternal(vscode.Uri.parse(mdnReferenceURL));
    } else {
        vscode.window.showWarningMessage('MDN Reference not available at cursor!');
    }
}

function getHoversAtCurrentPositionInEditor(editor: vscode.TextEditor) {
    return vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        editor.document.uri,
        editor.selection.active);
}

function getMarkdown(content: vscode.MarkdownString | vscode.MarkedString) : string {
    if (typeof content === 'string') {
        return content;
    } else if (content instanceof vscode.MarkdownString) {
        return content.value;
    } else {
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(content.value, content.language);
        return markdown.value;
    }
}
