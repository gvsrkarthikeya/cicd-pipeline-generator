import { vi } from 'vitest';

// Builds a thenable, infinitely-chainable proxy that resolves to `result`
// (e.g. { data, error }) regardless of which supabase-js query builder
// methods are called on it (select/eq/order/limit/insert/update/delete/single...).
export function chain(result) {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (resolve) => resolve(result);
        return () => proxy;
      },
    }
  );
  return proxy;
}

// Replaces supabase.from with a vi.fn() that returns one chain(result) per
// call, in order. Pass one { data, error } object per `.from(...)` call the
// route handler is expected to make, in the order it makes them.
export function mockSupabaseFrom(supabase, results) {
  const fromMock = vi.fn();
  for (const result of results) {
    fromMock.mockReturnValueOnce(chain(result));
  }
  supabase.from = fromMock;
  return fromMock;
}
