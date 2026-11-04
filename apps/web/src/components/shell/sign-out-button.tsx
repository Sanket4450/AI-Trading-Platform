'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function SignOutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function handleOpenChange(next: boolean) {
    if (signingOut) return;
    setOpen(next);
  }

  async function logout() {
    setSigningOut(true);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error(`Sign out failed with status ${response.status}`);
    } catch {
      setSigningOut(false);
      toast.error('We could not sign you out. Please check your connection and try again.');
      return;
    }

    router.push('/login');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!signingOut}>
        <DialogHeader>
          <DialogTitle>Sign out of your account?</DialogTitle>
          <DialogDescription>
            You will be returned to the sign-in screen and asked to authenticate again before you
            can continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={signingOut}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={logout} disabled={signingOut}>
            {signingOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
