import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmitButton } from './submit-button';

describe('SubmitButton', () => {
  it('disables itself and shows the pending label while the form action runs', async () => {
    let finish: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });

    render(
      <form action={() => pending}>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </form>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();

    await act(async () => {
      finish();
      await pending;
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
