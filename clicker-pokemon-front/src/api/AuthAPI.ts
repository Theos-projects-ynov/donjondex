import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Trainer, LoginRequest, RegisterRequest, AuthResponse } from "../types/Trainer";

// Base query avec gestion de l'authentification
const baseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL}/api`,
  prepareHeaders: (headers) => {
    // Récupérer le token depuis le localStorage
    const token = localStorage.getItem('authToken');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

export const authAPI = createApi({
  reducerPath: "authAPI",
  baseQuery: baseQuery,
  tagTypes: ["Trainer"],
  endpoints: (builder) => ({
    // Connexion
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: "trainer/login",
        method: "POST",
        body: credentials,
      }),
      // Sauvegarder le token après connexion réussie
      onQueryStarted: async (arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          localStorage.setItem('authToken', data.token);
        } catch (error) {
          console.error('Erreur de connexion:', error);
        }
      },
    }),

    // Inscription
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (userData) => ({
        url: "auth/register",
        method: "POST",
        body: userData,
      }),
    }),

    // Récupérer le profil du trainer connecté
    getTrainerProfile: builder.query<Trainer, void>({
      query: () => "trainer/me",
      providesTags: ["Trainer"],
    }),

    // Déconnexion (côté client)
    logout: builder.mutation<void, void>({
      queryFn: () => {
        localStorage.removeItem('authToken');
        return { data: undefined };
      },
      invalidatesTags: ["Trainer"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetTrainerProfileQuery,
  useLogoutMutation,
} = authAPI;

export const authProfil = createApi({
  reducerPath: "authProfil",
  baseQuery: baseQuery,
  endpoints: (builder) => ({
    getProfil: builder.query<Trainer, void>({
      query: () => "users/profil",
    }),
  }),
});
