import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { FN } from '@/config/backend';

const BITRIX_AUTH_API = FN.BITRIX_AUTH;

const BitrixCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('Код авторизации не получен от Битрикс24');
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/bitrix/callback`;

        const resp = await fetch(`${BITRIX_AUTH_API}?action=callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          setError(data.error || 'Ошибка авторизации через Битрикс24');
          return;
        }

        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('remember_me', 'true');

        window.location.href = '/tickets';
      } catch (e) {
        setError('Сетевая ошибка при авторизации');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1729] to-[#1b254b] [.light_&]:from-[#eef1f8] [.light_&]:to-[#dfe5f3] p-4">
        <Card className="w-full max-w-md border-border bg-card/50 [.light_&]:bg-card backdrop-blur-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-red-500 flex items-center justify-center gap-2">
              <Icon name="AlertCircle" size={24} />
              Ошибка входа
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline text-sm"
            >
              Вернуться на страницу входа
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1729] to-[#1b254b] [.light_&]:from-[#eef1f8] [.light_&]:to-[#dfe5f3] p-4">
      <Card className="w-full max-w-md border-border bg-card/50 [.light_&]:bg-card backdrop-blur-xl">
        <CardContent className="py-12 text-center space-y-4">
          <Icon name="Loader2" size={40} className="animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Выполняется вход через Битрикс24...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BitrixCallback;