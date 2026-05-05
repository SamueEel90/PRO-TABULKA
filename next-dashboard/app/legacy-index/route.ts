import { readFile } from 'node:fs/promises';
import path from 'node:path';

const INDEX_INCLUDE_HELPERS = /<\?!=\s*include\('dashboardSharedHelpers'\);?\s*\?>/g;
const INDEX_INCLUDE_STYLES = /<\?!=\s*include\('sharedStyles'\);?\s*\?>/g;

const APPS_SCRIPT_SHIM = `<script>
  (function() {
    function createRunner(successHandler, failureHandler) {
      return new Proxy({}, {
        get: function(_, property) {
          if (property === 'withSuccessHandler') {
            return function(handler) {
              return createRunner(handler, failureHandler);
            };
          }

          if (property === 'withFailureHandler') {
            return function(handler) {
              return createRunner(successHandler, handler);
            };
          }

          return function() {
            var methodName = String(property || '');
            var args = Array.prototype.slice.call(arguments);

            fetch('/api/legacy/run', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ method: methodName, args: args })
            })
              .then(function(response) {
                return response.json();
              })
              .then(function(payload) {
                if (payload && payload.ok) {
                  if (typeof successHandler === 'function') {
                    successHandler(payload.result);
                  }
                  return;
                }

                var error = { message: payload && payload.error ? payload.error : 'Legacy volanie zlyhalo.' };
                if (typeof failureHandler === 'function') {
                  failureHandler(error);
                  return;
                }
                console.warn(error.message, args);
              })
              .catch(function(error) {
                var normalizedError = { message: error && error.message ? error.message : 'Legacy volanie zlyhalo.' };
                if (typeof failureHandler === 'function') {
                  failureHandler(normalizedError);
                  return;
                }
                console.error(normalizedError.message, args);
              });

            return undefined;
          };
        }
      });
    }

    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.host = window.google.script.host || { close: function() {} };
    window.google.script.run = createRunner(null, null);
  })();
</script>`;

async function readLegacyAsset(fileName: string) {
  const filePath = path.resolve(process.cwd(), 'legacy-assets', fileName);
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Legacy asset not found: ${fileName}`);
    }
    throw error;
  }
}

function resolveLegacyAssetFileName(asset: string) {
  switch (asset) {
    case 'sumar':
      return 'sumar.html';
    default:
      return 'Index.html';
  }
}

async function buildLegacyHtml(asset: string) {
  const fileName = resolveLegacyAssetFileName(asset);
  const [indexHtml, sharedHelpers, sharedStyles] = await Promise.all([
    readLegacyAsset(fileName),
    readLegacyAsset('dashboardSharedHelpers.html'),
    readLegacyAsset('sharedStyles.html'),
  ]);

  return indexHtml
    .replace('<base target="_top">', '<base target="_self">')
    .replace(INDEX_INCLUDE_HELPERS, sharedHelpers)
    .replace(INDEX_INCLUDE_STYLES, sharedStyles)
    .replace('</head>', `${APPS_SCRIPT_SHIM}\n</head>`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = String(url.searchParams.get('asset') || 'index').toLowerCase();
  const html = await buildLegacyHtml(asset);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}