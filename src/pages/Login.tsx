import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import Logo from '@/components/ui/Logo';
import { FN } from '@/config/backend';

const BITRIX_AUTH_API = FN.BITRIX_AUTH;

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bitrixLoading, setBitrixLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password, rememberMe);
      navigate('/tickets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleBitrixLogin = async () => {
    setBitrixLoading(true);
    setError('');

    try {
      const redirectUri = `${window.location.origin}/auth/bitrix/callback`;
      const resp = await fetch(
        `${BITRIX_AUTH_API}?action=get-auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const data = await resp.json();

      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        setError('Не удалось получить ссылку для входа через Битрикс24');
        setBitrixLoading(false);
      }
    } catch {
      setError('Ошибка подключения к серверу');
      setBitrixLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1729] to-[#1b254b] [.light_&]:from-[#eef1f8] [.light_&]:to-[#dfe5f3] p-4">
      <Card className="w-full max-w-md border-border bg-card/50 [.light_&]:bg-card backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <div className="bg-[#0f1729] rounded-lg px-4 py-3 flex items-center justify-center">
              <Logo className="h-10 w-auto" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Вход в систему</CardTitle>
          <CardDescription>
            Служба технической поддержки
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all"
            onClick={handleBitrixLogin}
            disabled={bitrixLoading}
          >
            {bitrixLoading ? (
              <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
            ) : (
              <svg className="mr-2 flex-shrink-0" width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="#2FC6F6"/>
                <path d="M9 23.5C9 23.5 8.5 17 12.5 13C16.5 9 22 8.5 22 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M13 23.5C13 23.5 12.5 19 15.5 16C18.5 13 23 12.5 23 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M17 23.5C17 23.5 16.5 21 18.5 19C20.5 17 23 16.5 23 16.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            )}
            Войти через Битрикс24
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">или</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                <Icon name="AlertCircle" size={16} />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-accent/30 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                Запомнить меня
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  <Icon name="LogIn" size={18} />
                  Войти
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;