const axios = require("axios");

class AuthService {
  constructor({ username, password, authUrl, timeoutMs, logger }) {
    this.username = username;
    this.password = password;
    this.authUrl = authUrl;
    this.timeoutMs = timeoutMs;
    this.logger = logger;

    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAtMs = 0;
  }

  async getAccessToken() {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          this.logger.warn(`Refresh token fallo, se intenta login completo: ${error.message}`);
          await this.authenticate();
        }
      } else {
        await this.authenticate();
      }
    }

    return this.accessToken;
  }

  async authenticate() {
    if (!this.username || !this.password) {
      throw new Error("Faltan credenciales de IOL para autenticacion");
    }

    const body = new URLSearchParams({
      grant_type: "password",
      username: this.username,
      password: this.password
    });

    const response = await axios.post(this.authUrl, body.toString(), {
      timeout: this.timeoutMs,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    this.storeTokens(response.data);
    this.logger.info("Autenticacion inicial exitosa");
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error("No hay refresh token disponible");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken
    });

    const response = await axios.post(this.authUrl, body.toString(), {
      timeout: this.timeoutMs,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    this.storeTokens(response.data);
    this.logger.info("Token renovado exitosamente");
  }

  invalidateAccessToken() {
    this.accessToken = null;
    this.expiresAtMs = 0;
  }

  isTokenExpired() {
    const safetyBufferMs = 60 * 1000;
    return Date.now() >= this.expiresAtMs - safetyBufferMs;
  }

  storeTokens(payload) {
    const accessToken = payload && payload.access_token;
    if (!accessToken) {
      throw new Error("Respuesta de autenticacion sin access_token");
    }

    this.accessToken = accessToken;
    this.refreshToken = payload.refresh_token || this.refreshToken || null;
    const expiresInSec = Number(payload.expires_in) || 900;
    this.expiresAtMs = Date.now() + expiresInSec * 1000;
  }
}

module.exports = {
  AuthService
};
