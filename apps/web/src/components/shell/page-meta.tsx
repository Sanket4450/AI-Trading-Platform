'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

interface PageMetaValue {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

type SetPageMeta = (value: PageMetaValue | null) => void;

const PageMetaContext = createContext<SetPageMeta | null>(null);

export function PageMetaProvider({
  onMeta,
  children,
}: {
  onMeta: SetPageMeta;
  children: ReactNode;
}) {
  return <PageMetaContext.Provider value={onMeta}>{children}</PageMetaContext.Provider>;
}

// Lets a page override the route-level title or contribute header actions without
// rendering the title and description inside the page content.
export function PageMeta({ title, description, actions }: PageMetaValue) {
  const setMeta = useContext(PageMetaContext);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!setMeta) return;
    setMeta({ title, description, actions: actionsRef.current });
    return () => setMeta(null);
  }, [setMeta, title, description]);

  return null;
}
