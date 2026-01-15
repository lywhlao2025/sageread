export async function exists(_path: string): Promise<boolean> {
  return false;
}

export async function mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
  return;
}

export async function readTextFile(_path: string): Promise<string> {
  return "";
}

export async function writeTextFile(_path: string, _content: string): Promise<void> {
  return;
}

export async function readFile(_path: string): Promise<Uint8Array> {
  return new Uint8Array();
}

export async function writeFile(_path: string, _content: Uint8Array | string): Promise<void> {
  return;
}

export async function remove(_path: string): Promise<void> {
  return;
}

export async function readDir(_path: string): Promise<{ path: string; isDir: boolean }[]> {
  return [];
}
