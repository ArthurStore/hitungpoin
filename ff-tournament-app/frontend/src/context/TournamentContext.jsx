import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [tournaments, setTournaments] = useState([]);
  const [activeTournament, setActiveTournament] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTournaments();
      setTournaments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectTournament = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTournament(id);
      setActiveTournament(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTournament = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.createTournament(data);
      setTournaments((prev) => [created, ...prev]);
      setActiveTournament(created);
      return created;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshActive = useCallback(async () => {
    if (activeTournament?._id) {
      await selectTournament(activeTournament._id);
    }
  }, [activeTournament?._id, selectTournament]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        activeTournament,
        loading,
        error,
        fetchTournaments,
        selectTournament,
        createTournament,
        refreshActive,
        setActiveTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
