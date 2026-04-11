import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveServerUrl } from '../serverUrl';

const DISCONNECT_GRACE_PERIOD_MS = 250;

let sharedSocket: Socket | null = null;
let activeConsumers = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(resolveServerUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  return sharedSocket;
}

function scheduleDisconnect() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
  }

  disconnectTimer = setTimeout(() => {
    if (activeConsumers === 0 && sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
    disconnectTimer = null;
  }, DISCONNECT_GRACE_PERIOD_MS);
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    const socket = getSocket();
    activeConsumers += 1;

    socketRef.current = socket;

    if (socket.connected) {
      setIsConnected(true);
    }

    const handleConnect = () => {
      setIsConnected(true);
      console.log('Connected to server');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      activeConsumers = Math.max(0, activeConsumers - 1);
      scheduleDisconnect();
    };
  }, []);

  const emit = useCallback(
    (event: string, data?: any): Promise<any> => {
      return new Promise((resolve) => {
        const socket = socketRef.current ?? getSocket();
        if (!socket) {
          resolve({ error: 'Nicht verbunden.' });
          return;
        }

        const acknowledge = (response: any) => {
          resolve(response);
        };

        if (typeof data === 'undefined') {
          socket.emit(event, acknowledge);
          return;
        }

        socket.emit(event, data, acknowledge);
      });
    },
    []
  );

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const socket = socketRef.current ?? getSocket();
    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, []);

  return { socket: socketRef.current, isConnected, emit, on };
}
