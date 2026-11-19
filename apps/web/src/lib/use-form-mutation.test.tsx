import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from './api-error';
import { useFormMutation, type FormMutation } from './use-form-mutation';

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

function Harness<Result>({
  build,
}: {
  build: (formData: FormData) => FormMutation<Result>;
}) {
  const action = useFormMutation(build);
  return (
    <form action={action}>
      <button type="submit">Run</button>
    </form>
  );
}

beforeEach(() => {
  replace.mockReset();
});

describe('useFormMutation', () => {
  it('navigates to the success URL built from the response', async () => {
    render(
      <Harness
        build={() => ({
          request: async () => ({ id: 'cfg-1' }),
          successUrl: (created) => `/settings?version=${created.id}&created=1`,
          errorUrl: () => '/settings?error=failed',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/settings?version=cfg-1&created=1'));
  });

  it('navigates to the error URL when the request rejects', async () => {
    render(
      <Harness
        build={() => ({
          request: async () => {
            throw new Error('Coverage already complete');
          },
          successUrl: () => '/instruments?queued=1',
          errorUrl: (error) => `/instruments?error=${(error as Error).message}`,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/instruments?error=Coverage already complete'),
    );
  });

  it('leaves the page alone when the session already expired', async () => {
    render(
      <Harness
        build={() => ({
          request: async () => {
            throw new UnauthorizedError('{}');
          },
          successUrl: () => '/instruments?queued=1',
          errorUrl: () => '/instruments?error=session',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
