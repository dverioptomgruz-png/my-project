const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
const BASE_URL = RAW_API_URL
  ? (RAW_API_URL.endsWith("/api") ? RAW_API_URL : `${RAW_API_URL}/api`)
  : "/api";

interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

interface ApiError {
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  private async handleUnauthorized(): Promise<boolean> {
    // If already refreshing, wait for the existing refresh
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.refreshAccessToken().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...customHeaders,
    };

    const token = this.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
    retry = true
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: this.buildHeaders(customHeaders),
    };

    if (body !== undefined && method !== "GET" && method !== "DELETE") {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Handle 401 Unauthorized
      if (response.status === 401 && retry) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          // Retry the original request with new token
          return this.request<T>(method, path, body, customHeaders, false);
        }

        // Refresh failed - clear tokens and redirect to login
        this.clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        throw {
          message: "Authentication failed",
          status: 401,
        } satisfies ApiError;
      }

      // Handle other error responses
      if (!response.ok) {
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
        } catch {
          // Response body wasn't JSON
        }

        throw {
          message:
            (errorData.message as string) ||
            (errorData.detail as string) ||
            `Request failed with status ${response.status}`,
          status: response.status,
          details: errorData,
        } satisfies ApiError;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {
          data: null as T,
          status: response.status,
          ok: true,
        };
      }

      const data = await response.json();
      return {
        data: data as T,
        status: response.status,
        ok: true,
      };
    } catch (error) {
      // Re-throw ApiError as-is
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        "message" in error
      ) {
        throw error;
      }

      // Network error or other unexpected error
      throw {
        message: error instanceof Error ? error.message : "Network error",
        status: 0,
      } satisfies ApiError;
    }
  }

  async get<T>(
    path: string,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, customHeaders);
  }

  async post<T>(
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, body, customHeaders);
  }

  async patch<T>(
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, body, customHeaders);
  }

  async delete<T>(
    path: string,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, customHeaders);
  }
}

export const api = new ApiClient(BASE_URL);
export type { ApiResponse, ApiError };
