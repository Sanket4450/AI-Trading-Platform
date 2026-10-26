'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

function safeNextPath(next?: string) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  function validate(): boolean {
    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextErrors.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(trimmedEmail)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    else if (password.length < 8) nextErrors.password = 'Passwords are at least 8 characters.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    if (!validate()) return;

    setPending(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(
          response.status >= 500
            ? 'Sign-in is temporarily unavailable. Please try again in a moment.'
            : (payload.message ?? 'Sign-in failed. Check your email and password.'),
        );
        return;
      }

      router.push(safeNextPath(next));
      router.refresh();
    } catch {
      setError('Unable to reach the sign-in service. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) {
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          placeholder="you@example.com"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          disabled={pending}
          required
          className="h-10"
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-destructive flex items-center gap-1.5 text-xs">
            <CircleAlert className="size-3.5 shrink-0" />
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) {
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }
            }}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            disabled={pending}
            required
            minLength={8}
            className="h-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            aria-controls="password"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-3 absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg outline-none transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fieldErrors.password ? (
          <p id="password-error" className="text-destructive flex items-center gap-1.5 text-xs">
            <CircleAlert className="size-3.5 shrink-0" />
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-10 w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}
