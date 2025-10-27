/**
 * Types de messages WebSocket pour les donjons
 */
export enum DungeonMessageType {
  // Messages entrants (du serveur)
  DUNGEON_READY = 'DUNGEON_READY',
  ATTACK_RESULT = 'ATTACK_RESULT',
  POKEMON_KO = 'POKEMON_KO',
  ENEMY_DEFEATED = 'ENEMY_DEFEATED',
  FORCE_POKEMON_SWITCH = 'FORCE_POKEMON_SWITCH',
  DUNGEON_COMPLETED_WIN = 'DUNGEON_COMPLETED_WIN',
  DUNGEON_COMPLETED_LOOSE = 'DUNGEON_COMPLETED_LOOSE',

  // Messages sortants (vers le serveur)
  ENTER_DUNGEON = 'ENTER_DUNGEON',
  START_FIGHT = 'START_FIGHT',
  CHANGE_POKEMON = 'CHANGE_POKEMON'
}

/**
 * États du donjon
 */
export enum DungeonStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Messages d'état du donjon
 */
export const DUNGEON_MESSAGES = {
  READY_FOR_FIRST_BATTLE: 'Prêt pour le premier combat !',
  LOADING: 'Chargement du donjon...',
  CONNECTION_ERROR: 'Erreur de connexion au serveur',
  AUTH_ERROR: 'Token d\'authentification manquant',
  ENTER_ERROR: 'Erreur lors de l\'entrée dans le donjon'
} as const;

// Export des GameState pour plus de clarté  
export { GameState } from '../types/gameState'; 