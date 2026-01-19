import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface TokenColor {
  scope?: string | string[];
  settings: {
    foreground?: string;
    fontStyle?: string;
  };
}

interface ThemeData {
  colors?: Record<string, string>;
  tokenColors?: TokenColor[];
  include?: string;
}

// Map TextMate scopes to highlight.js/markdown preview classes
const scopeToClassMap: Record<string, string[]> = {
  'comment': ['.hljs-comment', '.hljs-quote'],
  'string': ['.hljs-string', '.hljs-addition'],
  'keyword': ['.hljs-keyword', '.hljs-selector-tag'],
  'keyword.control': ['.hljs-keyword'],
  'keyword.operator': ['.hljs-keyword'],
  'constant.numeric': ['.hljs-number'],
  'constant.language': ['.hljs-literal'],
  'constant': ['.hljs-literal', '.hljs-number'],
  'variable': ['.hljs-variable', '.hljs-template-variable'],
  'variable.parameter': ['.hljs-params'],
  'entity.name.function': ['.hljs-title.function_', '.hljs-title'],
  'entity.name.class': ['.hljs-title.class_', '.hljs-title'],
  'entity.name.type': ['.hljs-type', '.hljs-title.class_'],
  'entity.name.tag': ['.hljs-tag', '.hljs-name', '.hljs-selector-tag'],
  'entity.other.attribute-name': ['.hljs-attr', '.hljs-attribute'],
  'support.function': ['.hljs-built_in'],
  'support.class': ['.hljs-built_in'],
  'support.type': ['.hljs-type'],
  'storage': ['.hljs-keyword'],
  'storage.type': ['.hljs-keyword', '.hljs-type'],
  'meta.tag': ['.hljs-tag'],
  'punctuation': ['.hljs-punctuation'],
  'markup.heading': ['.hljs-section'],
  'markup.bold': ['.hljs-strong'],
  'markup.italic': ['.hljs-emphasis'],
  'markup.deleted': ['.hljs-deletion'],
  'markup.inserted': ['.hljs-addition'],
};

export function activate(context: vscode.ExtensionContext) {
  // Generate on activation
  generateThemeTokensCss(context);

  // Regenerate on theme change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('workbench.colorTheme')) {
        generateThemeTokensCss(context);
        vscode.commands.executeCommand('markdown.preview.refresh');
      }
    })
  );

  // Register a command to manually regenerate
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownThemeSync.regenerate', () => {
      generateThemeTokensCss(context);
      vscode.commands.executeCommand('markdown.preview.refresh');
    })
  );
}

async function generateThemeTokensCss(context: vscode.ExtensionContext) {
  try {
    const tokenColors = await getActiveThemeTokenColors();
    const css = generateCssFromTokenColors(tokenColors);

    const mediaPath = path.join(context.extensionPath, 'media', 'theme-tokens.css');
    fs.writeFileSync(mediaPath, css, 'utf8');

    console.log('Markdown Theme Sync: Generated theme-tokens.css');
  } catch (error) {
    console.error('Markdown Theme Sync: Failed to generate theme CSS', error);
  }
}

