import { loadOpenRouterConfig } from '../openrouter/config';
import { OpenRouterService } from './openrouter.service';

let cachedService: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (cachedService) {
    return cachedService;
  }

  const config = loadOpenRouterConfig();
  cachedService = new OpenRouterService(config);
  return cachedService;
}

export function resetOpenRouterServiceCache(): void {
  cachedService = null;
}


