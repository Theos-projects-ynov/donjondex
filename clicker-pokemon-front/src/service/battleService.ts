import { AuthService } from "./authService";

export interface BattleMessage {
  type: 'AUTHENTICATE' | 'SELECT_TEAM' | 'START_BATTLE' | 'ATTACK' | 'BATTLE_UPDATE' | 'BATTLE_END';
  data?: unknown;
  token?: string;
}

export interface BattleState {
  isConnected: boolean;
  isAuthenticated: boolean;
  battleData: unknown;
  error: string | null;
}

class BattleService {
  private ws: WebSocket | null = null;
  private listeners: { [key: string]: ((data?: unknown) => void)[] } = {};

  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket déjà connecté');
        resolve(this.ws);
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      console.log(`Tentative de connexion WebSocket à ${import.meta.env.VITE_WS_URL}/battle`);
      this.ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/battle`);
      
      this.ws.onopen = () => {
        console.log('✅ Connexion WebSocket établie');
        this.authenticate();
        resolve(this.ws!);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Message reçu:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Erreur parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        reject(new Error('Impossible de se connecter au serveur de combat'));
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Connexion WebSocket fermée:', event.code, event.reason);
        this.emit('disconnect');
      };

      setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error('⏰ Timeout de connexion WebSocket');
          this.ws.close();
          reject(new Error('Timeout de connexion au serveur'));
        }
      }, 5000);
    });
  }

  private async authenticate() {
    try {
      const token = AuthService.getToken();
      console.log('🔐 Token récupéré:', token ? '***' + token.slice(-10) : 'null');
      
      if (!token) {
        throw new Error('Aucun token disponible');
      }

      const authMessage = {
        type: 'AUTHENTICATE' as const,
        token: token
      };
      
      console.log('📤 Envoi authentification:', authMessage);
      this.send(authMessage);
    } catch (error) {
      console.error('❌ Erreur d\'authentification:', error);
      this.emit('auth_error', error);
    }
  }

  selectTeam(selectedPokemonIds: string[], dungeonId?: number) {
    const message = {
      type: 'SELECT_TEAM' as const,
      data: {
        selectedPokemonIds,
        dungeonId
      }
    };
    console.log('📤 Sélection équipe:', message);
    this.send(message);
  }

  startBattle(pokemonId: string) {
    const message = {
      type: 'START_BATTLE' as const,
      data: { pokemonId }
    };
    console.log('📤 Démarrage combat:', message);
    this.send(message);
  }

  attack(moveId: number) {
    const message = {
      type: 'ATTACK' as const,
      data: { moveId }
    };
    console.log('📤 Attaque:', message);
    this.send(message);
  }

  private send(message: BattleMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      console.log('📤 Envoi message:', jsonMessage);
      this.ws.send(jsonMessage);
    } else {
      console.error('❌ WebSocket non connecté, état:', this.ws?.readyState);
      this.emit('connection_error', 'WebSocket non connecté');
    }
  }

  private handleMessage(message: { type: string; data?: unknown }) {
    console.log('🔄 Traitement message:', message.type, message.data);
    this.emit(message.type, message.data);
  }

  on(event: string, callback: (data?: unknown) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: (data?: unknown) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data?: unknown) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('🔌 Fermeture connexion WebSocket');
      this.ws.close();
      this.ws = null;
    }
  }

  getConnectionState() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      state: this.ws?.readyState,
      stateText: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NULL'
    };
  }
}

export const battleService = new BattleService(); 