async function getActiveThemeTokenColors(): Promise<TokenColor[]> {
  const config = vscode.workspace.getConfiguration('workbench');
  const themeName = config.get<string>('colorTheme', '');

  // Search through all extensions for the theme
  for (const ext of vscode.extensions.all) {
    const contributes = ext.packageJSON?.contributes;
    if (!contributes?.themes) continue;

    for (const theme of contributes.themes) {
      if (theme.label === themeName || theme.id === themeName) {
        const themePath = path.join(ext.extensionPath, theme.path);
        return await loadThemeTokenColors(themePath);
      }
    }
  }

  // Fallback: check built-in themes
  const builtinThemesPath = path.join(
    vscode.env.appRoot,
    'extensions'
  );

  if (fs.existsSync(builtinThemesPath)) {
    const themeExtensions = fs.readdirSync(builtinThemesPath)
      .filter(name => name.startsWith('theme-'));

    for (const extName of themeExtensions) {
      const pkgPath = path.join(builtinThemesPath, extName, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        for (const theme of pkg.contributes?.themes || []) {
          if (theme.label === themeName || theme.id === themeName) {
            const themePath = path.join(builtinThemesPath, extName, theme.path);
            return await loadThemeTokenColors(themePath);
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  return [];
}

async function loadThemeTokenColors(themePath: string): Promise<TokenColor[]> {
  if (!fs.existsSync(themePath)) return [];

  try {
    const content = fs.readFileSync(themePath, 'utf8');
    const theme: ThemeData = JSON.parse(content);
    let tokenColors = theme.tokenColors || [];

    // Handle theme includes
    if (theme.include) {
      const includePath = path.join(path.dirname(themePath), theme.include);
      const parentColors = await loadThemeTokenColors(includePath);
      tokenColors = [...parentColors, ...tokenColors];
    }

    return tokenColors;
  } catch (error) {
    console.error('Failed to load theme:', themePath, error);
    return [];
  }
}

function generateCssFromTokenColors(tokenColors: TokenColor[]): string {
  const cssRules: Map<string, { color?: string; fontStyle?: string }> = new Map();

  // Process token colors and map to CSS classes
  for (const token of tokenColors) {
    if (!token.scope || !token.settings.foreground) continue;

    const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];

    for (const scope of scopes) {
      // Find matching CSS classes for this scope
      for (const [scopePattern, classes] of Object.entries(scopeToClassMap)) {
        if (scope === scopePattern || scope.startsWith(scopePattern + '.')) {
          for (const cls of classes) {
            const existing = cssRules.get(cls) || {};
            // More specific scopes should override
            if (!existing.color) {
              existing.color = token.settings.foreground;
            }
            if (token.settings.fontStyle && !existing.fontStyle) {
              existing.fontStyle = token.settings.fontStyle;
            }
            cssRules.set(cls, existing);
          }
        }
      }
    }
  }

  // Also check for broader scope matches
  for (const token of tokenColors) {
    if (!token.scope || !token.settings.foreground) continue;

    const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];

    for (const scope of scopes) {
      for (const [scopePattern, classes] of Object.entries(scopeToClassMap)) {
        if (scopePattern.startsWith(scope)) {
          for (const cls of classes) {
            const existing = cssRules.get(cls);
            if (!existing?.color) {
              cssRules.set(cls, {
                color: token.settings.foreground,
                fontStyle: token.settings.fontStyle
              });
            }
          }
        }
      }
    }
  }

  // Generate CSS
  let css = `/* Auto-generated from editor theme - do not edit */\n\n`;

  // Add code block base styling
  css += `body.vscode-dark pre code,
body.vscode-dark code,
body.vscode-high-contrast pre code,
body.vscode-high-contrast code,
body.vscode-light pre code,
body.vscode-light code {
  color: var(--vscode-editor-foreground) !important;
}\n\n`;

  for (const [selector, styles] of cssRules) {
    if (!styles.color) continue;

    const fullSelector = `body.vscode-dark pre code ${selector},
body.vscode-dark code${selector},
body.vscode-high-contrast pre code ${selector},
body.vscode-high-contrast code${selector},
body.vscode-light pre code ${selector},
body.vscode-light code${selector}`;

    let rules = `color: ${styles.color} !important;`;
    if (styles.fontStyle) {
      if (styles.fontStyle.includes('italic')) {
        rules += ` font-style: italic !important;`;
      }
      if (styles.fontStyle.includes('bold')) {
        rules += ` font-weight: bold !important;`;
      }
      if (styles.fontStyle.includes('underline')) {
        rules += ` text-decoration: underline !important;`;
      }
    }

    css += `${fullSelector} {\n  ${rules}\n}\n\n`;
  }

  return css;
}

export function deactivate() {}
