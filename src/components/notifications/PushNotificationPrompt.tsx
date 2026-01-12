import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const PushNotificationPrompt = () => {
  const { user, token } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        const hasAsked = localStorage.getItem('notification-asked');
        if (!hasAsked) {
          setTimeout(() => setShowPrompt(true), 3000);
        }
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Ваш браузер не поддерживает уведомления');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      localStorage.setItem('notification-asked', 'true');

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIa-Ib37gp65h_-6bQr7GKW8u24mC8j3bqTXcEHFUmfwgJjTVEg7OHhpLp3sxmk'
          ),
        });

        await fetch('https://functions.poehali.dev/cc67e884-8946-4bcd-939d-ea3c195a6598?endpoint=subscribe-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token,
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            user_id: user?.id,
          }),
        });

        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-asked', 'true');
  };

  if (!showPrompt || permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-background border-2 border-primary rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <Icon name="Bell" size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">Включить уведомления?</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Получайте мгновенные уведомления о новых заявках и изменениях статусов
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={requestPermission}
              className="flex-1"
            >
              <Icon name="Check" size={14} className="mr-1" />
              Включить
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={dismissPrompt}
            >
              Позже
            </Button>
          </div>
        </div>
        <button
          onClick={dismissPrompt}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;