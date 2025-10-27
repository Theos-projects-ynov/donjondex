import { useEffect, useRef, useCallback, useReducer, useState } from 'react';
import type {
  DungeonState,
  AttackResult,
  PokemonKO,
  EnemyDefeated,
  ForcePokemonSwitch,
  DungeonCompletion,
  AvailablePokemon,
  CurrentHp,
  MaxHp,
  Enemy
} from '../types/Dungeon';
import type { OwnedPokemon } from '../types/Trainer';
import { DungeonMessageType, DUNGEON_MESSAGES } from '../constants/dungeonConstants';
import {
  GameAction,
  gameStateReducer,
  initialGameState,
  type UnifiedGameState
} from '../types/gameState';
import { replacePokemonNamesInMessage } from '../utils/pokemonUtils';
import { AuthService } from '../service/authService';

interface UseDungeonWebSocketProps {
  dungeonId: string;
  selectedPokemon: OwnedPokemon[];
  pokemonNames: Record<number, string>;
  onPokemonNamesUpdate?: (dungeonState: DungeonState, availableForSwitch?: AvailablePokemon[]) => void;
}

interface UseDungeonWebSocketReturn {
  // État unifié
  gameState: UnifiedGameState;
  
  // États spécifiques au donjon
  dungeonState: DungeonState | null;
  currentHp: CurrentHp;
  maxHp: MaxHp;
  battleMessages: string[];
  koedPokemon: Set<string>;
  availableForSwitch: AvailablePokemon[];
  dungeonCompletion: DungeonCompletion | null;
  
  // Actions
  startFight: (pokemonId: string) => void;
  switchPokemon: (pokemonId: string) => void;
  resetDungeon: () => void;
}

