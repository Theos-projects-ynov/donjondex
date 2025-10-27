import "../../style/component/card/cardProfil.scss";
import { Trainer } from "../../types/Trainer";
import { useEffect, useState } from "react";

// Cache pour les noms des Pokémon
const pokemonNamesCache: { [key: number]: string } = {};

// Types pour l'API PokeAPI
interface PokemonName {
  language: { name: string };
  name: string;
}

interface PokemonSpecies {
  names: PokemonName[];
}

function CardProfil() {
  const [trainerData, setTrainer] = useState<Trainer>();
  const [loading, setLoading] = useState(true);
  const [pokemonNames, setPokemonNames] = useState<{ [key: number]: string }>(
    {}
  );

  // Fonction pour récupérer le nom du Pokémon
  const fetchPokemonName = async (pokedexId: number): Promise<string> => {
    if (pokemonNamesCache[pokedexId]) {
      return pokemonNamesCache[pokedexId];
    }

    try {
      const response = await fetch(
        `https://pokeapi.co/api/v2/pokemon-species/${pokedexId}`
      );
      const data: PokemonSpecies = await response.json();
      const frenchName =
        data.names.find((name: PokemonName) => name.language.name === "fr")
          ?.name ||
        data.names.find((name: PokemonName) => name.language.name === "en")
          ?.name ||
        `Pokémon #${pokedexId}`;

      pokemonNamesCache[pokedexId] = frenchName;
      return frenchName;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération du nom pour ${pokedexId}:`,
        error
      );
      return `Pokémon #${pokedexId}`;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("no token");
      setLoading(false);
      return;
    }

    const fetchTrainer = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/trainer/me`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        const data = await response.json();
        console.log("data : ", data);
        setTrainer(data);

        // Récupérer les noms des 6 premiers Pokémon
        if (data.pokemons && data.pokemons.length > 0) {
          const first6Pokemon = data.pokemons.slice(0, 6);
          const names: { [key: number]: string } = {};

          for (const pokemon of first6Pokemon) {
            names[pokemon.pokedexId] = await fetchPokemonName(
              pokemon.pokedexId
            );
          }
          setPokemonNames(names);
        }

        setLoading(false);
      } catch (error) {
        console.log("Erreur lors de la récupération du profil :", error);
        setLoading(false);
      }
    };
    fetchTrainer();
  }, []);

  if (loading) {
    return (
      <div className="profil-page__card">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!trainerData) {
    return (
      <div className="profil-page__card">
        <p>Aucun données sur votre compte trouvé</p>
      </div>
    );
  }

  // Limiter à 6 Pokémon
  const displayedPokemon = trainerData.pokemons?.slice(0, 6) || [];

  return (
    <div className="profil-page__card">
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="profil-page__card__header">
            <img
              src={trainerData.image}
              alt={trainerData.name}
              className="profil-page__card__image"
            />
            <div className="profil-page__card__info">
              <h2>{trainerData.name}</h2>
              <p>{trainerData.level} niveau</p>
              <p>{trainerData.exp} exp</p>
              <p>{trainerData.gender}</p>
              <p>{trainerData.height} m</p>
              <p>{trainerData.weight} kg</p>
              <p>{trainerData.description}</p>
            </div>
          </div>

          <h3>Teams de Pokémon</h3>
          <div className="profil-page__card__teams">
            {displayedPokemon.length > 0 ? (
              displayedPokemon.map((pokemon, index) => (
                <div
                  className="profil-page__card__pokemon"
                  key={`pokemon-${index}`}
                >
                  <p>
                    {pokemonNames[pokemon.pokedexId] ||
                      `Pokémon #${pokemon.pokedexId}`}
                  </p>
                  <img
                    src={`https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/${pokemon.pokedexId}/regular.png`}
                    alt={
                      pokemonNames[pokemon.pokedexId] ||
                      `Pokémon #${pokemon.pokedexId}`
                    }
                  />
                  <p className="profil-page__card__pokemon__level">
                    {pokemon.level}
                  </p>
                </div>
              ))
            ) : (
              <p>Aucun Pokémon</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default CardProfil;
