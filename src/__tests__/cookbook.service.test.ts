/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { CookbookService } from "../lib/services/cookbook.service";
import type { CookbookDTO } from "../types";

const baseCookbook: CookbookDTO = {
  id: "cookbook-1",
  title: "My Cookbook",
  is_default: true,
  user_id: "user-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  recipe_count: 0,
};

describe("CookbookService.ensureDefaultCookbook", () => {
  let service: CookbookService;

  beforeEach(() => {
    service = new CookbookService({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an existing default cookbook without creating a new one", async () => {
    const fetchDefault = vi.spyOn(service as any, "fetchDefaultCookbook").mockResolvedValue(baseCookbook);
    const createCookbook = vi.spyOn(service, "createCookbook");

    const result = await service.ensureDefaultCookbook("user-1");

    expect(result).toBe(baseCookbook);
    expect(fetchDefault).toHaveBeenCalledTimes(1);
    expect(createCookbook).not.toHaveBeenCalled();
  });

  it("creates a default cookbook when none exist", async () => {
    const createdCookbook: CookbookDTO = {
      ...baseCookbook,
      id: "cookbook-created",
      recipe_count: 0,
    };

    vi.spyOn(service as any, "fetchDefaultCookbook").mockResolvedValue(null);
    const createCookbook = vi.spyOn(service, "createCookbook").mockResolvedValue(createdCookbook);

    const result = await service.ensureDefaultCookbook("user-1");

    expect(result).toBe(createdCookbook);
    expect(createCookbook).toHaveBeenCalledWith("user-1", {
      title: "My Cookbook",
      is_default: true,
    });
  });

  it("retries with an alternate title when duplicate title is detected", async () => {
    const createdCookbook: CookbookDTO = {
      ...baseCookbook,
      id: "cookbook-duplicate",
      title: "My Cookbook (2)",
    };

    vi.spyOn(service as any, "fetchDefaultCookbook").mockResolvedValue(null);
    const createCookbook = vi
      .spyOn(service, "createCookbook")
      .mockRejectedValueOnce(new Error("DUPLICATE_TITLE"))
      .mockResolvedValueOnce(createdCookbook);

    const result = await service.ensureDefaultCookbook("user-1");

    expect(result).toBe(createdCookbook);
    expect(createCookbook).toHaveBeenNthCalledWith(1, "user-1", {
      title: "My Cookbook",
      is_default: true,
    });
    expect(createCookbook).toHaveBeenNthCalledWith(2, "user-1", {
      title: "My Cookbook (2)",
      is_default: true,
    });
  });

  it("resolves after concurrent default creation", async () => {
    const concurrentCookbook: CookbookDTO = {
      ...baseCookbook,
      id: "cookbook-concurrent",
    };

    const fetchDefault = vi
      .spyOn(service as any, "fetchDefaultCookbook")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentCookbook);

    vi.spyOn(service, "createCookbook").mockRejectedValueOnce(new Error("MULTIPLE_DEFAULTS"));

    const result = await service.ensureDefaultCookbook("user-1");

    expect(result).toBe(concurrentCookbook);
    expect(fetchDefault).toHaveBeenCalledTimes(2);
  });

  it("falls back to the most recent cookbook after exhausting retries", async () => {
    const fallbackCookbook: CookbookDTO = {
      ...baseCookbook,
      id: "cookbook-fallback",
      is_default: false,
    };

    vi.spyOn(service as any, "fetchDefaultCookbook").mockResolvedValue(null);
    vi.spyOn(service, "createCookbook").mockRejectedValue(new Error("DUPLICATE_TITLE"));
    vi.spyOn(service as any, "fetchMostRecentCookbook").mockResolvedValue(fallbackCookbook);

    const result = await service.ensureDefaultCookbook("user-1");

    expect(result).toBe(fallbackCookbook);
  });

  it("throws when unable to create or resolve a default cookbook", async () => {
    vi.spyOn(service as any, "fetchDefaultCookbook").mockResolvedValue(null);
    vi.spyOn(service, "createCookbook").mockRejectedValue(new Error("DUPLICATE_TITLE"));
    vi.spyOn(service as any, "fetchMostRecentCookbook").mockResolvedValue(null);

    await expect(service.ensureDefaultCookbook("user-1")).rejects.toThrow("Unable to ensure default cookbook for user");
  });
});
