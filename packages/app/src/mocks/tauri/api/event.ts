export async function listen<T>(_event: string, _handler: (event: { payload: T }) => void) {
  return () => {};
}
