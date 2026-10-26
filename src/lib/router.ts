import { useEffect, useState } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(to: string): void {
  location.hash = to.startsWith('#') ? to : `#${to}`;
}

export const href = (to: string) => `#${to}`;
