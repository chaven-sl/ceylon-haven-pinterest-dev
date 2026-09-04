/**
 * Board Routing Module
 * Maps Facebook captions to Pinterest board IDs based on property configuration
 * Configuration stored in Supabase board_routing_config table
 */

import { createClient } from '@supabase/supabase-js';
import { getValidatedEnv } from './env';

export interface BoardRoutingResult {
  boardId: string;
  destinationUrl?: string;
  matched: boolean;
  reason: string;
}

export interface BoardConfig {
  property_id: string;
  property_name: string;
  pinterest_board_id: string;
  destination_url?: string;
  aliases?: string[];
  active: boolean;
}

/**
 * Board Router
 * Matches post captions to configured property boards
 */
export class BoardRouter {
  private supabaseUrl: string;
  private supabaseServiceRoleKey: string;
  private boardCache: Map<string, BoardConfig> = new Map();
  private cacheLoadedAt: Date | null = null;
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceRoleKey = supabaseServiceRoleKey;
  }

  /**
   * Route a post to the appropriate board based on caption analysis
   *
   * @param caption - Facebook post caption
   * @returns Routing result with board ID and destination URL
   */
  async routePost(caption: string): Promise<BoardRoutingResult> {
    // Ensure board cache is loaded and fresh
    await this.ensureCacheLoaded();

    if (this.boardCache.size === 0) {
      return {
        boardId: '',
        matched: false,
        reason: 'No board mappings configured. Manual routing required.',
      };
    }

    // Extract property name from caption
    const matchedBoard = this.matchCaption(caption);

    if (matchedBoard) {
      return {
        boardId: matchedBoard.pinterest_board_id,
        destinationUrl: matchedBoard.destination_url,
        matched: true,
        reason: `Matched property: ${matchedBoard.property_name}`,
      };
    }

    // No match found
    return {
      boardId: '',
      matched: false,
      reason: 'No matching property found in caption. Manual routing required.',
    };
  }

  /**
   * Match caption text against property names and aliases
   * Case-insensitive matching
   */
  private matchCaption(caption: string): BoardConfig | null {
    const captionLower = caption.toLowerCase();

    for (const boardConfig of this.boardCache.values()) {
      if (!boardConfig.active) {
        continue;
      }

      // Match property name
      if (captionLower.includes(boardConfig.property_name.toLowerCase())) {
        return boardConfig;
      }

      // Match aliases
      if (boardConfig.aliases && boardConfig.aliases.length > 0) {
        for (const alias of boardConfig.aliases) {
          if (captionLower.includes(alias.toLowerCase())) {
            return boardConfig;
          }
        }
      }
    }

    return null;
  }

  /**
   * Load or refresh board configuration from Supabase
   * Uses cache expiry to avoid excessive database queries
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = new Date();

    // Use cache if recent and loaded
    if (this.cacheLoadedAt && now.getTime() - this.cacheLoadedAt.getTime() < this.cacheExpiryMs) {
      return;
    }

    await this.reloadBoardConfig();
  }

  /**
   * Force reload board configuration from Supabase
   */
  async reloadBoardConfig(): Promise<void> {
    const client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey);

    try {
      const { data, error } = await client
        .from('board_routing_config')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Clear and rebuild cache
      this.boardCache.clear();

      if (data && data.length > 0) {
        for (const row of data) {
          this.boardCache.set(row.property_id, {
            property_id: row.property_id,
            property_name: row.property_name,
            pinterest_board_id: row.pinterest_board_id,
            destination_url: row.destination_url,
            aliases: row.aliases || [],
            active: row.active,
          });
        }
      }

      this.cacheLoadedAt = new Date();
    } catch (error) {
      throw new Error(`Failed to load board routing configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Get all active board configurations (for validation)
   */
  async getActiveBoardConfigs(): Promise<BoardConfig[]> {
    await this.ensureCacheLoaded();
    return Array.from(this.boardCache.values());
  }

  /**
   * Validate that a board ID exists in user's Pinterest boards
   * Should be called at execution start
   *
   * @param userBoards - List of boards from Pinterest API
   * @returns Map of valid board IDs
   */
  validateBoardIds(userBoards: Array<{ id: string; name: string }>): Set<string> {
    const userBoardIds = new Set(userBoards.map((b) => b.id));
    return userBoardIds;
  }

  /**
   * Check if a board ID is valid according to user's Pinterest boards
   */
  isBoardValid(boardId: string, validBoards: Set<string>): boolean {
    return validBoards.has(boardId);
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.boardCache.clear();
    this.cacheLoadedAt = null;
  }
}

/**
 * Factory function to create board router with validated environment
 */
export function createBoardRouter(): BoardRouter {
  const env = getValidatedEnv();

  return new BoardRouter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
