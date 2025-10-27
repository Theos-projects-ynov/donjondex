import axios from 'axios';
import type { Trainer, LoginRequest, RegisterRequest, AuthResponse } from '../types/Trainer';

// Configuration axios
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token à toutes les requêtes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

export class AuthService {
  // Connexion
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/trainer/login', credentials);
      const { token } = response.data;
      
      // Sauvegarder le token
      localStorage.setItem('authToken', token);
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur de connexion');
      }
      throw new Error('Erreur de connexion');
    }
  }

  // Inscription
  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/trainer/register', userData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors de l\'inscription');
      }
      throw new Error('Erreur lors de l\'inscription');
    }
  }

  // Récupérer le profil
  static async getTrainerProfile(): Promise<Trainer> {
    try {
      const response = await api.get<Trainer>('/trainer/me');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Erreur lors du chargement du profil');
      }
      throw new Error('Erreur lors du chargement du profil');
    }
  }

  // Déconnexion
  static async logout(): Promise<void> {
    localStorage.removeItem('authToken');
  }

  // Vérifier si l'utilisateur est connecté
  static isLoggedIn(): boolean {
    return !!localStorage.getItem('authToken');
  }

  // Récupérer le token
  static getToken(): string | null {
    return localStorage.getItem('authToken');
  }
} 