"use strict";
import express from "express";
import { AddressInfo } from "net";
import { createProxyMiddleware } from "http-proxy-middleware";
import * as vscode from "vscode";

let extensionUri: vscode.Uri;

let PORT = 7654;
const START_SPRING_IO = "https://developer.mozilla.org/";

export function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "vscode-mdn-reference.show-mdn-reference",
      launchMDNReferenceURL
    )
  );
  const app = express();

  app.use(
    "/**",
    createProxyMiddleware({
      target: START_SPRING_IO,
      changeOrigin: true,
      followRedirects: true,
      onProxyRes: (proxyRes) => {
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["X-Frame-Options"];
        delete proxyRes.headers["content-security-policy"];
        delete proxyRes.headers["Content-Security-Policy"];
      },
    })
  );

  const server = app.listen(() => {
    PORT = (server.address() as AddressInfo).port;
  });
}

export function deactivate() {}

async function launchMDNReferenceURL(editor: vscode.TextEditor) {
  const hovers: vscode.Hover[] | undefined =
    await getHoversAtCurrentPositionInEditor(editor);
  let mdnReferenceURLSet = false;
  let mdnReferenceURL = "";
  if (hovers && hovers.length > 0) {
    const parts = hovers
      .flatMap((hover) => hover.contents)
      .map((content) => getMarkdown(content))
      .filter((content) => content.length > 0);

    if (parts && parts.length > 0) {
      parts.forEach((part: string) => {
        const lines = part.split(/\r?\n/);
        lines.forEach((line) => {
          if (line.startsWith("[MDN Reference](")) {
            mdnReferenceURL = line.replace(/\[MDN Reference\]\(/, '').replace(/\)/, '');
            mdnReferenceURLSet = true;
          }
        });
      });
    }
  }
  if (mdnReferenceURLSet) {
    if (vscode.workspace.getConfiguration('vscode-mdn-reference').get<boolean>('openInExternalBrowser')) {
      vscode.env.openExternal(vscode.Uri.parse(mdnReferenceURL));
    } else {
      WebsitePanel.createOrShow(extensionUri);
      WebsitePanel.showMDN(`http://localhost:${PORT}${vscode.Uri.parse(mdnReferenceURL).path}`);
    }

  } else {
    vscode.window.showWarningMessage("MDN Reference not available at cursor!");
  }
}

function getHoversAtCurrentPositionInEditor(editor: vscode.TextEditor) {
  return vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    editor.document.uri,
    editor.selection.active
  );
}

function getMarkdown(
  content: vscode.MarkdownString | vscode.MarkedString
): string {
  if (typeof content === "string") {
    return content;
  } else if (content instanceof vscode.MarkdownString) {
    return content.value;
  } else {
    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(content.value, content.language);
    return markdown.value;
  }
}


/**
 * Manages Spring Initializr webview panel
 */
class WebsitePanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: WebsitePanel | undefined;

  public static readonly viewType = 'webview-iframe';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    // If we already have a panel, show it.
    if (WebsitePanel.currentPanel) {
      WebsitePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      WebsitePanel.viewType,
      'Webview iframe',
      vscode.ViewColumn.Beside,
      {
        // Enable javascript in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.parse(`http://localhost:${PORT}/`),
          vscode.Uri.parse(START_SPRING_IO)
        ]
      }
    );

    WebsitePanel.currentPanel = new WebsitePanel(panel, extensionUri);
  }

  public static showMDN(url: string) {
    if (WebsitePanel.currentPanel) {
      WebsitePanel.currentPanel._panel.webview.postMessage({
        command: 'mdn',
        url
      });
    }
  }

  public static hide() {
    if (WebsitePanel.currentPanel) {
      WebsitePanel.currentPanel._panel.dispose();
      WebsitePanel.currentPanel = undefined;
    }
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WebsitePanel.currentPanel = new WebsitePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    WebsitePanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-webview-iframe.css');
    // Uri to load styles into webview
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

    const scriptPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-webview-iframe .js');
    // Uri to load styles into webview
    const scriptMainUri = webview.asWebviewUri(scriptPathMainPath);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${stylesMainUri}" rel="stylesheet">
  <title>Webview iframe</title>
</head>
<body>
  <iframe id="webview-iframe" src="about:blanck"></iframe>
  <script src="${scriptMainUri}"></script>
</body>
</html>
`;
  }
}