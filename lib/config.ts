export function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  return "http://192.168.1.109:8000";
}