export const useDungeonWebSocket = ({
  dungeonId,
  selectedPokemon,
  pokemonNames,
  onPokemonNamesUpdate
}: UseDungeonWebSocketProps): UseDungeonWebSocketReturn => {
  // État unifié avec useReducer
  const [gameState, dispatch] = useReducer(gameStateReducer, initialGameState);
  
  // États spécifiques
  const [dungeonState, setDungeonState] = useState<DungeonState | null>(null);
  const [currentHp, setCurrentHp] = useState<CurrentHp>({});
  const [maxHp, setMaxHp] = useState<MaxHp>({});
  const [battleMessages, setBattleMessages] = useState<string[]>([]);
  const [koedPokemon, setKoedPokemon] = useState<Set<string>>(new Set());
  const [availableForSwitch, setAvailableForSwitch] = useState<AvailablePokemon[]>([]);
  const [dungeonCompletion, setDungeonCompletion] = useState<DungeonCompletion | null>(null);
  
  // Refs pour éviter les fuites mémoire et les dépendances
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const pokemonNamesRef = useRef(pokemonNames);
  const dungeonStateRef = useRef(dungeonState);
  const onPokemonNamesUpdateRef = useRef(onPokemonNamesUpdate);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const errorDelayTimeoutRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Maintenir les refs à jour
  pokemonNamesRef.current = pokemonNames;
  dungeonStateRef.current = dungeonState;
  onPokemonNamesUpdateRef.current = onPokemonNamesUpdate;

  // Fonction pour envoyer des messages WebSocket de manière sécurisée
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket non connecté, impossible d\'envoyer:', message);
    return false;
  }, []);

  // Gestion des messages WebSocket
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    const data = JSON.parse(event.data);
    console.log('Message reçu:', data);

        // Gestion des erreurs backend avec retry automatique et patience
    if (data.type === 'ERROR') {
      console.error('Erreur du serveur:', data.error);
      
      if (data.error.includes('Unique constraint failed') && retryCountRef.current < 3) {
        // Retry automatique pour les conflits de session
        retryCountRef.current += 1;
        console.log(`🔄 Retry ${retryCountRef.current}/3 après conflit de session...`);
        
        // Marquer comme plus en chargement initial
        isInitialLoadRef.current = false;
        
        // Mettre à jour l'état UI pour montrer le retry seulement après le premier échec
        if (retryCountRef.current > 1) {
          dispatch({
            type: GameAction.SET_RETRYING,
            payload: { retryCount: retryCountRef.current }
          });
        }
        
        // Attendre 2 secondes puis retry
        retryTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current && wsRef.current) {
            wsRef.current.close();
            // initializeWebSocket sera rappelé automatiquement
          }
        }, 2000);
        
        return; // Ne pas afficher d'erreur pour les premiers retry
      }
      
      // Afficher l'erreur seulement après tous les retry
      if (data.error.includes('Unique constraint failed')) {
        dispatch({ 
          type: GameAction.SET_ERROR, 
          payload: 'Session de donjon occupée. Le serveur nettoie automatiquement, réessayez dans un moment.' 
        });
      } else {
        dispatch({ 
          type: GameAction.SET_ERROR, 
          payload: data.error || 'Erreur du serveur' 
        });
      }
      return;
    }

    switch (data.type) {
      case DungeonMessageType.DUNGEON_READY: {
        setDungeonState(data.data);
        
        // Initialiser les HP
        const hpState: CurrentHp = {};
        const maxHpState: MaxHp = {};

        // HP des ennemis
        data.data.enemies.forEach((enemy: Enemy) => {
          hpState[enemy.id] = enemy.hp;
          maxHpState[enemy.id] = enemy.maxHp;
        });

        // HP de l'équipe du joueur
        data.data.playerTeam.forEach((pokemon: DungeonState['playerTeam'][0]) => {
          hpState[pokemon.id] = pokemon.stats.hp;
          maxHpState[pokemon.id] = pokemon.stats.maxHp;
        });

        setCurrentHp(hpState);
        setMaxHp(maxHpState);
        
        dispatch({ 
          type: GameAction.SET_DUNGEON_READY, 
          payload: { isConnected: true } 
        });

        // Déclencher le chargement des noms de Pokémon
        onPokemonNamesUpdateRef.current?.(data.data);
        break;
      }

      case DungeonMessageType.ATTACK_RESULT: {
        const attackData = data.data as AttackResult;
        
        // Mettre à jour les HP du défenseur
        setCurrentHp(prev => ({
          ...prev,
          [attackData.defender.id]: attackData.remainingHp
        }));

        // Si c'est un boss, initialiser aussi ses HP max
        if (attackData.defender.id.startsWith('boss_')) {
          setMaxHp(prev => ({
            ...prev,
            [attackData.defender.id]: attackData.maxHp
          }));
        }

        // Ajouter le message de combat avec les vrais noms
        const messageWithRealNames = replacePokemonNamesInMessage(
          attackData.message,
          pokemonNamesRef.current
        );
        setBattleMessages(prev => [...prev.slice(-4), messageWithRealNames]);
        break;
      }

      case DungeonMessageType.POKEMON_KO: {
        const koData = data.data as PokemonKO;
        
        // Forcer les HP du Pokémon KO à 0
        setCurrentHp(prev => ({
          ...prev,
          [koData.koedPokemon.id]: 0
        }));

        // Marquer le Pokémon comme KO
        setKoedPokemon(prev => new Set([...prev, koData.koedPokemon.id]));

        // Ajouter le message de KO avec les vrais noms
        const koMessageWithRealNames = replacePokemonNamesInMessage(
          koData.message,
          pokemonNamesRef.current
        );
        setBattleMessages(prev => [...prev.slice(-4), koMessageWithRealNames]);
        break;
      }

      case DungeonMessageType.ENEMY_DEFEATED: {
        const enemyData = data.data as EnemyDefeated;
        
        // Ajouter le message de victoire
        setBattleMessages(prev => [...prev.slice(-4), enemyData.message]);

        // Mettre à jour le compteur d'ennemis vaincus
        setDungeonState(prev => {
          if (prev) {
            return {
              ...prev,
              session: {
                ...prev.session,
                defeatedEnemies: enemyData.defeatedEnemies
              }
            };
          }
          return prev;
        });
        break;
      }

      case DungeonMessageType.FORCE_POKEMON_SWITCH: {
        const switchData = data.data as ForcePokemonSwitch;
        
        setAvailableForSwitch(switchData.availablePokemons);
        
        dispatch({ 
          type: GameAction.FORCE_SWITCH, 
          payload: { battleId: switchData.battleId } 
        });

        // Ajouter le message
        const switchMessageWithRealNames = replacePokemonNamesInMessage(
          switchData.message,
          pokemonNamesRef.current
        );
        setBattleMessages(prev => [...prev.slice(-4), switchMessageWithRealNames]);

        // Déclencher le chargement des noms de Pokémon pour les nouveaux disponibles
        if (dungeonStateRef.current) {
          onPokemonNamesUpdateRef.current?.(dungeonStateRef.current, switchData.availablePokemons);
        }
        break;
      }

      case DungeonMessageType.DUNGEON_COMPLETED_WIN: {
        console.log('🎉 VICTOIRE ! Donjon terminé:', data.data);
        
        setDungeonCompletion({
          isWin: true,
          message: data.data.message || 'Bravo ! Tu as vaincu Mew et terminé le donjon !',
          rewards: data.data.rewards
        });
        
        dispatch({ type: GameAction.COMPLETE_WIN });
        break;
      }

      case DungeonMessageType.DUNGEON_COMPLETED_LOOSE: {
        console.log('💀 DÉFAITE ! Donjon échoué:', data.data);
        
        setDungeonCompletion({
          isWin: false,
          message: 'Défaite... Tous tes Pokémon sont KO.',
          rewards: undefined
        });
        
        dispatch({ type: GameAction.COMPLETE_LOSE });
        break;
      }

      default:
        console.warn('Type de message non géré:', data.type);
    }
  }, []); // Plus de dépendances grâce aux refs

  // Entrée dans le donjon
  const enterDungeon = useCallback(async () => {
    try {
      const token = AuthService.getToken();
      if (!token) {
        dispatch({ 
          type: GameAction.SET_ERROR, 
          payload: DUNGEON_MESSAGES.AUTH_ERROR 
        });
        return;
      }

      const message = {
        type: DungeonMessageType.ENTER_DUNGEON,
        token: token,
        data: {
          dungeonId: parseInt(dungeonId),
          selectedPokemonIds: selectedPokemon.map(p => p.id)
        }
      };

      sendMessage(message);
    } catch (error) {
      console.error('Erreur lors de l\'entrée dans le donjon:', error);
      dispatch({ 
        type: GameAction.SET_ERROR, 
        payload: DUNGEON_MESSAGES.ENTER_ERROR 
      });
    }
  }, [dungeonId, selectedPokemon, sendMessage]);

  // Initialisation WebSocket (sans dépendances pour éviter les boucles)
  const initializeWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      dispatch({ type: GameAction.SET_LOADING });
      
      const websocket = new WebSocket(`${import.meta.env.VITE_WS_URL}/dungeon`);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('WebSocket connecté');
        // Reset du compteur de retry en cas de connexion réussie
        retryCountRef.current = 0;
        isInitialLoadRef.current = false; // Première connexion réussie
        
        // Annuler le délai d'erreur s'il existe
        if (errorDelayTimeoutRef.current) {
          clearTimeout(errorDelayTimeoutRef.current);
          errorDelayTimeoutRef.current = null;
        }
        
        // Appel direct sans dépendance
        enterDungeon();
      };

             websocket.onmessage = handleWebSocketMessage;

      websocket.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        
        // Ne pas afficher d'erreur immédiatement au premier chargement
        if (isInitialLoadRef.current) {
          console.log('🕐 Délai de grâce - pas d\'erreur immédiate...');
          return;
        }
        
        if (isMountedRef.current) {
          // Délai avant d'afficher l'erreur (sauf si déjà en retry)
          if (retryCountRef.current === 0) {
            errorDelayTimeoutRef.current = window.setTimeout(() => {
              if (isMountedRef.current) {
                dispatch({ 
                  type: GameAction.SET_ERROR, 
                  payload: DUNGEON_MESSAGES.CONNECTION_ERROR 
                });
              }
            }, 3000); // 3 secondes de délai
          } else {
            // Si on est déjà en retry, afficher l'erreur
            dispatch({ 
              type: GameAction.SET_ERROR, 
              payload: DUNGEON_MESSAGES.CONNECTION_ERROR 
            });
          }
        }
      };

      websocket.onclose = () => {
        console.log('WebSocket fermé');
        
        // Pendant le chargement initial, ne pas paniquer tout de suite
        if (isInitialLoadRef.current) {
          console.log('🕐 Chargement initial - WebSocket fermé, on reste patient...');
          return;
        }
        
        // Retry automatique si fermé de manière inattendue et qu'on n'a pas encore trop essayé
        if (isMountedRef.current && retryCountRef.current < 3) {
          console.log(`🔄 Reconnexion automatique ${retryCountRef.current + 1}/3...`);
          retryCountRef.current += 1;
          
          // Mettre à jour l'état UI pour montrer le retry seulement après le premier échec
          if (retryCountRef.current > 1) {
            dispatch({
              type: GameAction.SET_RETRYING,
              payload: { retryCount: retryCountRef.current }
            });
          }
          
          retryTimeoutRef.current = window.setTimeout(() => {
            if (isMountedRef.current) {
              initializeWebSocket();
            }
          }, 1500); // Délai progressif : 1.5s
        } else if (retryCountRef.current >= 3) {
          // Trop de retry, afficher l'erreur
          dispatch({ 
            type: GameAction.SET_ERROR, 
            payload: DUNGEON_MESSAGES.CONNECTION_ERROR 
          });
        }
      };

    } catch (error) {
      console.error('Erreur lors de l\'initialisation WebSocket:', error);
      if (isMountedRef.current) {
        dispatch({ 
          type: GameAction.SET_ERROR, 
          payload: DUNGEON_MESSAGES.CONNECTION_ERROR 
        });
      }
    }
  }, [handleWebSocketMessage, enterDungeon]); // Maintenant stable grâce aux refs

  // Actions exposées
  const startFight = useCallback((pokemonId: string) => {
    const message = {
      type: DungeonMessageType.START_FIGHT,
      data: {
        selectedPokemonId: pokemonId
      }
    };

    if (sendMessage(message)) {
      dispatch({ type: GameAction.START_BATTLE });
      console.log('⚔️ Combat démarré avec:', pokemonId);
    }
  }, [sendMessage]);

  const switchPokemon = useCallback((pokemonId: string) => {
    if (!gameState.currentBattleId) {
      console.error('Aucun battleId disponible pour le switch');
      return;
    }

    const message = {
      type: DungeonMessageType.CHANGE_POKEMON,
      data: {
        newPokemonId: pokemonId,
        battleId: gameState.currentBattleId
      }
    };

    if (sendMessage(message)) {
      dispatch({ type: GameAction.SWITCH_COMPLETED });
      setAvailableForSwitch([]);
      console.log('🔄 Pokémon changé pour:', pokemonId);
    }
  }, [sendMessage, gameState.currentBattleId]);

  const resetDungeon = useCallback(() => {
    dispatch({ type: GameAction.RESET });
    setDungeonState(null);
    setCurrentHp({});
    setMaxHp({});
    setBattleMessages([]);
    setKoedPokemon(new Set());
    setAvailableForSwitch([]);
    setDungeonCompletion(null);
  }, []);

  // Initialisation et cleanup
  useEffect(() => {
    isMountedRef.current = true;
    initializeWebSocket();

    return () => {
      isMountedRef.current = false;
      
      // Nettoyer les timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (errorDelayTimeoutRef.current) {
        clearTimeout(errorDelayTimeoutRef.current);
        errorDelayTimeoutRef.current = null;
      }
      
      // Fermer la connexion WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Reset des compteurs et flags
      retryCountRef.current = 0;
      isInitialLoadRef.current = true;
    };
  }, [initializeWebSocket]);

  return {
    gameState,
    dungeonState,
    currentHp,
    maxHp,
    battleMessages,
    koedPokemon,
    availableForSwitch,
    dungeonCompletion,
    startFight,
    switchPokemon,
    resetDungeon
  };
};

export default useDungeonWebSocket; 