/**
 * Where a backend route lives for this client. The desktop shell reports an
 * origin because the bundled server picks its own port; the browser keeps the
 * relative path, which the dev server proxies. No origin is ever compiled in.
 */
export const endpointUrl = (serverUrl: string, endpoint: string) =>
  serverUrl ? new URL(endpoint, serverUrl).href : endpoint;
