const originalFetch = window.fetch.bind(window);
let sessionRedirecting = false;

window.fetch = (input, init = {}) => {
  const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
  if (requestUrl.origin !== window.location.origin) {
    return originalFetch(input, init);
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  headers.set("X-MyLedger-Request", "fetch");

  return originalFetch(input, { ...init, headers }).then((response) => {
    if (response.headers.get("X-Session-Expired") === "true" && !sessionRedirecting) {
      sessionRedirecting = true;
      window.location.assign("/login?expired=1");
    }
    return response;
  });
};
