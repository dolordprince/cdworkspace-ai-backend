import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchApiKey, ZulipAuthError } from "../lib/zulipClient";
import { useInstancesStore } from "../stores/instancesStore";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const instances = useInstancesStore((s) => s.instances);
  const addInstance = useInstancesStore((s) => s.addInstance);
  const isAddServer = instances.length > 0;

  const [realm, setRealm] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const realmTrim = realm.trim();
    const usernameTrim = username.trim();
    if (!realmTrim || !usernameTrim || !password) {
      setError("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchApiKey(realmTrim, usernameTrim, password);
      const normalizedRealm = realmTrim.replace(/\/+$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "") || realmTrim;
      addInstance({
        realm: normalizedRealm,
        email: result.email,
        apiKey: result.api_key,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ZulipAuthError ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        {isAddServer && (
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="self-start flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <Icon name="chevron-right" size={16} className="rotate-180" />
            Назад
          </button>
        )}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">
            {isAddServer ? "Добавить сервер Zulip" : "Подключение к Zulip"}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Укажите адрес сервера и учётные данные для входа
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="realm" className="block text-sm font-medium text-text-primary mb-1.5">
              Адрес сервера Zulip
            </label>
            <input
              id="realm"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://chat.example.com"
              value={realm}
              onChange={(e) => setRealm(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1.5">
              Логин (email)
            </label>
            <input
              id="username"
              type="email"
              autoComplete="email"
              placeholder="user@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
};
