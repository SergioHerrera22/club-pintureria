import { create } from 'zustand';
import api from '../lib/api';

interface ClientProfile {
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  lastPurchaseAt?: string;
}

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  birthDate?: string;
  isActive: boolean;
  clientProfile: ClientProfile | null;
}

interface ClientState {
  currentClient: ClientData | null;
  isLoading: boolean;
  lastSync: number | null;
  autoSyncInterval: ReturnType<typeof setInterval> | null;
  
  setCurrentClient: (client: ClientData | null) => void;
  fetchClientByDni: (dni: string) => Promise<ClientData | null>;
  refreshClientPoints: () => Promise<void>;
  startAutoSync: (intervalMs?: number) => void;
  stopAutoSync: () => void;
  clearClient: () => void;
}

export const useClientStore = create<ClientState>((set, get) => ({
  currentClient: null,
  isLoading: false,
  lastSync: null,
  autoSyncInterval: null,
  
  setCurrentClient: (client) => {
    set({ currentClient: client });
  },
  
  fetchClientByDni: async (dni: string) => {
    set({ isLoading: true });
    try {
      const cleanDni = dni.replace(/[.\-\s]/g, '');
      const response = await api.get<ClientData>(`/clients/dni/${cleanDni}`);
      const clientData = response.data;
      
      if (!clientData.isActive) {
        throw new Error('Cliente inactivo');
      }
      
      if (!clientData.clientProfile) {
        throw new Error('El cliente no tiene perfil de puntos');
      }
      
      set({ currentClient: clientData, lastSync: Date.now() });
      return clientData;
    } catch (error) {
      set({ currentClient: null });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  refreshClientPoints: async () => {
    const { currentClient } = get();
    if (!currentClient?.dni) return;
    
    try {
      const cleanDni = currentClient.dni.replace(/[.\-\s]/g, '');
      const response = await api.get<ClientData>(`/clients/dni/${cleanDni}`);
      const clientData = response.data;
      
      if (clientData.isActive && clientData.clientProfile) {
        set({ currentClient: clientData, lastSync: Date.now() });
      }
    } catch (error) {
      console.error('Error refreshing client points:', error);
    }
  },
  
  startAutoSync: (intervalMs = 5000) => {
    const existingInterval = get().autoSyncInterval;
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    const interval = setInterval(() => {
      const { currentClient } = get();
      if (currentClient?.dni) {
        get().refreshClientPoints();
      }
    }, intervalMs);
    
    set({ autoSyncInterval: interval });
  },
  
  stopAutoSync: () => {
    const interval = get().autoSyncInterval;
    if (interval) {
      clearInterval(interval);
      set({ autoSyncInterval: null });
    }
  },
  
  clearClient: () => {
    get().stopAutoSync();
    set({ currentClient: null, lastSync: null });
  },
}));