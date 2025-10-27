import axios from 'axios';
import type { Pokemon } from './api';

// Configuration axios pour l'API du backend
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

// Types pour les Pokémon du dresseur
export interface PokemonMove {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number;
  pp: number;
  priority: number;
  damageClass: string;
}

export interface PokemonOwnedMove {
  id: string;
  trainerId: string;
  ownedPokemonId: string;
  moveId: number;
  move: PokemonMove;
}

export interface OwnedPokemon {
  id: string;
  pokedexId: number;
  trainerId: string;
  boostAtk: number;
  boostDef: number;
  boostRes: number;
  boostPv: number;
  level: number;
  genre: string;
  createdAt: string;
  pokemonOwnedMoves: PokemonOwnedMove[];
  name: {
    fr: string;
    en: string;
    jp: string;
  };
  types: Array<{
    name: string;
    image: string;
  }>;
  sprites: {
    regular: string;
    shiny: string;
    gmax: string | null;
  };
  stats: {
    hp: number;
    atk: number;
    def: number;
    spe_atk: number;
    spe_def: number;
    vit: number;
  };
}

// Types pour la capture
export interface WildPokemon {
  zone: number;
  pokedexId: number;
  level: number;
  isShiny: boolean;
  genre: string;
  pokemon: Pokemon;
}

export interface CaptureResponse {
  success: boolean;
  ownedPokemon?: OwnedPokemon;
  nextWildPokemon?: WildPokemon;
}

export interface CapturePayload {
  zone: number;
  pokedexId: number;
  level: number;
  isShiny: boolean;
  genre: string;
  pokemon: Pokemon;
}

export class PokemonService {
  // Récupérer tous les Pokémon du dresseur
  static async getTrainerPokemon(): Promise<OwnedPokemon[]> {
    try {
      const response = await api.get<OwnedPokemon[]>('/pokemon');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors du chargement des Pokémon');
      }
      throw new Error('Erreur lors du chargement des Pokémon');
    }
  }

  // Chercher un Pokémon sauvage dans une zone
  static async findWildPokemon(zone: number = 1): Promise<WildPokemon> {
    try {
      // Essayons d'abord un simple GET pour voir
      const response = await api.get<WildPokemon>(`/capture/zone/${zone}`);
      return response.data;
    } catch (error) {
      console.error('Erreur détaillée:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 
                           `Erreur ${error.response?.status}: ${error.response?.statusText}` ||
                           'Erreur lors de la recherche de Pokémon';
        throw new Error(errorMessage);
      }
      throw new Error('Erreur lors de la recherche de Pokémon');
    }
  }

  // Capturer un Pokémon (tentative de capture)
  static async capturePokemon(payload: CapturePayload): Promise<CaptureResponse> {
    try {
      const response = await api.post<CaptureResponse>(`/capture/zone/${payload.zone}/attempt`, payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors de la capture');
      }
      throw new Error('Erreur lors de la capture');
    }
  }

  // Relâcher un Pokémon sauvage
  static async releasePokemon(zone: number = 1): Promise<void> {
    try {
      await api.post(`/capture/zone/${zone}/release`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors du relâchement');
      }
      throw new Error('Erreur lors du relâchement');
    }
  }
}
