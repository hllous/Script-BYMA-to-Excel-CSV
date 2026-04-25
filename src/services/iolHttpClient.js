const axios = require("axios");

class IolHttpClient {
  constructor({ authService, baseUrl, timeoutMs, retries, logger }) {
    this.authService = authService;
    this.retries = retries;
    this.logger = logger;

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs
    });
  }

  async get(url, options = {}) {
    return this.request({ ...options, method: "GET", url });
  }

  async request({ method, url, params, data, headers, skipAuth = false }) {
    const maxAttempts = Math.max(1, Number(this.retries) + 1);
    let authRetried = false;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const authHeaders = { ...(headers || {}) };
        if (!skipAuth) {
          const accessToken = await this.authService.getAccessToken();
          authHeaders.Authorization = `Bearer ${accessToken}`;
        }

        const response = await this.http.request({
          method,
          url,
          params,
          data,
          headers: authHeaders
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const status = error.response ? error.response.status : null;

        if (!skipAuth && status === 401 && !authRetried) {
          authRetried = true;
          this.authService.invalidateAccessToken();
          await this.authService.refreshAccessToken().catch(async () => {
            await this.authService.authenticate();
          });
          continue;
        }

        if (attempt < maxAttempts && isRetriableStatus(status, error.code)) {
          const delayMs = getBackoffMs(attempt);
          this.logger.warn(
            `Reintento ${attempt}/${maxAttempts - 1} para ${method} ${url} (status ${status || "N/A"})`
          );
          await sleep(delayMs);
          continue;
        }

        break;
      }
    }

    const status = lastError && lastError.response ? lastError.response.status : "N/A";
    const detail = lastError && lastError.message ? lastError.message : "error desconocido";
    throw new Error(`Fallo ${method} ${url}. Status=${status}. Detalle=${detail}`);
  }
}

function isRetriableStatus(status, errorCode) {
  if (!status) {
    return ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND"].includes(errorCode);
  }

  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function getBackoffMs(attempt) {
  return Math.min(4000, 300 * Math.pow(2, attempt - 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  IolHttpClient
};
