import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  dashboardId?: string;
  data?: any;
  timestamp?: number;
}

export function useWebSocketDashboard(dashboardId: string, tenantId: string, enabled: boolean = true) {
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !dashboardId || !tenantId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws?tenantId=${tenantId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // 订阅 dashboard
      ws.send(JSON.stringify({
        type: 'subscribe',
        dashboardId: dashboardId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        if (message.type === 'data_update' && message.dashboardId === dashboardId) {
          setData(message.data);
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          dashboardId: dashboardId,
        }));
      }
      ws.close();
    };
  }, [dashboardId, tenantId, enabled]);

  return { data, connected };
}
